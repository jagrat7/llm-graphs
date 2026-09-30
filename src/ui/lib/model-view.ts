import type {
  MetricKey,
  ProviderName,
  ReasoningMode,
  ModelSnapshot,
  ProvidersInfo,
} from "#/ui/lib/orpc-client"

import { metricProviders } from "#/ui/lib/metrics"

type ModelEntry = ModelSnapshot["entries"][number]
type ModelVariant = ModelSnapshot["variants"][ProviderName][number]

/** One model at one reasoning mode and effort level, with the metrics the view asked for. */
export type Model = {
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
  /** Short label for the variant; `default` when the source says nothing about effort. */
  effort: string
  effortOrder: number
  score: number | null
  costPerTask: number | null
  costPerMTokens: number | null
  tokensPerSecond: number | null
  durationSeconds: number | null
  /** Which source each metric value came from. */
  sources: Record<MetricKey, ProviderName | null>
}

/** A metric the view reads, and the source it reads it from. */
export type MetricBinding = {
  metric: MetricKey
  source: ProviderName
  /** A variant is offered only when every required source lists it. Defaults to true. */
  required?: boolean
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
    return mode === "on" ? "reasoning" : mode === "off" ? "non-reasoning" : "default"
  }

  return mode === "off" ? `${level} non-reasoning` : level
}

function variantKey(entryId: string, mode: ReasoningMode, level: string) {
  return `${entryId}\u0000${mode}/${level}`
}

function indexVariants(variants: ReadonlyArray<ModelVariant>, excludeRefused: boolean) {
  const index = new Map<string, ModelVariant>()

  for (const variant of variants) {
    if (excludeRefused && variant.refused) continue
    index.set(variantKey(variant.entryId, variant.mode, variant.level), variant)
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
      bindings.filter((binding) => binding.required !== false).map((binding) => binding.source),
    ),
  ]
  const [base, ...others] = required
  if (base == null) return []

  const joined = required.length > 1
  const indexes = new Map(
    [...new Set(bindings.map((binding) => binding.source))].map((source) => [
      source,
      indexVariants(snapshot.variants[source], joined),
    ]),
  )
  const entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]))
  const models: Array<Model> = []

  for (const variant of snapshot.variants[base]) {
    if (joined && variant.refused) continue

    const key = variantKey(variant.entryId, variant.mode, variant.level)
    if (others.some((source) => !indexes.get(source)?.has(key))) continue

    const entry = entries.get(variant.entryId)
    if (!entry) continue

    models.push(toModel(entry, variant, bindings, indexes, snapshot.logos))
  }

  return models
}

function toModel(
  entry: ModelEntry,
  variant: ModelVariant,
  bindings: ReadonlyArray<MetricBinding>,
  indexes: Map<ProviderName, Map<string, ModelVariant>>,
  logos: Record<string, string>,
): Model {
  const values: Record<MetricKey, number | null> = {
    score: null,
    costPerTask: null,
    costPerMTokens: null,
    tokensPerSecond: null,
    durationSeconds: null,
  }
  const sources: Record<MetricKey, ProviderName | null> = {
    score: null,
    costPerTask: null,
    costPerMTokens: null,
    tokensPerSecond: null,
    durationSeconds: null,
  }
  const key = variantKey(variant.entryId, variant.mode, variant.level)

  for (const binding of bindings) {
    const value = indexes.get(binding.source)?.get(key)?.metrics[binding.metric]
    if (value == null) continue

    values[binding.metric] = value
    sources[binding.metric] = binding.source
  }

  return {
    model: entry.id,
    displayName: entry.name,
    vendor: entry.vendor,
    releaseDate: entry.releaseDate,
    chartColor: vendorColor(entry.hue),
    logoUrl: logoDataUrl(entry.vendor == null ? undefined : logos[entry.vendor]),
    mode: variant.mode,
    level: variant.level,
    effort: effortLabel(variant.mode, variant.level),
    effortOrder: variant.effortOrder,
    ...values,
    sources,
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

  for (const [entryId, score] of scores) {
    const below = sorted.findIndex((value) => value >= score)
    result.set(entryId, sorted.length > 1 ? below / (sorted.length - 1) : 1)
  }

  return result
}

/**
 * How strong each entry is: its best score on the Score axis's source, or, with Score off the
 * chart, its average percentile across every score source that lists it.
 */
function strengths(snapshot: ModelSnapshot, scoreSource: ProviderName | null, info: ProvidersInfo) {
  if (scoreSource != null) return bestScores(snapshot, scoreSource)

  const totals = new Map<string, { sum: number; count: number }>()

  for (const source of metricProviders("score", info)) {
    for (const [entryId, percentile] of percentiles(bestScores(snapshot, source))) {
      const total = totals.get(entryId) ?? { sum: 0, count: 0 }
      totals.set(entryId, { sum: total.sum + percentile, count: total.count + 1 })
    }
  }

  return new Map([...totals].map(([entryId, { sum, count }]) => [entryId, sum / count]))
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

  return [...bestByVendor.values()]
    .toSorted(compareCandidates)
    .slice(0, DEFAULT_VENDOR_COUNT)
    .map((candidate) => candidate.id)
}
