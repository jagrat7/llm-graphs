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
 * one small read, and rebuilds only when a stamp moved. A cold instance first tries the snapshot
 * another instance of the same deploy built, so serverless cold starts skip the build.
 */
export class ModelAggregatorService {
  private latest: Aggregation | null = null
  private checkedAt = Number.NEGATIVE_INFINITY
  /** One check at a time, however many requests arrive while it runs. */
  private checking: Promise<Aggregation> | undefined

  constructor(
    private readonly cache = new SourceCache(),
    /** Names the code that built a snapshot, so no build reuses or tags one an older build made. */
    private readonly buildId: string = import.meta.env.BUILD_ID,
    private readonly now: () => number = Date.now,
    /** Off in dev, so each restart doesn't leave its own copy in Redis for a week. */
    private readonly shareBuilt: boolean = !import.meta.env.DEV,
  ) {}

  async getSnapshot(): Promise<ModelSnapshot> {
    return (await this.current()).snapshot
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

    // A source with no stamp has a copy stored before stamps existed, or none: read them all.
    if (SOURCES.some((source) => stamps[source.cacheKey] == null)) return this.rebuild()

    const version = SOURCES.map((source) => stamps[source.cacheKey]).join("|")
    if (this.latest?.version === version) return this.latest

    const built = await this.readBuilt()
    if (built?.version === version) {
      this.latest = { ...built, derivation: null, report: null }
      return this.latest
    }

    return this.rebuild()
  }

  /** Reads every source's payload and builds the snapshot, as each request used to. */
  private async rebuild(): Promise<FullAggregation> {
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

    // Awaited rather than left running: a serverless instance can freeze once it responds.
    await Promise.all([this.cache.recordStamps(stampsOf(inputs)), this.writeBuilt(rebuilt)])
    // The report costs several times the aggregation, so it runs after the snapshot is served.
    setTimeout(() => this.reportFor(rebuilt), 0)

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
    await this.cache.writeShared(key, built, BUILT_SNAPSHOT_TTL_SECONDS)
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
