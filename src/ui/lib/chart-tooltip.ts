import type { ChartPoint, ChartTooltipContent, ChartTooltipOptions } from "@tanstack/charts"

import { tooltip } from "@tanstack/charts/tooltip"
import { portal } from "@tanstack/charts/tooltip/portal"

import type { PlotData, PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

import { CHART_TOOLTIP_GAP } from "#/ui/lib/chart-styles"
import { formatMetric, metricPresentation } from "#/ui/lib/metrics"

/** Below this width the card stops chasing the pointer and sits in the top-right corner. */
export const PINNED_TOOLTIP_WIDTH = 640

/**
 * The text model behind the tooltip. The React card renders on top of it, but the
 * library announces this to assistive tech, so it carries the same identity (model,
 * effort, configuration) and the same units the card shows.
 */
export function pointTooltipContent(
  point: PlotPoint,
  data: PlotData,
  sources: Record<"x" | "y", ProviderName | null>,
  info: ProvidersInfo,
): ChartTooltipContent {
  return {
    title: point.label,
    color: point.color,
    rows: (["x", "y"] as const).flatMap((axis) => {
      const metric = data.metrics[axis]

      return metric == null
        ? []
        : [
            {
              label: metricPresentation(metric, sources[axis], info).label,
              value: formatMetric(point.values[axis], metric, sources[axis], info),
            },
          ]
    }),
  }
}

/**
 * The point a tooltip describes: the focused one when the host names it, otherwise the
 * first in the list. The announced text and the visible card both pick through here, so
 * they can never describe different efforts.
 */
export function focusedPoint(
  points: ReadonlyArray<ChartPoint<PlotPoint>>,
  primaryPoint: ChartPoint | undefined,
): PlotPoint | undefined {
  return (points.find((candidate) => candidate.key === primaryPoint?.key) ?? points[0])?.datum
}

/** Shared tooltip behaviour for every 2D comparison view. */
export function chartTooltip(
  data: PlotData,
  sources: Record<"x" | "y", ProviderName | null>,
  info: ProvidersInfo,
  {
    rows = false,
  }: {
    /**
     * The range view grows taller than the screen with its rows, so a card pinned to
     * the plot's top would scroll out of sight; it pins beside the focused row instead,
     * and is placed within the visible viewport rather than the whole chart.
     */
    rows?: boolean
  } = {},
) {
  return {
    use: tooltip,
    // Inspection follows focus only; the old chart never pinned a card on click or Enter.
    sticky: false,
    content: (points: ReadonlyArray<ChartPoint<PlotPoint>>, { primaryPoint }) => {
      const point = focusedPoint(points, primaryPoint)

      return point == null ? { rows: [] } : pointTooltipContent(point, data, sources, info)
    },
    // Narrow screens pin the card to the plot's right edge instead of the point: at the
    // top for the scatter, and on the focused row for ranges, opening below or above it.
    anchor: (_points, { focus, plot, surface }) =>
      surface.width < PINNED_TOOLTIP_WIDTH
        ? { x: plot.x + plot.width, y: rows ? focus.primary.y : plot.y }
        : { x: focus.primary.x, y: focus.primary.y },
    placement: rows
      ? ["right", "bottom-left", "top-left", "left"]
      : ["right", "left", "bottom-left", "top", "bottom"],
    offset: CHART_TOOLTIP_GAP,
    // The portal resolves placement against the viewport and follows page scroll, so a
    // card for a row near the screen's edge flips to the side that is actually visible.
    ...(rows ? { portal } : {}),
  } satisfies ChartTooltipOptions<PlotPoint> & { use: typeof tooltip }
}
