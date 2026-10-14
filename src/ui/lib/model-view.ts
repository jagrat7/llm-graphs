import type {
  MetricKey,
  ProviderName,
  ReasoningMode,
  ModelSnapshot,
  ProvidersInfo,
} from "#/ui/lib/orpc-client"

import { metricProviders, metricRecord } from "#/ui/lib/metrics"

type ModelEntry = ModelSnapshot["entries"][number]
type ModelVariant = ModelSnapshot["variants"][ProviderName][number]

/** One model at one reasoning mode and effort level, with the metrics the view asked for. */
export type Model = Record<MetricKey, number | null> & {
  /** The model entry id, which `?models=` stores. */
  model: string
  displayName: string
  vendor: string | null
  releaseDate: string | null
  /** The vendor's hue as a CSS colour; a neutral grey for an unknown vendor. */
  chartColor: string
  /** A `data:` URL of the vendor's logo, or null when it has none. */
  logoUrl: string | null
  mode: ReasoningMode
  level: string
  configuration?: string
  /** Published effort label; unreported reasoning settings are stated explicitly. */
  effort: string
  effortOrder: number
  /** Which source each metric value came from. */
  sources: Record<MetricKey, ProviderName | null>
  measurements?: ModelVariant["measurements"]
}

/** A metric the view reads, and the source it reads it from. */
export type MetricBinding = {
  metric: MetricKey
  source: ProviderName
  /** A variant is offered only when every required source lists it. Defaults to true. */
  required?: boolean
  scope?: "model"
}

/** How many vendors the chart opens on. */
export const DEFAULT_VENDOR_COUNT = 6

export function vendorColor(hue: number | null) {
  return hue == null ? "var(--vendor-unknown)" : `oklch(var(--vendor-l) var(--vendor-c) ${hue})`
}

export function logoDataUrl(svg: string | undefined) {
  return svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : null
}

export function effortLabel(mode: ReasoningMode, level: string) {
  if (level === "unknown") {
    return mode === "on"
      ? "reasoning, effort not reported"
      : mode === "off"
        ? "non-reasoning"
        : "reasoning not reported"
  }

  return mode === "off" ? `${level} non-reasoning` : level
}

function variantKey(entryId: string, mode: ReasoningMode, level: string, configuration?: string) {
  return `${entryId}\u0000${mode}/${level}/${configuration ?? ""}`
}

function indexVariants(variants: ReadonlyArray<ModelVariant>, excludeRefused: boolean) {
  const index = new Map<string, ModelVariant>()

  for (const variant of variants) {
    if (excludeRefused && (variant.refused || variant.configurationKnown === false)) continue
    index.set(
      variantKey(variant.entryId, variant.mode, variant.level, variant.configuration),
      variant,
    )
  }

  return index
}

/**
 * The variants a view can draw: those every required source lists at the same model, mode, and
 * level. There is no nearest-effort fallback. Optional sources only fill in values they have.
 */
export function offeredVariants(
  snapshot: ModelSnapshot,
  bindings: ReadonlyArray<MetricBinding>,
): Array<Model> {
  const required = [
    ...new Set(
      bindings
        .filter((binding) => binding.required !== false && binding.scope !== "model")
        .map((binding) => binding.source),
    ),
  ]
  if (required.length === 0 && bindings[0]) required.push(bindings[0].source)
  const [base, ...others] = required
  if (base == null) return []

  const joined = required.length > 1
  const indexes = new Map(
    [...new Set(bindings.map((binding) => binding.source))].map((source) => [
      source,
      indexVariants(snapshot.variants[source], joined || source !== base),
    ]),
  )
  const modelValues = new Map<string, number | null>()
  for (const binding of bindings.filter((candidate) => candidate.scope === "model")) {
    const groups = new Map<string, Set<number | null | undefined>>()
    for (const row of snapshot.variants[binding.source]) {
      if (row.refused) continue
      const values = groups.get(row.entryId) ?? new Set()
      values.add(row.metrics[binding.metric])
      groups.set(row.entryId, values)
    }
    for (const [id, values] of groups) {
      const value = values.size === 1 ? [...values][0] : null
      modelValues.set(`${binding.source}/${binding.metric}/${id}`, value ?? null)
    }
  }
  const entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]))
  const logos = Object.fromEntries(
    Object.entries(snapshot.logos).map(([vendor, svg]) => [vendor, logoDataUrl(svg)]),
  )
  const models: Array<Model> = []

  for (const variant of snapshot.variants[base]) {
    if (joined && (variant.refused || variant.configurationKnown === false)) continue

    const key = variantKey(variant.entryId, variant.mode, variant.level, variant.configuration)
    if (others.some((source) => !indexes.get(source)?.has(key))) continue

    const entry = entries.get(variant.entryId)
    if (!entry) continue

    const model = toModel(entry, variant, base, bindings, indexes, logos, modelValues)
    if (
      bindings.some(
        (binding) =>
          binding.required !== false &&
          (model[binding.metric] == null || !Number.isFinite(model[binding.metric])),
      )
    )
      continue
    models.push(model)
  }

  return models
}

const emptyMetrics = metricRecord(() => null)

function toModel(
  entry: ModelEntry,
  variant: ModelVariant,
  base: ProviderName,
  bindings: ReadonlyArray<MetricBinding>,
  indexes: Map<ProviderName, Map<string, ModelVariant>>,
  logos: Record<string, string | null>,
  modelValues: Map<string, number | null>,
): Model {
  const values: Record<MetricKey, number | null> = { ...emptyMetrics }
  const sources: Record<MetricKey, ProviderName | null> = { ...emptyMetrics }
  const key = variantKey(variant.entryId, variant.mode, variant.level, variant.configuration)
  const measurements: NonNullable<ModelVariant["measurements"]> = {}

  for (const binding of bindings) {
    // Two unspecified configurations do not establish an exact pricing match.
    const measured =
      binding.scope === "model" && binding.source !== base && variant.configurationKnown === false
        ? undefined
        : indexes.get(binding.source)?.get(key)
    let value = measured?.metrics[binding.metric]
    if (value == null && binding.scope === "model") {
      value = modelValues.get(`${binding.source}/${binding.metric}/${variant.entryId}`)
    }
    if (value == null || !Number.isFinite(value)) continue

    values[binding.metric] = value
    sources[binding.metric] = binding.source
    const measurement = measured?.measurements?.[binding.metric]
    if (measurement) measurements[binding.metric] = measurement
  }

  return {
    model: entry.id,
    displayName: entry.name,
    vendor: entry.vendor,
    releaseDate: entry.releaseDate,
    chartColor: vendorColor(entry.hue),
    logoUrl: entry.vendor == null ? null : (logos[entry.vendor] ?? null),
    mode: variant.mode,
    level: variant.level,
    ...(variant.configuration ? { configuration: variant.configuration } : {}),
    effort: effortLabel(variant.mode, variant.level),
    effortOrder: variant.effortOrder,
    ...values,
    sources,
    ...(Object.keys(measurements).length ? { measurements } : {}),
  }
}

/** Each entry's best score in one source. */
function bestScores(snapshot: ModelSnapshot, source: ProviderName) {
  const best = new Map<string, number>()

  for (const variant of snapshot.variants[source]) {
    const score = variant.metrics.score
    if (score == null) continue
    best.set(variant.entryId, Math.max(score, best.get(variant.entryId) ?? -Infinity))
  }

  return best
}

/** Each entry's percentile in one source's full list: the share of entries scoring below it. */
function percentiles(scores: Map<string, number>) {
  const sorted = [...scores.values()].toSorted((left, right) => left - right)
  const result = new Map<string, number>()
  const firstRank = new Map<number, number>()
  sorted.forEach((score, index) => {
    if (!firstRank.has(score)) firstRank.set(score, index)
  })

  for (const [entryId, score] of scores) {
    const below = firstRank.get(score)!
    result.set(entryId, sorted.length > 1 ? below / (sorted.length - 1) : 1)
  }

  return result
}

const strengthCache = new WeakMap<ModelSnapshot, Map<string, Map<string, number>>>()

/**
 * How strong each entry is: its best score on the Score axis's source, or, with Score off the
 * chart, its average percentile across every score source that lists it.
 */
function strengths(snapshot: ModelSnapshot, scoreSource: ProviderName | null, info: ProvidersInfo) {
  // Snapshots are immutable; changing axes should reuse the same source rankings.
  const cached = strengthCache.get(snapshot) ?? new Map<string, Map<string, number>>()
  strengthCache.set(snapshot, cached)
  const key = scoreSource ?? `average:${metricProviders("score", info).join("|")}`
  const existing = cached.get(key)
  if (existing) return existing
  if (scoreSource != null) {
    const result = bestScores(snapshot, scoreSource)
    cached.set(key, result)
    return result
  }

  const totals = new Map<string, { sum: number; count: number }>()

  for (const source of metricProviders("score", info)) {
    for (const [entryId, percentile] of percentiles(bestScores(snapshot, source))) {
      const total = totals.get(entryId) ?? { sum: 0, count: 0 }
      totals.set(entryId, { sum: total.sum + percentile, count: total.count + 1 })
    }
  }

  const result = new Map([...totals].map(([entryId, { sum, count }]) => [entryId, sum / count]))
  cached.set(key, result)
  return result
}

type Candidate = { id: string; strength: number; releaseDate: string | null }

/** Stronger first; ties go to the newer release, then to the id. Undated sorts last. */
function compareCandidates(left: Candidate, right: Candidate) {
  return (
    right.strength - left.strength ||
    (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "") ||
    left.id.localeCompare(right.id)
  )
}

/**
 * The models the chart opens on: each vendor's strongest model among those offered, for the six
 * strongest vendors. A model no score source lists is never pre-selected.
 */
export function defaultPicks(
  snapshot: ModelSnapshot,
  offered: ReadonlyArray<Model>,
  scoreSource: ProviderName | null,
  info: ProvidersInfo,
  metrics: ReadonlyArray<MetricKey> = [],
) {
  const strength = strengths(snapshot, scoreSource, info)
  const bestByVendor = new Map<string, Candidate>()

  for (const model of offered) {
    const value = strength.get(model.model)
    if (value == null) continue

    const candidate = { id: model.model, strength: value, releaseDate: model.releaseDate }
    // An unknown vendor counts as its own vendor.
    const vendor = model.vendor ?? `unknown:${model.model}`
    const best = bestByVendor.get(vendor)
    if (!best || compareCandidates(candidate, best) < 0) bestByVendor.set(vendor, candidate)
  }

  const picks = [...bestByVendor.values()]
    .toSorted(compareCandidates)
    .slice(0, DEFAULT_VENDOR_COUNT)
    .map((candidate) => candidate.id)
  // Extend only a degenerate default selection; never jitter or alter published measurements.
  for (const metric of metrics) {
    const values = new Set(
      offered.filter((model) => picks.includes(model.model)).map((model) => model[metric]),
    )
    if (values.size !== 1) continue
    const different = offered
      .filter((model) => strength.has(model.model) && !values.has(model[metric]))
      .toSorted(
        (a, b) => (strength.get(b.model) ?? -Infinity) - (strength.get(a.model) ?? -Infinity),
      )[0]
    if (different && !picks.includes(different.model)) picks.push(different.model)
  }
  return picks
}
