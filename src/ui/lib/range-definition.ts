import { defineChart } from "@tanstack/charts"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { scalePoint } from "@tanstack/charts/scales/point"

import type { PlotData, PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"
import type { PlotEncoding } from "#/ui/lib/chart-marks"

import { effortLabelsMark, modelRunsMark } from "#/ui/lib/chart-marks"
import { CHART_GRID_MINOR_OPACITY, CHART_TICK_SIZE } from "#/ui/lib/chart-styles"
import { LABEL_WIDTH_RATIO } from "#/ui/lib/plot-labels"
import { axisPresentation } from "#/ui/lib/chart-axes"
import { chartTooltip } from "#/ui/lib/chart-tooltip"
import { padDomain, timeTicks } from "#/ui/lib/comparison-plot-data"
import { formatMetric, metricAxisLabel } from "#/ui/lib/metrics"
import { rangeRows } from "#/ui/lib/stacking"

const DOMAIN_PAD = 0.06
const TICK_SPACING_X = 160
/** Space around the first and last row, as a share of one row's step. */
const ROW_PADDING = 0.6
/** A span thick enough to read as the model's range rather than a connector. */
const SPAN_WIDTH = 6
const SPAN_OPACITY = 0.35
const FOCUS_RING_RADIUS = 13
/** Each row needs room for its markers plus an effort name above and below. */
const ROW_MIN_HEIGHT = 56
/** The x axis, its title and the padding around the first and last row. */
const RANGE_CHROME_HEIGHT = 110
/** Share of the chart's width the row captions may take before names are shortened. */
const CAPTION_WIDTH_SHARE = 0.32

/** The height the range view needs so no row is squeezed below `ROW_MIN_HEIGHT`. */
export function rangeMinHeight(rowCount: number) {
  return rowCount * ROW_MIN_HEIGHT + RANGE_CHROME_HEIGHT
}

/** "Input token price" → "input token price", leaving acronyms like "ARC-AGI-2" alone. */
function lowerFirst(text: string) {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text
}

function shorten(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

/** "Claude Sonnet 5.5 (between tools)": two configurations of a model share a name. */
function rowName(point: PlotPoint) {
  const { configuration } = point.model

  return configuration ? `${point.model.displayName} (${configuration})` : point.model.displayName
}

/**
 * The comparison when one metric is fixed per model (see `stackedAxis`): one row per
 * model ordered by that fixed value, which each row's caption carries, and the model's
 * efforts spread along the metric that does vary. Rows always run horizontally, so the
 * spread reads left to right whichever axis the fixed metric was picked on.
 */
export function rangeDefinition(
  data: PlotData,
  {
    flat,
    highlight,
    info,
    logoClass,
    sources,
  }: {
    /** The axis whose metric is shared by every effort of a model. */
    flat: "x" | "y"
    highlight: string | null
    info: ProvidersInfo
    logoClass: Map<string, string>
    sources: Record<"x" | "y", ProviderName | null>
  },
) {
  const spread = flat === "x" ? "y" : "x"
  const flatMetric = data.metrics[flat]!
  const spreadMetric = data.metrics[spread]!
  const rows = rangeRows(data, flat)
  const formatFlat = (value: number) => formatMetric(value, flatMetric, sources[flat], info)
  // A model whose efforts differ on the flat metric shows its whole span, never one value.
  const captionParts = new Map(
    rows.map(({ series, fixed }) => [
      series.key,
      {
        name: rowName(series.points[0]),
        value:
          fixed.min === fixed.max
            ? formatFlat(fixed.min)
            : `${formatFlat(fixed.min)}–${formatFlat(fixed.max)}`,
      },
    ]),
  )
  const encoding: PlotEncoding = {
    x: (point) => point.values[spread],
    y: (point) => point.seriesKey,
  }
  const domain = padDomain(data.domains[spread], DOMAIN_PAD)
  const formatSpread = (value: number) => formatMetric(value, spreadMetric, sources[spread], info)

  // Captions shorten the model name, never the value, so a narrow plot keeps its width.
  // The full name is still in each marker's tooltip and announcement.
  return defineChart({
    chart: ({ width }) => {
      const maxChars = Math.floor(
        (width * CAPTION_WIDTH_SHARE) / (CHART_TICK_SIZE * LABEL_WIDTH_RATIO),
      )
      // The rows are models, not a scale of the flat metric; its values live in the captions.
      const rowAxis = axisPresentation(
        `Models, sorted by ${lowerFirst(metricAxisLabel(flatMetric, sources[flat], info))}`,
        (key: string) => {
          const parts = captionParts.get(key)

          if (!parts) return key

          const suffix = ` · ${parts.value}`

          return `${shorten(parts.name, maxChars - suffix.length)}${suffix}`
        },
      )

      return {
        marks: [
          modelRunsMark(data, {
            highlight,
            logoClass,
            encoding,
            run: { strokeWidth: SPAN_WIDTH, strokeOpacity: SPAN_OPACITY, span: true },
          }),
          effortLabelsMark(data, { encoding, highlight }),
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([domain.min, domain.max]),
            // Tick density changes with width; keep that from expanding the data domain.
            nice: false,
            grid: { stroke: "var(--border)", strokeOpacity: CHART_GRID_MINOR_OPACITY },
            axis: axisPresentation(
              metricAxisLabel(spreadMetric, sources[spread], info),
              formatSpread,
              TICK_SPACING_X,
              spreadMetric === "duration"
                ? timeTicks(domain, Math.max(2, Math.floor(width / TICK_SPACING_X)))
                : undefined,
            ),
          },
          y: {
            scale: scalePoint()
              .domain(rows.map((row) => row.series.key))
              .padding(ROW_PADDING),
            axis: {
              ...rowAxis,
              line: false,
              ticks: { ...rowAxis.ticks, line: false },
              // Every row needs its name, so labels are never thinned away.
              tickLabels: { fontSize: CHART_TICK_SIZE, fontWeight: 500, thin: false },
            },
          },
        },
        theme: {
          foreground: "var(--foreground)",
          muted: "var(--muted-foreground)",
          grid: "var(--border)",
        },
      }
    },
    focusRing: { radius: FOCUS_RING_RADIUS, strokeWidth: 1.5, fill: "none" },
    maxFocusDistance: 0,
    svgAnimation: true,
    tooltip: chartTooltip(data, sources, info, { rows: true }),
  })
}
