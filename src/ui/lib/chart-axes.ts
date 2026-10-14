import type { PlotData } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

import { CHART_AXIS_TITLE_SIZE, CHART_TICK_SIZE } from "#/ui/lib/chart-styles"
import { metricAxisTitle } from "#/ui/lib/metrics"

/**
 * Axis styling shared by the 2D views. Titles use the foreground colour rather than the
 * muted one so the axis caption reads at a glance; ticks stay muted under them.
 */
export function axisPresentation<TValue>(
  label: string,
  format: (value: TValue) => string,
  spacing?: number,
  /** Exact tick values, for axes whose round numbers are not the scale's 1-2-5 steps. */
  values?: ReadonlyArray<TValue>,
) {
  return {
    line: { stroke: "var(--border)" },
    // The library takes one tick policy: exact values when given, otherwise spacing.
    ticks: {
      ...(values ? { values } : { spacing }),
      format,
      line: { stroke: "var(--border)" },
    },
    tickLabels: { fontSize: CHART_TICK_SIZE, thin: true },
    label: {
      text: label,
      fontSize: CHART_AXIS_TITLE_SIZE,
      fontWeight: 500,
      fill: "var(--foreground)",
      opacity: 0.85,
    },
  }
}

/**
 * The full axis titles, provider notes included, for the chart's accessible
 * description. The visible captions are trimmed to name and unit, so this is where
 * "Score · % (DeepSWE v1.1 pass rate)" still lives.
 */
export function axisDescription(
  data: PlotData,
  sources: Record<"x" | "y", ProviderName | null>,
  info: ProvidersInfo,
) {
  return (["x", "y"] as const)
    .flatMap((axis) => {
      const metric = data.metrics[axis]

      return metric == null
        ? []
        : [
            `${axis === "x" ? "Horizontal" : "Vertical"} axis: ${metricAxisTitle(metric, sources[axis], info)}.`,
          ]
    })
    .join(" ")
}

export function rangeAxisDescription(
  data: PlotData,
  flat: "x" | "y",
  sources: Record<"x" | "y", ProviderName | null>,
  info: ProvidersInfo,
) {
  const spread = flat === "x" ? "y" : "x"
  const horizontal = metricAxisTitle(data.metrics[spread]!, sources[spread], info)
  const rowMetric = metricAxisTitle(data.metrics[flat]!, sources[flat], info)

  return `Horizontal axis: ${horizontal}. Vertical axis: model configurations, ordered by their minimum ${rowMetric}. Row captions show this metric's value or range across efforts. Each marker represents one effort; inspect it for both exact metric values.`
}
