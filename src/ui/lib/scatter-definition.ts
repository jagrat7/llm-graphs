import { defineChart } from "@tanstack/charts"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { scaleLog } from "d3-scale"

import type { PlotData } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/server/api"

import {
  modelLabelsMark,
  modelRunsMark,
  paperRulingsMark,
  paretoFrontierMark,
  pointGuidesMark,
} from "#/ui/lib/chart-marks"
import { CHART_GRID_MINOR_OPACITY, CHART_GRID_OPACITY } from "#/ui/lib/chart-styles"
import { axisPresentation } from "#/ui/lib/chart-axes"
import { chartTooltip } from "#/ui/lib/chart-tooltip"
import { metricTicks, padDomain } from "#/ui/lib/comparison-plot-data"
import { formatMetric, metricAxisLabel } from "#/ui/lib/metrics"
import { drawnFrontier } from "#/ui/lib/pareto"

const DOMAIN_PAD = 0.08
/** Minimum pixels between ticks — larger spacing means fewer, calmer axis markers. */
const TICK_SPACING_X = 220
const TICK_SPACING_Y = 120
/** Interval counts for axes that pick their own steps: durations and log axes. */
const TICK_INTERVALS = { x: 5, y: 4 }
/** Ring drawn around the active marker; clears a logo's box with a little air. */
const FOCUS_RING_RADIUS = 13

/**
 * The 2D comparison as a TanStack Charts definition: dashed guides to both axes for the
 * active point, the Pareto frontier when the metrics trade off and the reader has it on,
 * each model's effort run, then the model names on top. A drawn frontier mutes every
 * variant off it.
 */
export function scatterDefinition(
  data: PlotData,
  {
    highlight,
    info,
    logoClass,
    sources,
    frontier = true,
  }: {
    highlight: string | null
    info: ProvidersInfo
    logoClass: Map<string, string>
    sources: Record<"x" | "y", ProviderName | null>
    /** Whether to draw the Pareto frontier, where the metrics have one. */
    frontier?: boolean
  },
) {
  const xMetric = data.metrics.x!
  const yMetric = data.metrics.y!
  const xDomain = padDomain(data.domains.x, DOMAIN_PAD, data.scales.x)
  const yDomain = padDomain(data.domains.y, DOMAIN_PAD, data.scales.y)
  const formatX = (value: number) => formatMetric(value, xMetric, sources.x, info)
  const formatY = (value: number) => formatMetric(value, yMetric, sources.y, info)
  // Duration and log axes keep their padded domain: niced 1-2-5 bounds would fall
  // between their ticks.
  const ownTicks = (axis: "x" | "y") =>
    data.metrics[axis] === "duration" || data.scales[axis] === "log"
      ? metricTicks(
          data.metrics[axis],
          axis === "x" ? xDomain : yDomain,
          TICK_INTERVALS[axis],
          data.scales[axis],
        )
      : undefined
  const xTicks = ownTicks("x")
  const yTicks = ownTicks("y")
  const scaleFor = (axis: "x" | "y", { min, max }: { min: number; max: number }) =>
    data.scales[axis] === "log" ? scaleLog().domain([min, max]) : scaleLinear().domain([min, max])
  const front = frontier ? drawnFrontier(data) : []
  const onFront = front.length > 0 ? new Set(front.map((point) => point.id)) : undefined

  return defineChart({
    marks: [
      paperRulingsMark(),
      pointGuidesMark(data),
      // Always present, empty when hidden or when the metrics do not trade off, so the
      // marks after it keep their keys and animate across either change.
      paretoFrontierMark(data, front),
      modelRunsMark(data, { highlight, frontier: onFront, logoClass }),
      modelLabelsMark(data, { highlight, frontier: onFront }),
    ],
    scales: {
      x: {
        scale: scaleFor("x", xDomain),
        nice: xTicks == null,
        grid: { stroke: "var(--border)", strokeOpacity: CHART_GRID_MINOR_OPACITY },
        axis: axisPresentation(
          metricAxisLabel(xMetric, sources.x, info, data.scales.x),
          formatX,
          TICK_SPACING_X,
          xTicks,
        ),
      },
      y: {
        scale: scaleFor("y", yDomain),
        nice: yTicks == null,
        grid: { stroke: "var(--border)", strokeOpacity: CHART_GRID_OPACITY },
        axis: axisPresentation(
          metricAxisLabel(yMetric, sources.y, info, data.scales.y),
          formatY,
          TICK_SPACING_Y,
          yTicks,
        ),
      },
    },
    theme: {
      foreground: "var(--foreground)",
      muted: "var(--muted-foreground)",
      grid: "var(--border)",
    },
    focusRing: { radius: FOCUS_RING_RADIUS, strokeWidth: 1.5, fill: "none" },
    // Inspect only what is under the pointer: a marker's own dot or logo box, no reach.
    maxFocusDistance: 0,
    svgAnimation: true,
    tooltip: chartTooltip(data, sources, info),
  })
}
