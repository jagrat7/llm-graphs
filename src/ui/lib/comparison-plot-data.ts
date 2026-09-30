import type { Metric } from "#/ui/lib/metrics"
import type { Model } from "#/ui/lib/model-view"

import { METRIC_CONFIG } from "#/ui/lib/metrics"

export const PLOT_AXES_2D = ["x", "y"] as const
export const PLOT_AXES_3D = ["x", "y", "z"] as const

export type PlotAxis = (typeof PLOT_AXES_3D)[number]

/** A missing `z` keeps the plot two-dimensional; both renderers read the same shape. */
export type PlotMetrics = { x: Metric; y: Metric; z?: Metric | null }

export type PlotDomain = { min: number; max: number }

export type PlotPoint = {
  id: string
  /** Stable render order, also the index used by the keyboard point list. */
  index: number
  label: string
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
  return model.effort === "default" ? model.displayName : `${model.displayName} [${model.effort}]`
}

/** 0.5 for a flat domain keeps single-valued axes centred instead of dividing by zero. */
function normalize(value: number, domain: PlotDomain) {
  const span = domain.max - domain.min

  return span === 0 ? 0.5 : (value - domain.min) / span
}

/** Widens a domain by a share of its span so marks never sit on the frame. */
export function padDomain(domain: PlotDomain, ratio: number): PlotDomain {
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

/**
 * Renderer-neutral plot model: one O(n) pass over the models produces the points,
 * per-axis domains, per-model series and the id lookup that both the Visx and the
 * React Three Fiber charts read. Keeping it here is what makes the two renderers
 * agree on ordering, normalization and exclusions.
 */
export function buildPlotData(models: Array<Model>, metrics: PlotMetrics): PlotData {
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
    const point: PlotPoint = {
      id: `${model.model}-${model.mode}-${model.level}`,
      index: points.length,
      label: pointLabel(model),
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

    const series = seriesByModel.get(model.model)

    if (series) series.points.push(point)
    else {
      seriesByModel.set(model.model, {
        key: model.model,
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

  for (const point of points) {
    for (const axis of axes) point.unit[axis] = normalize(point.values[axis], domains[axis])
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
