import type { AxisState } from "#/ui/components/axis-controls"
import type { ProvidersInfo, ProviderName, ModelSnapshot } from "./orpc-client"
import type { MetricBinding } from "./model-view"
import { defaultPicks, offeredVariants } from "./model-view"
import { buildPlotData, plotQuality } from "./comparison-plot-data"
import { METRICS, METRIC_CONFIG, resolveSource, type Metric } from "./metrics"

export type GraphSearch = {
  x: Metric
  y: Metric
  z?: Metric
  xSource?: string
  ySource?: string
  zSource?: string
}
export const AXIS_SOURCE_KEY = { x: "xSource", y: "ySource", z: "zSource" } as const

export function axisSettings(search: GraphSearch, info: ProvidersInfo): AxisState {
  const scoreAxis = (["x", "y", "z"] as const).find((axis) => search[axis] === "score")
  const scoreSource =
    scoreAxis == null ? null : resolveSource("score", search[AXIS_SOURCE_KEY[scoreAxis]], info)
  const setting = (metric: Metric | null, source?: string) => ({
    metric,
    source: metric == null ? null : resolveSource(metric, source, info, scoreSource),
  })
  return {
    x: setting(search.x, search.xSource),
    y: setting(search.y, search.ySource),
    z: setting(search.z ?? null, search.zSource),
  }
}

export function axisBindings(axes: AxisState, info: ProvidersInfo): Array<MetricBinding> {
  return Object.values(axes).flatMap(({ metric, source }) =>
    metric == null || source == null
      ? []
      : [
          {
            metric: METRIC_CONFIG[metric].dataKey,
            source,
            scope: info.scopes[source][METRIC_CONFIG[metric].dataKey],
          },
        ],
  )
}

export function unavailableMetrics(axes: AxisState, info: ProvidersInfo) {
  return Object.values(axes).filter(
    ({ metric, source }) =>
      metric != null &&
      source != null &&
      !info.metricProviders[METRIC_CONFIG[metric].dataKey].includes(source),
  )
}

export function scoreSourceOf(axes: AxisState): ProviderName | null {
  return Object.values(axes).find((axis) => axis.metric === "score")?.source ?? null
}

/** Use the same measured configurations and variation checks as the rendered chart. */
export function hasMeaningfulComparison(
  search: GraphSearch,
  info: ProvidersInfo,
  snapshot: ModelSnapshot,
) {
  const axes = axisSettings(search, info)
  if (unavailableMetrics(axes, info).length) return false
  const bindings = axisBindings(axes, info)
  const offered = offeredVariants(snapshot, bindings)
  const picks = new Set(
    defaultPicks(
      snapshot,
      offered,
      scoreSourceOf(axes),
      info,
      bindings.map((b) => b.metric),
    ),
  )
  return plotQuality(
    buildPlotData(
      offered.filter((model) => picks.has(model.model)),
      search,
    ),
  ).meaningful
}

/** Switching benchmarks keeps the closest usable graph, rather than leaving incompatible axes. */
export function compatibleComparison(
  search: GraphSearch,
  info: ProvidersInfo,
  snapshot: ModelSnapshot,
): GraphSearch {
  if (hasMeaningfulComparison(search, info, snapshot)) return search
  const source = scoreSourceOf(axisSettings(search, info))
  if (source == null) return search
  const distance = (candidate: GraphSearch) =>
    (["x", "y", "z"] as const).reduce(
      (total, axis) =>
        total + (candidate[axis] === search[axis] ? 0 : search[axis] === "score" ? 4 : 1),
      0,
    )
  return (
    graphCases(info)
      .filter((item) => item.source === source && (search.z != null || item.search.z == null))
      .map((item) => item.search)
      .toSorted((a, b) => distance(a) - distance(b))
      .find((candidate) => hasMeaningfulComparison(candidate, info, snapshot)) ?? search
  )
}

/** Linear in provider count: all axis orders, with each selectable score benchmark. */
export function graphCases(info: ProvidersInfo) {
  const metrics = METRICS
  return metrics.flatMap((x) =>
    metrics
      .filter((y) => y !== x)
      .flatMap((y) =>
        [undefined, ...metrics.filter((z) => z !== x && z !== y)].flatMap((z) => {
          const scoreAxis = x === "score" ? "x" : y === "score" ? "y" : z === "score" ? "z" : null
          return (scoreAxis == null ? [null] : info.metricProviders.score).map((source) => {
            const search: GraphSearch = {
              x,
              y,
              ...(z ? { z } : {}),
              ...(scoreAxis && source ? { [AXIS_SOURCE_KEY[scoreAxis]]: source } : {}),
            }
            return { key: `${x}/${y}/${z ?? "2d"}/${source ?? "default"}`, search, source }
          })
        }),
      ),
  )
}
