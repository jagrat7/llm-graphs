import { createMark, defineChart } from "@tanstack/charts"
import { scaleLinear } from "@tanstack/charts/scales/linear"

import type { ChartMarkState, ChartPoint, SceneLabel, SceneNode } from "@tanstack/charts"
import type { PlotData, PlotDomain, PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/server/api"
import type { Metric } from "#/ui/lib/metrics"
import type { BarGroup } from "#/ui/lib/stacking"

import { axisPresentation } from "#/ui/lib/chart-axes"
import {
  DIMMED_OPACITY,
  FOCUS_TRANSITION,
  SERIES_FOCUS_STATES,
  groupFocusOpacity,
  isLit,
} from "#/ui/lib/chart-marks"
import { CHART_AXIS_TITLE_SIZE, CHART_GRID_OPACITY, CHART_THEME } from "#/ui/lib/chart-styles"
import { chartTooltip } from "#/ui/lib/chart-tooltip"
import { metricTicks } from "#/ui/lib/comparison-plot-data"
import { formatMetric, metricAxisLabel } from "#/ui/lib/metrics"
import {
  LABEL_EFFORT_SIZE,
  LABEL_NAME_SIZE,
  LABEL_WIDTH_RATIO,
  seriesLabelColor,
} from "#/ui/lib/plot-labels"
import { barGroups } from "#/ui/lib/stacking"

/** Widest a bar's slot grows; past it, the spare width goes between the groups instead. */
const MAX_SLOT = 36
/** Narrowest slot that still fits an effort letter under its bar; see `barsMinWidth`. */
const MIN_SLOT = 11
/** Share of a slot its bar fills; the rest keeps it apart from the next effort. */
const BAR_FILL = 0.78
/** Space around each group, in slots, before any spare width is shared out. */
const GROUP_PAD = 1.6
/** A group never gets narrower than this, so its caption keeps a readable name. */
const MIN_CELL = 64
const BAR_RADIUS = 3
/** A zero-height bar still shows, and can still be pointed at. */
const MIN_BAR_HEIGHT = 1.5
/** Room above the tallest bar, as a share of the domain, for its value label. */
const HEADROOM = 0.1
/** Room the y axis's ticks and title take left of the plot, for `barsMinWidth`. */
const Y_AXIS_ROOM = 84
const TICK_SPACING_Y = 64

/** Class on the values over the bars; `styles.css` gives them a background halo. */
const BAR_LABEL_CLASS = "chart-bar-label"
const VALUE_SIZE = LABEL_EFFORT_SIZE + 0.5
const VALUE_GAP = 4
const CAPTION_VALUE_SIZE = LABEL_EFFORT_SIZE + 1
/** Bold names run wider than the average glyph `LABEL_WIDTH_RATIO` reserves. */
const NAME_WIDTH_RATIO = 0.62
const CAPTION_LOGO_SIZE = 14
/** How far past its slot an effort letter may reach into the gap beside it. */
const LETTER_SPILL = 5
/** Baselines and edges under the plot, measured down from its bottom edge. */
const EFFORT_BASELINE = 13
const LOGO_TOP = 20
const NAME_BASELINE = LOGO_TOP + CAPTION_LOGO_SIZE + 4 + LABEL_NAME_SIZE
const LINE_STEP = 13
/** Under two name lines and the fixed value below them. */
const TITLE_BASELINE = NAME_BASELINE + LINE_STEP * 2 + 20
const BOTTOM_MARGIN = TITLE_BASELINE + 6
/** How far lower efforts drop chroma as they fade toward the sheet; see `--effort-fade`. */
const FADE_CHROMA = 0.35

const EFFORT_LETTERS: Record<string, string> = {
  minimal: "Mn",
  low: "L",
  medium: "M",
  high: "H",
  xhigh: "X",
  max: "Mx",
}

/**
 * The short effort name set under each bar: L, M, H, X and Mx for the usual levels, the
 * budget itself for a thinking-token budget. A model that exposes no effort gets none.
 */
export function effortLetter(effort: string) {
  if (effort === "default") return null
  if (effort.endsWith("non-reasoning")) return "Off"
  if (effort.endsWith("unknown")) return "?"

  return EFFORT_LETTERS[effort] ?? effort
}

/**
 * A bar's value as it fits above the bar: three significant figures, or whole minutes
 * for a long duration. The tooltip still carries the exact value.
 */
function barValueText(
  value: number,
  metric: Metric,
  source: ProviderName | null,
  info: ProvidersInfo,
) {
  const rounded =
    metric === "duration"
      ? value >= 600
        ? Math.round(value / 60) * 60
        : value
      : Number(value.toPrecision(3))

  return formatMetric(rounded, metric, source, info)
}

/**
 * Lower efforts fade from the model's own colour toward the sheet, so its highest effort
 * reads strongest whichever theme draws it. `--effort-fade` sets the direction.
 */
function barColor(color: string, fade: number) {
  if (fade === 0) return color

  const step = fade.toFixed(3)

  return `oklch(from ${color} calc(l + var(--effort-fade) * ${step}) calc(c * (1 - ${FADE_CHROMA} * ${step})) h)`
}

function shorten(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

/**
 * A group's name on one line when it fits, otherwise split between words where the
 * longer line comes out shortest. A line still too wide is cut short; the full name is
 * in every bar's tooltip.
 */
export function captionLines(name: string, maxWidth: number) {
  const charWidth = LABEL_NAME_SIZE * NAME_WIDTH_RATIO
  const width = (text: string) => text.length * charWidth
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth))

  if (width(name) <= maxWidth) return [name]

  const words = name.split(" ")
  let best: Array<string> = [name]
  let longest = Infinity

  for (let index = 1; index < words.length; index += 1) {
    const lines = [words.slice(0, index).join(" "), words.slice(index).join(" ")]
    const wider = Math.max(...lines.map(width))

    if (wider < longest) {
      best = lines
      longest = wider
    }
  }

  return best.map((line) => shorten(line, maxChars))
}

/** The width each group takes: its bars plus its padding, never under `MIN_CELL`. */
function cellWidth(bars: number, slot: number) {
  return Math.max(slot * (bars + GROUP_PAD), MIN_CELL)
}

/**
 * The widest slot that lets every group fit `width`. Groups pinned at `MIN_CELL` drop
 * out of the share, and the rest split what remains; it settles once no more pin.
 */
function slotFor(counts: ReadonlyArray<number>, width: number) {
  const pinned = new Set<number>()

  for (;;) {
    const units = counts.reduce(
      (sum, bars, index) => (pinned.has(index) ? sum : sum + bars + GROUP_PAD),
      0,
    )
    const slot = units === 0 ? MAX_SLOT : (width - pinned.size * MIN_CELL) / units
    const newly = counts.flatMap((bars, index) =>
      !pinned.has(index) && slot * (bars + GROUP_PAD) < MIN_CELL ? [index] : [],
    )

    if (newly.length === 0) return Math.max(1, Math.min(MAX_SLOT, slot))
    for (const index of newly) pinned.add(index)
  }
}

type BarSlot = { point: PlotPoint; center: number; width: number; fade: number }
type GroupSlot = {
  group: BarGroup
  left: number
  right: number
  center: number
  bars: Array<BarSlot>
}

/**
 * Lays the groups out across `width` from `left`: one slot per effort, a group's bars
 * side by side in its cell, and spare width shared out between the groups once bars
 * reach `MAX_SLOT`. A group with more efforts takes a wider cell.
 */
export function layoutBars(groups: ReadonlyArray<BarGroup>, left: number, width: number) {
  const counts = groups.map((group) => group.series.points.length)
  const slot = slotFor(counts, width)
  const cells = counts.map((bars) => cellWidth(bars, slot))
  const spare = Math.max(0, width - cells.reduce((sum, cell) => sum + cell, 0)) / groups.length
  let cursor = left

  const placed = groups.map((group, groupIndex): GroupSlot => {
    const bars = counts[groupIndex]
    const cell = cells[groupIndex] + spare
    const start = cursor
    const center = start + cell / 2
    const first = center - (bars * slot) / 2

    cursor += cell

    return {
      group,
      left: start,
      right: cursor,
      center,
      bars: group.series.points.map((point, index) => ({
        point,
        center: first + (index + 0.5) * slot,
        width: slot * BAR_FILL,
        fade: bars === 1 ? 0 : (bars - 1 - index) / (bars - 1),
      })),
    }
  })

  return { slot, cells: placed }
}

/** The width the bars need before slots drop under `MIN_SLOT`; a narrower screen scrolls. */
export function barsMinWidth(data: PlotData) {
  return (
    Y_AXIS_ROOM +
    data.series.reduce((sum, series) => sum + cellWidth(series.points.length, MIN_SLOT), 0)
  )
}

/** Bars measure from zero, so zero is always on the axis; the top leaves room for labels. */
function barDomain(values: ReadonlyArray<number>): PlotDomain {
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  const span = high - low || 1

  return { min: low < 0 ? low - span * HEADROOM : 0, max: high + span * HEADROOM }
}

type Box = { left: number; right: number; top: number; bottom: number }

function overlaps(a: Box, b: Box) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/**
 * Focus lights a bar's whole group, like a run in the scatter, and outlines the bar
 * itself. Only the bars take these; the logos fade with their group but never outline.
 */
const BAR_STATES: ReadonlyArray<ChartMarkState<PlotPoint>> = [
  ...SERIES_FOCUS_STATES,
  {
    when: { focus: "primary" },
    style: { stroke: "var(--foreground)", strokeWidth: 1.5 },
    transition: FOCUS_TRANSITION,
  },
]

type BarMarkOptions = {
  groups: ReadonlyArray<BarGroup>
  spread: "x" | "y"
  highlight: string | null
  logoClass: Map<string, string>
  /** The caption's last line: the model's value on the flat metric. */
  flatText: (group: BarGroup) => string
  title: string
  formatValue: (value: number) => string
}

/** Where a bar stands: from zero to its value, never thinner than `MIN_BAR_HEIGHT`. */
function barExtent(value: number, zero: number, end: number) {
  const height = Math.max(Math.abs(zero - end), MIN_BAR_HEIGHT)
  const below = value < 0

  return { below, height, top: below ? zero : Math.min(end, zero - MIN_BAR_HEIGHT) }
}

/**
 * The bars and everything they carry: one bar per effort, the chart's only interactive
 * geometry, with its value over it and its effort under it; each group's logo, name and
 * fixed value; the zero line and the models' axis title. Each bar owns its point, which
 * sits on the bar's free end so the tooltip opens beside its value. The bars and logos
 * each take their own focus states, so a focused bar's outline never reaches a logo, and
 * text fades with its group through `focusOpacity`. A value that would collide with one
 * already placed is left out; the bar's tooltip still has it.
 */
function barsMark(data: PlotData, options: BarMarkOptions) {
  const { groups, spread, highlight } = options
  const ordered = groups.flatMap((group) => group.series.points)
  const order = new Map(ordered.map((point, index) => [point.id, index]))
  // Interaction reads each point's x value, so a bar's is its place in the reading order;
  // its pixels come from `layoutBars`.
  const unit = (point: PlotPoint) =>
    ((order.get(point.id) ?? 0) + 0.5) / Math.max(1, ordered.length)

  return createMark<PlotPoint>(({ markIndex }) => {
    const id = `effort-bars-${markIndex}`

    return {
      id,
      channels: {
        x: { scale: "x", values: data.points.map(unit) },
        y: { scale: "y", values: data.points.map((point) => point.values[spread]) },
      },
      render({ chart, scales }) {
        const zero = scales.y.map(0)
        const bottom = chart.y + chart.height
        const points: Array<ChartPoint<PlotPoint>> = []
        const bars: Array<SceneNode> = []
        const logos: Array<SceneNode> = []
        const values: Array<SceneLabel> = []
        const letters: Array<SceneLabel> = []
        const captions: Array<SceneNode> = []
        const placed: Array<Box> = []
        const { slot, cells } = layoutBars(groups, chart.x, chart.width)

        for (const { group, left, right, center, bars: slots } of cells) {
          const { series } = group
          const rest = isLit(series, highlight) ? 1 : DIMMED_OPACITY
          const focusOpacity = groupFocusOpacity(series.key)
          const owners: Array<ChartPoint<PlotPoint>> = []

          for (const { point, center: x, width, fade } of slots) {
            const value = point.values[spread]
            const { below, height, top } = barExtent(value, zero, scales.y.map(value))
            const radius = Math.min(BAR_RADIUS, width / 3, height)
            const chartPoint: ChartPoint<PlotPoint> = {
              key: `${id}:${point.id}`,
              markId: id,
              group: series.key,
              groupLabel: series.label,
              datum: point,
              datumIndex: point.index,
              xValue: unit(point),
              yValue: value,
              x,
              y: below ? top + height : top,
              color: point.color,
            }

            owners.push(chartPoint)
            bars.push({
              kind: "rect",
              key: chartPoint.key,
              x: x - width / 2,
              y: top,
              width,
              height,
              cornerRadii: below ? [0, 0, radius, radius] : [radius, radius, 0, 0],
              style: { fill: barColor(point.color, fade), opacity: rest },
              interaction: { point: chartPoint },
            })

            const text = options.formatValue(value)
            const half = (text.length * VALUE_SIZE * LABEL_WIDTH_RATIO) / 2
            const baseline = below ? top + height + VALUE_GAP + VALUE_SIZE : top - VALUE_GAP
            const box = {
              left: x - half - 1,
              right: x + half + 1,
              top: baseline - VALUE_SIZE,
              bottom: baseline + 2,
            }

            if (
              box.left >= chart.x &&
              box.right <= chart.x + chart.width &&
              box.top >= chart.y - VALUE_SIZE &&
              !placed.some((other) => overlaps(box, other))
            ) {
              placed.push(box)
              values.push({
                kind: "label",
                key: `${id}:${point.id}:value`,
                className: BAR_LABEL_CLASS,
                ariaHidden: true,
                x,
                y: baseline,
                anchor: "middle",
                text,
                fontSize: VALUE_SIZE,
                fontWeight: 500,
                style: { fill: "var(--foreground)", fillOpacity: 0.85, opacity: rest },
                focusOpacity,
              })
            }

            const letter = effortLetter(point.model.effort)

            // A letter may spill a little into the gap beside its bar, never further.
            if (
              letter != null &&
              letter.length * LABEL_EFFORT_SIZE * LABEL_WIDTH_RATIO <= slot + LETTER_SPILL
            ) {
              letters.push({
                kind: "label",
                key: `${id}:${point.id}:effort`,
                ariaHidden: true,
                x,
                y: bottom + EFFORT_BASELINE,
                anchor: "middle",
                text: letter,
                fontSize: LABEL_EFFORT_SIZE,
                fontWeight: 500,
                style: { fill: "var(--muted-foreground)", opacity: rest },
                focusOpacity,
              })
            }
          }

          points.push(...owners)

          const labelColor = seriesLabelColor(series.color)
          const logoUrl = series.points[0]?.logoUrl
          const logo = logoUrl == null ? undefined : options.logoClass.get(logoUrl)

          if (logo) {
            logos.push({
              kind: "rect",
              key: `${id}:${series.key}:logo`,
              className: logo,
              ariaHidden: true,
              pointOwners: owners,
              x: center - CAPTION_LOGO_SIZE / 2,
              y: bottom + LOGO_TOP,
              width: CAPTION_LOGO_SIZE,
              height: CAPTION_LOGO_SIZE,
              style: { fill: labelColor, opacity: rest },
            })
          }

          const lines = captionLines(series.label, right - left - 6)
          const shared = { ariaHidden: true, x: center, anchor: "middle", focusOpacity } as const

          lines.forEach((line, index) => {
            captions.push({
              ...shared,
              kind: "label",
              key: `${id}:${series.key}:name:${index}`,
              y: bottom + NAME_BASELINE + index * LINE_STEP,
              text: line,
              fontSize: LABEL_NAME_SIZE,
              fontWeight: 600,
              style: { fill: labelColor, opacity: rest },
            })
          })
          captions.push({
            ...shared,
            kind: "label",
            key: `${id}:${series.key}:fixed`,
            y: bottom + NAME_BASELINE + lines.length * LINE_STEP,
            text: options.flatText(group),
            fontSize: CAPTION_VALUE_SIZE,
            fontWeight: 500,
            style: { fill: "var(--muted-foreground)", opacity: rest },
          })
        }

        const states = (definitions: ReadonlyArray<ChartMarkState<PlotPoint>>) => ({
          data: data.points,
          definitions,
          points,
        })

        return {
          nodes: [
            {
              kind: "rule",
              key: `${id}:baseline`,
              ariaHidden: true,
              x1: chart.x,
              y1: zero,
              x2: chart.x + chart.width,
              y2: zero,
              style: { stroke: "var(--muted-foreground)", strokeOpacity: 0.6, strokeWidth: 1 },
            },
            {
              kind: "group",
              key: `${id}:bars`,
              ariaHidden: true,
              states: states(BAR_STATES),
              children: bars,
            },
            {
              kind: "group",
              key: `${id}:logos`,
              ariaHidden: true,
              states: states(SERIES_FOCUS_STATES),
              children: logos,
            },
            { kind: "group", key: `${id}:values`, ariaHidden: true, children: values },
            { kind: "group", key: `${id}:efforts`, ariaHidden: true, children: letters },
            { kind: "group", key: `${id}:captions`, ariaHidden: true, children: captions },
            {
              kind: "label",
              key: `${id}:title`,
              ariaHidden: true,
              x: chart.x + chart.width / 2,
              y: bottom + TITLE_BASELINE,
              anchor: "middle",
              text: options.title,
              fontSize: CHART_AXIS_TITLE_SIZE,
              fontWeight: 500,
              style: { fill: "var(--foreground)", opacity: 0.85 },
            },
          ],
        }
      },
    }
  })
}

/** "Input token price" → "input token price", leaving acronyms like "ARC-AGI-2" alone. */
function lowerFirst(text: string) {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text
}

/**
 * The comparison when one metric is fixed per model (see `stackedAxis`): one group of
 * bars per model, ordered by that fixed value, which each group's caption carries, and
 * one bar per effort, as tall as the metric that does vary. Bars stand on zero, so the
 * varying metric is always drawn linear; the scatter keeps the reader's log choice.
 */
export function barDefinition(
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
  const groups = barGroups(data, flat)
  const domain = barDomain(data.points.map((point) => point.values[spread]))
  const formatFlat = (value: number) => formatMetric(value, flatMetric, sources[flat], info)
  const formatSpread = (value: number) => formatMetric(value, spreadMetric, sources[spread], info)
  const durations = spreadMetric === "duration"
  // A model whose efforts differ on the flat metric shows its whole span, never one value.
  const flatText = ({ fixed }: BarGroup) =>
    fixed.min === fixed.max
      ? formatFlat(fixed.min)
      : `${formatFlat(fixed.min)}–${formatFlat(fixed.max)}`
  const marks = [
    barsMark(data, {
      groups,
      spread,
      highlight,
      logoClass,
      flatText,
      title: `Models, sorted by ${lowerFirst(metricAxisLabel(flatMetric, sources[flat], info))}`,
      formatValue: (value) => barValueText(value, spreadMetric, sources[spread], info),
    }),
  ]

  return defineChart({
    chart: ({ height }) => {
      const valueAxis = axisPresentation(
        metricAxisLabel(spreadMetric, sources[spread], info),
        formatSpread,
        TICK_SPACING_Y,
        // Durations tick on whole minutes and hours rather than 1-2-5 steps of seconds.
        durations
          ? metricTicks(spreadMetric, domain, Math.max(2, Math.floor(height / TICK_SPACING_Y)))
          : undefined,
      )

      return {
        marks,
        // The groups' captions and the models' axis title are drawn by the mark itself.
        margin: { bottom: BOTTOM_MARGIN },
        scales: {
          x: { scale: scaleLinear().domain([0, 1]), nice: false, grid: false, axis: false },
          y: {
            scale: scaleLinear().domain([domain.min, domain.max]),
            nice: !durations,
            grid: {
              stroke: "var(--border)",
              strokeOpacity: CHART_GRID_OPACITY,
              strokeDasharray: "2 4",
            },
            axis: { ...valueAxis, line: false },
          },
        },
        theme: CHART_THEME,
      }
    },
    // The focused bar takes an outline instead of a ring around its top.
    focusRing: false,
    maxFocusDistance: 0,
    svgAnimation: true,
    tooltip: chartTooltip(data, sources, info),
  })
}
