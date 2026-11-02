import { waitUntil } from "@vercel/functions"

import type { MetricSource, SourceDefinition, SourcePayload } from "../providers"
import type { AggregatorInputs, ModelSnapshot } from "./model-aggregator.types"

import { SourceCache } from "../cache/cache"
import { ProvidersService } from "../providers"
import { aggregateModels, type Derivation } from "./derive"
import { buildDiagnostics, diagnosticsLogLine, type DiagnosticsReport } from "./diagnostics"
import { catalogInput, inputsVersion, metricSourceInput } from "./inputs"

/** How long a checked snapshot is served before the next request checks the sources' stamps. */
const CHECK_INTERVAL_MS = 5_000
/** A deploy's built snapshot outlives it briefly; the next deploy builds and stores its own. */
const BUILT_SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60

/** Listed in metadata order, the catalog last: the order `inputsVersion` joins fetch times in. */
const SOURCES: ReadonlyArray<SourceDefinition<unknown>> = [
  ...Object.values(ProvidersService.metricSources),
  ProvidersService.catalog,
]

type Aggregation = {
  /** The sources' fetch times, which is all that can change the result within a deploy. */
  version: string
  snapshot: ModelSnapshot
  /** Absent for a snapshot another instance built; diagnostics rebuild it from the payloads. */
  derivation: Derivation | null
  report: DiagnosticsReport | null
}

type FullAggregation = Aggregation & { derivation: Derivation }

function hasDerivation(aggregation: Aggregation): aggregation is FullAggregation {
  return aggregation.derivation != null
}

type BuiltSnapshot = { version: string; snapshot: ModelSnapshot }

function isBuiltSnapshot(value: unknown): value is BuiltSnapshot {
  return (
    value != null &&
    typeof value === "object" &&
    "version" in value &&
    typeof value.version === "string" &&
    "snapshot" in value &&
    value.snapshot != null
  )
}

/**
 * Serves the snapshot from memory, checks the sources' stamps at most every few seconds with
 * one small read, and rebuilds only when a stamp moved. A cold instance first takes the snapshot
 * another instance of the same deploy built, so serverless cold starts skip the build. Once a
 * stamp moves, the snapshot on hand keeps being served while the rebuild runs after the response;
 * only an instance with nothing to serve builds on the request.
 */
export class ModelAggregatorService {
  private latest: Aggregation | null = null
  private checkedAt = Number.NEGATIVE_INFINITY
  /** One check at a time, however many requests arrive while it runs. */
  private checking: Promise<Aggregation> | undefined
  /** One build at a time, whether a request waits on it or it runs after the response. */
  private building: Promise<FullAggregation> | undefined
  /** One catch-up at a time; a failure keeps the snapshot on hand, and the next check retries. */
  private catchingUp: Promise<void> | undefined

  constructor(
    private readonly cache = new SourceCache(),
    /** Names the code that built a snapshot, so no build reuses or tags one an older build made. */
    private readonly buildId: string = import.meta.env.BUILD_ID,
    private readonly now: () => number = Date.now,
    /** Off in dev, so each restart doesn't leave its own copy in Redis for a week. */
    private readonly shareBuilt: boolean = !import.meta.env.DEV,
    /** Keeps the instance alive for work the response doesn't wait on. */
    private readonly background: (task: Promise<unknown>) => void = waitUntil,
  ) {}

  async getSnapshot(): Promise<ModelSnapshot> {
    return (await this.current()).snapshot
  }

  /** The snapshot and a tag naming it, which changes only when a source refreshes or code deploys. */
  async getTaggedSnapshot(): Promise<{ tag: string; snapshot: ModelSnapshot }> {
    const { version, snapshot } = await this.current()
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${this.buildId}|${version}`),
    )
    const tag = Array.from(new Uint8Array(digest).subarray(0, 16), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")

    return { tag, snapshot }
  }

  /** The same result production serves, so it shows what today's rules do with new models. */
  async getDiagnostics() {
    const current = await this.current()

    return this.reportFor(hasDerivation(current) ? current : await this.rebuild())
  }

  private current() {
    if (this.latest && this.now() - this.checkedAt < CHECK_INTERVAL_MS) {
      return Promise.resolve(this.latest)
    }

    this.checking ??= this.check().finally(() => {
      this.checking = undefined
    })

    return this.checking
  }

  private async check() {
    const stamps = await this.cache.stamps(SOURCES)
    this.checkedAt = this.now()

    for (const source of SOURCES) {
      const stamp = stamps[source.cacheKey]
      if (stamp) this.cache.refreshIfStale(source, stamp)
    }

    // A source with no stamp has a copy stored before stamps existed, or none: only reading them
    // all tells what the snapshot should be.
    const version = SOURCES.some((source) => stamps[source.cacheKey] == null)
      ? null
      : SOURCES.map((source) => stamps[source.cacheKey]).join("|")
    if (version != null && this.latest?.version === version) return this.latest

    // A cold instance reads the shared copy now, so its catch-up needn't read it again.
    const sharedRead = !this.latest
    if (sharedRead) {
      const built = await this.readBuilt()
      if (built) this.latest = { ...built, derivation: null, report: null }
    }
    if (!this.latest) return this.rebuild()
    if (this.latest.version !== version) {
      this.catchingUp ??= this.catchUp(sharedRead ? null : version).finally(() => {
        this.catchingUp = undefined
      })
      this.background(this.catchingUp)
    }

    return this.latest
  }

  /**
   * Brings an outdated snapshot up to `version` after the response: from the copy another
   * instance of this deploy saved when it has one, by building otherwise. With no version to
   * look for, it builds.
   */
  private async catchUp(version: string | null) {
    try {
      const built = version == null ? null : await this.readBuilt()
      if (built != null && built.version === version) {
        this.latest = { ...built, derivation: null, report: null }
        return
      }

      await this.rebuild()
    } catch (error) {
      console.error("[aggregator] background update failed:", error)
    }
  }

  /** Builds the snapshot, joining a build already running. */
  private rebuild(): Promise<FullAggregation> {
    this.building ??= this.build().finally(() => {
      this.building = undefined
    })

    return this.building
  }

  /** Reads every source's payload and builds the snapshot, as each request used to. */
  private async build(): Promise<FullAggregation> {
    const startedAt = performance.now()
    // Listed in metadata order: the first source listing a model names it.
    const inputs: AggregatorInputs = {
      metricSources: await Promise.all(
        Object.values(ProvidersService.metricSources).map((source) =>
          this.readMetricSource(source),
        ),
      ),
      catalog: catalogInput(await this.cache.read(ProvidersService.catalog)),
    }
    const derivation = aggregateModels(inputs)
    const rebuilt: FullAggregation = {
      version: inputsVersion(inputs),
      snapshot: derivation.snapshot,
      derivation,
      report: null,
    }
    this.latest = rebuilt
    this.checkedAt = this.now()

    // Saved after the response, which needs only the snapshot in memory.
    this.background(
      Promise.all([this.cache.recordStamps(stampsOf(inputs)), this.writeBuilt(rebuilt)]),
    )
    // The diagnostics report costs many times the build, so only its endpoint builds it.
    console.info(
      `[aggregator] built ${rebuilt.snapshot.entries.length} entries in ${Math.round(performance.now() - startedAt)} ms`,
    )

    return rebuilt
  }

  private builtKey() {
    return this.shareBuilt ? `llm-scores:snapshot:${this.buildId}` : null
  }

  private async readBuilt() {
    const key = this.builtKey()
    if (!key) return null

    const stored = await this.cache.readShared(key)
    return isBuiltSnapshot(stored) ? stored : null
  }

  /** Only a complete build is shared; one missing a source would hide it until the next build. */
  private async writeBuilt({ version, snapshot }: Aggregation) {
    const key = this.builtKey()
    if (!key || version.split("|").includes("none")) return

    const built: BuiltSnapshot = { version, snapshot }
    const startedAt = performance.now()
    await this.cache.writeShared(key, built, BUILT_SNAPSHOT_TTL_SECONDS)
    // Logged under the request that built it only while the platform keeps the instance alive
    // past the response, so it shows whether the after-response save finishes.
    console.info(
      `[aggregator] saved the built snapshot in ${Math.round(performance.now() - startedAt)} ms`,
    )
  }

  private async readMetricSource(source: MetricSource<SourcePayload<unknown>, unknown>) {
    return metricSourceInput(source, await this.cache.read(source))
  }

  /** Builds the report once per aggregation and writes its one log line. */
  private reportFor(aggregation: FullAggregation) {
    if (!aggregation.report) {
      aggregation.report = buildDiagnostics(aggregation.derivation)
      console.info(diagnosticsLogLine(aggregation.report, aggregation.snapshot.entries.length))
    }

    return aggregation.report
  }
}

/** Each stored source's fetch time, by cache key. */
function stampsOf(inputs: AggregatorInputs) {
  const fetchedAt = [
    ...inputs.metricSources.map((input) => input.fetchedAt),
    inputs.catalog.fetchedAt,
  ]

  return Object.fromEntries(
    SOURCES.flatMap((source, index) => {
      const stamp = fetchedAt[index]
      return stamp ? [[source.cacheKey, stamp]] : []
    }),
  )
}

export type { ModelEntry, ModelSnapshot, ModelVariant } from "./model-aggregator.types"
export type { MetricKey, ReasoningMode } from "../providers"
