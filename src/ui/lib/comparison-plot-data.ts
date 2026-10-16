import type { Metric } from "#/ui/lib/metrics"
import type { Model } from "#/ui/lib/model-view"

import { METRIC_CONFIG } from "#/ui/lib/metrics"

export const PLOT_AXES_2D = ["x", "y"] as const
export const PLOT_AXES_3D = ["x", "y", "z"] as const

export type PlotAxis = (typeof PLOT_AXES_3D)[number]

/** A missing `z` keeps the plot two-dimensional; both renderers read the same shape. */
export type PlotMetrics = { x: Metric; y: Metric; z?: Metric | null }

export type PlotDomain = { min: number; max: number }

/** How an axis maps values to positions; see `axisScale` for when an axis goes log. */
export type AxisScale = "linear" | "log"

export type PlotPoint = {
  id: string
  /** Stable render order, also the index used by the keyboard point list. */
  index: number
  label: string
  /** `PlotSeries.key` of the run this point belongs to. */
  seriesKey: string
  color: string
  /** The vendor logo drawn as the marker; null draws a circle. */
  logoUrl: string | null
  model: Model
  /** Raw metric values. `z` is 0 while the plot is two-dimensional. */
  values: Record<PlotAxis, number>
  /** Domain-normalized 0–1 position per axis, safe for equal-value domains. */
  unit: Record<PlotAxis, number>
}

/** Effort variants of one model, drawn as a connected run. */
export type PlotSeries = {
  key: string
  /** Model name, drawn once for the whole run instead of on every point. */
  label: string
  color: string
  labelPlacement: "top" | "bottom"
  /** The one point that carries the model name; see `anchorPoint`. */
  anchorId: string
  points: Array<PlotPoint>
}

export type PlotData = {
  axes: ReadonlyArray<PlotAxis>
  metrics: Record<PlotAxis, Metric | null>
  points: Array<PlotPoint>
  series: Array<PlotSeries>
  domains: Record<PlotAxis, PlotDomain>
  /** The scale each axis is drawn on: the reader's choice where made, else `autoScales`. */
  scales: Record<PlotAxis, AxisScale>
  /** The scale `axisScale` picks for each axis from its values. */
  autoScales: Record<PlotAxis, AxisScale>
  /** Axes a reader may switch to log; see `logAllowed`. */
  logAllowed: Record<PlotAxis, boolean>
  pointById: Map<string, PlotPoint>
  /** Models dropped because a selected metric had no value. */
  excludedCount: number
  modelCount: number
  is3D: boolean
}

const EMPTY_DOMAIN: PlotDomain = { min: 0, max: 1 }
/** Geometric-mean thresholds that pick a 1 / 2 / 5 / 10 tick step. */
const STEP_10 = Math.sqrt(50)
const STEP_5 = Math.sqrt(10)
const STEP_2 = Math.sqrt(2)

function metricValue(model: Model, metric: Metric) {
  const value = model[METRIC_CONFIG[metric].dataKey]

  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** The effort every model is labelled at when it offers one, so runs read alike. */
const ANCHOR_EFFORT = "high"

/**
 * One point per run carries the name: the shared `high` tier when the model exposes it,
 * otherwise its top effort. Keeping the rule here is what makes single-effort models and
 * full runs annotate the same way in both renderers.
 */
function anchorPoint(points: Array<PlotPoint>) {
  return points.reduce((best, point) => {
    if (best.model.effort === ANCHOR_EFFORT) return best
    if (point.model.effort === ANCHOR_EFFORT) return point

    return point.model.effortOrder > best.model.effortOrder ? point : best
  })
}

function pointLabel(model: Model) {
  const label =
    model.effort === "default" ? model.displayName : `${model.displayName} [${model.effort}]`
  return model.configuration ? `${label} (${model.configuration})` : label
}

/** A log axis needs at least one decade of spread; below that it barely differs from linear. */
const LOG_MIN_RATIO = 10
/**
 * Where the median value sits along a linear axis, as a share of its span, below which
 * the axis counts as crowded: half the values squeezed into its bottom fifth.
 */
const LOG_CROWDED_MEDIAN = 0.2

/** Distinct values, ascending: repeated values share one position on an axis. */
function distinctSorted(values: Iterable<number>) {
  return Array.from(new Set(values)).toSorted((left, right) => left - right)
}

/**
 * Whether an axis can be drawn on a log scale at all: a ratio metric (see
 * `isRatioMetric`) with at least two distinct values, every one of them positive.
 */
export function logAllowed(ratio: boolean, values: Iterable<number>) {
  if (!ratio) return false

  const distinct = distinctSorted(values)

  return distinct.length >= 2 && distinct[0] > 0
}

/**
 * Whether an axis reads better on a log scale. It goes log only for ratio metrics (see
 * `isRatioMetric`) whose values are all positive, span at least a decade and crowd the
 * low end of a linear axis — one $600 model flattening every $1–$5 one. Evenly spread
 * values stay linear however wide their range, so differences keep reading as
 * differences.
 */
export function axisScale(ratio: boolean, values: Iterable<number>): AxisScale {
  if (!ratio) return "linear"

  const distinct = distinctSorted(values)

  if (distinct.length < 3 || distinct[0] <= 0) return "linear"

  const min = distinct[0]
  const max = distinct[distinct.length - 1]

  if (max / min < LOG_MIN_RATIO) return "linear"

  const middle = Math.floor(distinct.length / 2)
  const median =
    distinct.length % 2 === 1 ? distinct[middle] : (distinct[middle - 1] + distinct[middle]) / 2

  return (median - min) / (max - min) < LOG_CROWDED_MEDIAN ? "log" : "linear"
}

/**
 * A value's 0–1 position along an axis. 0.5 for a flat domain keeps single-valued axes
 * centred instead of dividing by zero.
 */
export function unitPosition(value: number, domain: PlotDomain, scale: AxisScale = "linear") {
  if (scale === "log") {
    const min = Math.log10(domain.min)
    const span = Math.log10(domain.max) - min

    return span === 0 ? 0.5 : (Math.log10(value) - min) / span
  }

  const span = domain.max - domain.min

  return span === 0 ? 0.5 : (value - domain.min) / span
}

/**
 * Widens a domain by a share of its span so marks never sit on the frame. A log domain
 * is widened by a share of its decades, so it never reaches zero.
 */
export function padDomain(
  domain: PlotDomain,
  ratio: number,
  scale: AxisScale = "linear",
): PlotDomain {
  if (scale === "log") {
    const min = Math.log10(domain.min)
    const max = Math.log10(domain.max)
    const pad = (max - min) * ratio || ratio

    return { min: 10 ** (min - pad), max: 10 ** (max + pad) }
  }

  const span = domain.max - domain.min

  if (span === 0) {
    const fallback = Math.abs(domain.min) * ratio || 1

    return { min: domain.min - fallback, max: domain.max + fallback }
  }

  return { min: domain.min - span * ratio, max: domain.max + span * ratio }
}

/**
 * Round tick values inside a domain, stepping by 1, 2 or 5 times a power of ten —
 * the same shape `d3-scale` produces, without pulling a scale into the 3D bundle.
 */
export function axisTicks(domain: PlotDomain, count: number) {
  const span = domain.max - domain.min

  if (!(span > 0) || count < 1) return [domain.min]

  const magnitude = 10 ** Math.floor(Math.log10(span / count))
  const normalized = span / count / magnitude
  const step =
    (normalized >= STEP_10 ? 10 : normalized >= STEP_5 ? 5 : normalized >= STEP_2 ? 2 : 1) *
    magnitude
  // Round to the step's own precision so 0.6000000000000001 never reaches a label.
  const precision = Math.max(0, -Math.floor(Math.log10(step)))
  const start = Math.ceil(domain.min / step) * step
  const epsilon = step * 1e-6
  const ticks: Array<number> = []

  for (let index = 0; ; index += 1) {
    const value = start + index * step

    if (value > domain.max + epsilon) break

    ticks.push(Number(value.toFixed(precision)))
  }

  return ticks
}

/** Clock-friendly steps for a duration axis, in seconds: seconds, minutes, then hours. */
const TIME_STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10_800, 21_600, 43_200, 86_400,
]
const DAY = 86_400

/**
 * Tick values for a duration axis. A 1-2-5 step in seconds lands on labels like
 * "8m 20s"; these steps land on whole minutes and hours, and never go below zero.
 */
export function timeTicks(domain: PlotDomain, count: number) {
  const span = domain.max - domain.min

  if (!(span > 0) || count < 1) return [Math.max(0, domain.min)]

  const step =
    TIME_STEPS.find((candidate) => span / candidate <= count) ?? Math.ceil(span / count / DAY) * DAY
  const ticks: Array<number> = []

  for (
    let value = Math.max(0, Math.ceil(domain.min / step) * step);
    value <= domain.max + step * 1e-6;
    value += step
  ) {
    ticks.push(value)
  }

  return ticks
}

/**
 * How far a log axis may tighten its tick spacing to reach three ticks. Two thirds still
 * admits 1-2-5 steps (0.3 decades apart) without crowding 10m next to 15m.
 */
const LOG_TICK_RELAX = 2 / 3

/** Duration steps a log axis prefers, one per rough decade: 1s, 10s, 1m, 10m, 1h, 10h, 1d. */
const TIME_DECADES = [1, 10, 60, 600, 3600, 36_000, DAY, 10 * DAY]
/** Half-decade clock steps come first, as 5× does between powers of ten, then the rest. */
const TIME_FILLERS = [5, 30, 300, 1800, 21_600, 5 * DAY, ...TIME_STEPS, 2 * DAY]

/** `multiplier × 10^n` for every power of ten that could fall inside the domain. */
function decadeMultiples(domain: PlotDomain, multipliers: ReadonlyArray<number>) {
  const values: Array<number> = []

  for (
    let exponent = Math.floor(Math.log10(domain.min));
    exponent <= Math.ceil(Math.log10(domain.max));
    exponent += 1
  ) {
    // toPrecision drops float noise such as 0.30000000000000004 before it reaches a label.
    for (const multiplier of multipliers)
      values.push(Number((multiplier * 10 ** exponent).toPrecision(12)))
  }

  return values
}

/**
 * Tick values for a log axis. Powers of ten come first (or whole clock decades for a
 * duration); when fewer than three fit, 5× and 2× steps fill the gaps, each kept only
 * if it sits at least a `count`th of the axis away from every tick already chosen, so
 * labels stay evenly spaced on screen. That spacing loosens when it would leave two ticks.
 */
export function logTicks(metric: Metric | null, domain: PlotDomain, count: number) {
  if (!(domain.min > 0) || !(domain.max > domain.min) || count < 1) return [domain.min]

  const inside = (value: number) => value >= domain.min && value <= domain.max
  const duration = metric === "duration"
  const primary = (duration ? TIME_DECADES : decadeMultiples(domain, [1])).filter(inside)

  if (primary.length >= 3) {
    // `count` is a number of intervals, so it allows one more tick than that.
    const stride = Math.ceil((primary.length - 1) / count)

    return primary.filter((_, index) => index % stride === 0)
  }

  const span = Math.log10(domain.max / domain.min)
  const fillers = (
    duration ? TIME_FILLERS : [...decadeMultiples(domain, [5]), ...decadeMultiples(domain, [2])]
  ).filter(inside)
  const fill = (minGap: number) => {
    const picked = [...primary]

    for (const value of fillers) {
      if (picked.every((tick) => Math.abs(Math.log10(value / tick)) >= minGap)) picked.push(value)
    }

    return picked
  }
  const spaced = fill(span / count)
  // Two ticks cannot show the scale is logarithmic; loosen the spacing for a third.
  const picked = spaced.length >= 3 ? spaced : fill((span / count) * LOG_TICK_RELAX)

  return picked.length >= 2
    ? picked.toSorted((left, right) => left - right)
    : duration
      ? timeTicks(domain, count)
      : axisTicks(domain, count)
}

/**
 * Round tick values for a metric's axis: log steps on a log axis, clock steps for
 * durations, 1-2-5 steps otherwise.
 */
export function metricTicks(
  metric: Metric | null,
  domain: PlotDomain,
  count: number,
  scale: AxisScale = "linear",
) {
  if (scale === "log") return logTicks(metric, domain, count)

  return metric === "duration" ? timeTicks(domain, count) : axisTicks(domain, count)
}

function byAxis<T>(pick: (axis: PlotAxis) => T): Record<PlotAxis, T> {
  return { x: pick("x"), y: pick("y"), z: pick("z") }
}

/**
 * Renderer-neutral plot model: one O(n) pass over the models produces the points,
 * per-axis domains, per-model series and the id lookup that both the TanStack Charts and the
 * React Three Fiber charts read. Keeping it here is what makes the two renderers
 * agree on ordering, normalization, axis scales and exclusions.
 *
 * `ratio` marks the axes whose metric may go log (see `isRatioMetric`); an axis it
 * leaves out falls back to the metric's own `ratio` flag. `scale` holds the reader's
 * choice per axis, which wins over detection wherever the axis allows log.
 */
export function buildPlotData(
  models: Array<Model>,
  metrics: PlotMetrics,
  ratio: Partial<Record<PlotAxis, boolean>> = {},
  scale: Partial<Record<PlotAxis, AxisScale>> = {},
): PlotData {
  const zMetric = metrics.z ?? null
  const is3D = zMetric != null
  const axes = is3D ? PLOT_AXES_3D : PLOT_AXES_2D
  const resolved: Record<PlotAxis, Metric | null> = { x: metrics.x, y: metrics.y, z: zMetric }
  const bounds: Record<PlotAxis, PlotDomain> = {
    x: { min: Infinity, max: -Infinity },
    y: { min: Infinity, max: -Infinity },
    z: { min: Infinity, max: -Infinity },
  }
  const seriesByModel = new Map<string, PlotSeries>()
  const pointById = new Map<string, PlotPoint>()
  const points: Array<PlotPoint> = []
  const modelKeys = new Set<string>()

  for (const model of models) {
    const x = metricValue(model, metrics.x)
    const y = metricValue(model, metrics.y)
    const z = zMetric == null ? 0 : metricValue(model, zMetric)

    if (x == null || y == null || z == null) continue

    const values: Record<PlotAxis, number> = { x, y, z }
    const seriesKey = `${model.model}${model.configuration ? `/${model.configuration}` : ""}`
    const point: PlotPoint = {
      id: `${model.model}-${model.mode}-${model.level}${model.configuration ? `-${model.configuration}` : ""}`,
      index: points.length,
      label: pointLabel(model),
      seriesKey,
      color: model.chartColor,
      logoUrl: model.logoUrl,
      model,
      values,
      unit: { x: 0, y: 0, z: 0 },
    }

    for (const axis of axes) {
      bounds[axis].min = Math.min(bounds[axis].min, values[axis])
      bounds[axis].max = Math.max(bounds[axis].max, values[axis])
    }

    points.push(point)
    pointById.set(point.id, point)
    modelKeys.add(model.model)

    const series = seriesByModel.get(seriesKey)

    if (series) series.points.push(point)
    else {
      seriesByModel.set(seriesKey, {
        key: seriesKey,
        label: model.displayName,
        color: model.chartColor,
        labelPlacement: "top",
        anchorId: point.id,
        points: [point],
      })
    }
  }

  const domains: Record<PlotAxis, PlotDomain> = {
    x: points.length > 0 ? bounds.x : EMPTY_DOMAIN,
    y: points.length > 0 ? bounds.y : EMPTY_DOMAIN,
    z: is3D && points.length > 0 ? bounds.z : EMPTY_DOMAIN,
  }

  // A 2D plot resolves no z metric, so its z axis stays linear.
  const ratioOf = (axis: PlotAxis) => {
    const metric = resolved[axis]

    return metric != null && (ratio[axis] ?? METRIC_CONFIG[metric].ratio === true)
  }
  const valuesOf = (axis: PlotAxis) => points.map((point) => point.values[axis])
  const autoScales = byAxis((axis) => axisScale(ratioOf(axis), valuesOf(axis)))
  const allowed = byAxis((axis) => logAllowed(ratioOf(axis), valuesOf(axis)))
  const scales = byAxis((axis) => (allowed[axis] ? (scale[axis] ?? autoScales[axis]) : "linear"))

  for (const point of points) {
    for (const axis of axes)
      point.unit[axis] = unitPosition(point.values[axis], domains[axis], scales[axis])
  }

  // Alternating placement per vendor spreads labels apart before collision culling.
  const vendorOccurrences = new Map<string | null, number>()
  const series = Array.from(seriesByModel.values(), (modelSeries) => {
    const vendor = modelSeries.points[0].model.vendor
    const occurrence = vendorOccurrences.get(vendor) ?? 0

    vendorOccurrences.set(vendor, occurrence + 1)
    modelSeries.labelPlacement = occurrence % 2 === 0 ? "top" : "bottom"
    modelSeries.points.sort((left, right) => left.model.effortOrder - right.model.effortOrder)
    modelSeries.anchorId = anchorPoint(modelSeries.points).id

    return modelSeries
  })

  return {
    axes,
    metrics: resolved,
    points,
    series,
    domains,
    scales,
    autoScales,
    logAllowed: allowed,
    pointById,
    excludedCount: models.length - points.length,
    modelCount: modelKeys.size,
    is3D,
  }
}

/** Screen-reader summary shared by both renderers. */
export function describePlot(data: PlotData) {
  const modelNoun = data.modelCount === 1 ? "model" : "models"
  const variantNoun = data.points.length === 1 ? "variant" : "variants"
  const axisSummary = data.axes
    .map((axis) => {
      const metric = data.metrics[axis]

      return metric == null ? null : `${axis.toUpperCase()} ${METRIC_CONFIG[metric].label}`
    })
    .filter((entry): entry is string => entry != null)
    .join(", ")

  return `${data.is3D ? "3D" : "2D"} scatter plot of ${data.modelCount} ${modelNoun} (${data.points.length} effort ${variantNoun}) by ${axisSummary}. Use arrow keys to move between points.`
}

/** Variation is evidence, not padding: flat axes never pass a meaningful-comparison audit. */
export function plotQuality(data: PlotData) {
  const axes = data.axes.map((axis) => {
    const counts = new Map<number, number>()
    for (const point of data.points)
      counts.set(point.values[axis], (counts.get(point.values[axis]) ?? 0) + 1)
    return {
      axis,
      distinctValues: counts.size,
      largestShare:
        data.points.length === 0 ? 0 : Math.max(...counts.values()) / data.points.length,
    }
  })
  const flatAxes = axes.filter((axis) => axis.distinctValues < 2).map((axis) => axis.axis)
  const distinctPoints = new Set(
    data.points.map((point) => data.axes.map((axis) => point.values[axis]).join("/")),
  ).size
  return {
    axes,
    flatAxes,
    distinctPoints,
    meaningful: data.modelCount > 1 && flatAxes.length === 0,
  }
}
