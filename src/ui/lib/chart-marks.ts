import type {
  ChartFocusAnchor,
  ChartMarkState,
  ChartPoint,
  ChartValue,
  MarkRenderContext,
  SceneLabel,
  SceneNode,
} from "@tanstack/charts"

import { createMark, whenFocused } from "@tanstack/charts"

import type { PlotData, PlotPoint, PlotSeries } from "#/ui/lib/comparison-plot-data"

import { CHART_ACTIVE_SCALE, CHART_TRANSITION_MS } from "#/ui/lib/chart-styles"
import { paretoCurve } from "#/ui/lib/pareto"
import {
  LABEL_COLLISION_GAP,
  LABEL_EFFORT_SIZE,
  LABEL_NAME_SIZE,
  LABEL_WIDTH_RATIO,
  placeSeriesLabels,
  type LabelPosition,
} from "#/ui/lib/plot-labels"

export const POINT_RADIUS = 5
const ACTIVE_POINT_RADIUS = POINT_RADIUS * CHART_ACTIVE_SCALE
/** Logo markers are square boxes, sized so a vendor's mark stays legible. */
export const LOGO_SIZE = 16
/** Opacity of everything outside the highlighted model while one is highlighted. */
export const DIMMED_OPACITY = 0.28
const LINE_OPACITY = 0.45
const ACTIVE_LINE_OPACITY = 0.85
/** Class every placed label carries; `styles.css` gives it a background halo. */
export const CHART_LABEL_CLASS = "chart-point-label"

/** Whether a run stays lit: nothing is highlighted from outside, or it is that model. */
export function isLit(series: PlotSeries, highlight: string | null) {
  return highlight == null || series.points[0]?.model.model === highlight
}

/**
 * What stays lit at rest. A model highlighted from outside wins; otherwise a drawn Pareto
 * frontier keeps its own variants lit and mutes everything else, every run's line
 * included, since the frontier's curve is the line to follow. Pointer focus still lights
 * a whole run over either.
 */
type Emphasis = {
  highlight: string | null
  /** Ids of the variants on a drawn Pareto frontier. */
  frontier?: ReadonlySet<string>
}

function markerOpacity(point: PlotPoint, series: PlotSeries, { highlight, frontier }: Emphasis) {
  const lit =
    highlight != null || frontier == null ? isLit(series, highlight) : frontier.has(point.id)

  return lit ? 1 : DIMMED_OPACITY
}

function runLineOpacity(series: PlotSeries, { highlight, frontier }: Emphasis) {
  const lit = highlight != null || frontier == null ? isLit(series, highlight) : false

  return lit ? 1 : DIMMED_OPACITY
}

/** A model's name stays lit while any of its variants is on the frontier. */
function nameOpacity(series: PlotSeries, { highlight, frontier }: Emphasis) {
  const lit =
    highlight != null || frontier == null
      ? isLit(series, highlight)
      : series.points.some((point) => frontier.has(point.id))

  return lit ? 1 : DIMMED_OPACITY
}

/** Half the marker's box: a logo's square, or a fallback circle's radius. */
export function markerHalf(point: PlotPoint) {
  return point.logoUrl == null ? POINT_RADIUS : LOGO_SIZE / 2
}

/** Which value of a point each positional scale reads; the scatter reads both metrics. */
export type PlotEncoding = Record<"x" | "y", (point: PlotPoint) => ChartValue>

export const SCATTER_ENCODING: PlotEncoding = {
  x: (point) => point.values.x,
  y: (point) => point.values.y,
}

function encodedChannels(data: PlotData, encoding: PlotEncoding) {
  return {
    x: { scale: "x", values: data.points.map(encoding.x) },
    y: { scale: "y", values: data.points.map(encoding.y) },
  }
}

/** Band scales resolve to the band centre, so a row's markers sit on its midline. */
function positionsOf(
  data: PlotData,
  { scales }: Pick<MarkRenderContext, "scales">,
  encoding: PlotEncoding = SCATTER_ENCODING,
) {
  const positions = new Map<string, LabelPosition>()

  for (const point of data.points) {
    const x = scales.x.map(encoding.x(point))
    const y = scales.y.map(encoding.y(point))

    if (Number.isFinite(x) && Number.isFinite(y)) positions.set(point.id, { x, y })
  }

  return positions
}

const stateTransition = {
  type: "tween",
  duration: CHART_TRANSITION_MS,
  easing: "ease-out",
} as const

/**
 * While the pointer or keyboard rests on a point, its whole model run stays lit and
 * every other run fades — the same treatment a highlighted picker pill gets — so the
 * point reads against its siblings at other efforts. Chart focus is the more direct
 * gesture, so it wins over a pill highlight: the focused run is fully lit even when
 * another model's pill is highlighted, matching what the labels' `focusOpacity` does.
 */
const FOCUS_STATES: ReadonlyArray<ChartMarkState<PlotPoint>> = [
  {
    when: ({ matches }) => !matches("series"),
    style: { opacity: DIMMED_OPACITY },
    transition: stateTransition,
  },
  {
    when: ({ matches }) => matches("series"),
    style: { opacity: 1, strokeOpacity: ACTIVE_LINE_OPACITY },
    transition: stateTransition,
  },
  // Dots grow under the pointer; logos keep their box and rely on the focus ring.
  { when: { focus: "primary" }, style: { r: ACTIVE_POINT_RADIUS }, transition: stateTransition },
]

/** How a run's connecting line is drawn: a thin path in the scatter, a thick span in rows. */
export type RunStyle = { strokeWidth: number; strokeOpacity: number; span: boolean }

const SCATTER_RUN: RunStyle = { strokeWidth: 2, strokeOpacity: LINE_OPACITY, span: false }

/**
 * Each model's effort run: a connecting line under one marker per effort. Logos are
 * painted as rects filled with the model colour and masked by the vendor logo
 * (`logoClass` maps a logo URL to the class carrying that mask); models without a logo
 * get a plain dot. Markers are the run's only interactive geometry; the connecting line
 * just follows its points' focus state. A `span` run is drawn from its leftmost to its
 * rightmost marker instead of in effort order, which is what a range row needs.
 */
export function modelRunsMark(
  data: PlotData,
  {
    highlight,
    frontier,
    logoClass,
    encoding = SCATTER_ENCODING,
    run = SCATTER_RUN,
  }: Emphasis & {
    /** Model id to emphasise from outside the chart, e.g. a hovered picker pill. */
    highlight: string | null
    logoClass: Map<string, string>
    encoding?: PlotEncoding
    run?: RunStyle
  },
) {
  const emphasis = { highlight, frontier }

  return createMark<PlotPoint>(({ markIndex }) => {
    const id = `model-runs-${markIndex}`

    return {
      id,
      channels: encodedChannels(data, encoding),
      states: { data: data.points, definitions: FOCUS_STATES },
      render(context) {
        const positions = positionsOf(data, context, encoding)
        const lines: Array<SceneNode> = []
        const markers: Array<SceneNode> = []

        for (const series of data.series) {
          const owners: Array<ChartPoint<PlotPoint>> = []

          for (const point of series.points) {
            const position = positions.get(point.id)

            if (!position) continue

            const opacity = markerOpacity(point, series, emphasis)

            const chartPoint: ChartPoint<PlotPoint> = {
              key: `${id}:${point.id}`,
              markId: id,
              group: series.key,
              groupLabel: series.label,
              datum: point,
              datumIndex: point.index,
              xValue: encoding.x(point),
              yValue: encoding.y(point),
              x: position.x,
              y: position.y,
              color: point.color,
            }
            const className = point.logoUrl == null ? undefined : logoClass.get(point.logoUrl)

            owners.push(chartPoint)
            markers.push(
              className
                ? {
                    kind: "rect",
                    key: chartPoint.key,
                    className,
                    x: position.x - LOGO_SIZE / 2,
                    y: position.y - LOGO_SIZE / 2,
                    width: LOGO_SIZE,
                    height: LOGO_SIZE,
                    style: { fill: point.color, opacity },
                    interaction: { point: chartPoint },
                  }
                : {
                    kind: "dot",
                    key: chartPoint.key,
                    x: position.x,
                    y: position.y,
                    radius: POINT_RADIUS,
                    style: {
                      fill: point.color,
                      stroke: "var(--background)",
                      strokeWidth: 2,
                      opacity,
                    },
                    interaction: { point: chartPoint },
                  },
            )
          }

          if (owners.length > 1) {
            const path = run.span
              ? [
                  owners.reduce((left, point) => (point.x < left.x ? point : left)),
                  owners.reduce((right, point) => (point.x > right.x ? point : right)),
                ]
              : owners

            lines.push({
              kind: "polyline",
              key: `${id}:line:${series.key}`,
              ariaHidden: true,
              points: path.map((point) => [point.x, point.y] as const),
              pointOwners: owners,
              style: {
                fill: "none",
                stroke: series.color,
                strokeWidth: run.strokeWidth,
                strokeOpacity: run.strokeOpacity,
                opacity: runLineOpacity(series, emphasis),
                lineCap: "round",
                lineJoin: "round",
              },
            })
          }
        }

        return {
          nodes: [
            { kind: "group", key: `${id}:lines`, ariaHidden: true, children: lines },
            { kind: "group", key: `${id}:markers`, ariaHidden: true, children: markers },
          ],
        }
      },
    }
  })
}

/**
 * One name per model, placed beside a free side of one of its markers. Labels are
 * decorative: the markers own focus, and each label fades with its run.
 */
export function modelLabelsMark(data: PlotData, emphasis: Emphasis) {
  return createMark<PlotPoint, number, number>(({ markIndex }) => {
    const id = `model-labels-${markIndex}`

    return {
      id,
      channels: {
        x: { scale: "x", values: data.points.map((point) => point.values.x) },
        y: { scale: "y", values: data.points.map((point) => point.values.y) },
      },
      render(context) {
        const { chart } = context
        const seriesByKey = new Map(data.series.map((series) => [series.key, series]))
        const placed = placeSeriesLabels(
          data,
          positionsOf(data, context),
          {
            left: chart.x,
            top: chart.y,
            right: chart.x + chart.width,
            bottom: chart.y + chart.height,
          },
          markerHalf,
        )
        const nodes = placed.flatMap((label): Array<SceneLabel> => {
          const series = seriesByKey.get(label.key)
          const restingOpacity = series == null ? 1 : nameOpacity(series, emphasis)
          const focusOpacity: SceneLabel["focusOpacity"] = ({ focus }) =>
            focus == null ? undefined : focus.primary.group === label.key ? 1 : DIMMED_OPACITY
          const shared = {
            className: CHART_LABEL_CLASS,
            ariaHidden: true,
            x: label.x,
            anchor: label.anchor,
            focusOpacity,
          } as const

          return [
            {
              ...shared,
              kind: "label",
              key: `${id}:${label.key}:name`,
              y: label.nameY,
              text: label.name,
              fontSize: LABEL_NAME_SIZE,
              fontWeight: 600,
              style: { fill: label.color, opacity: restingOpacity },
            },
            ...(label.effort == null
              ? []
              : [
                  {
                    ...shared,
                    kind: "label" as const,
                    key: `${id}:${label.key}:effort`,
                    y: label.effortY,
                    text: label.effort,
                    fontSize: LABEL_EFFORT_SIZE,
                    fontWeight: 500,
                    style: { fill: "var(--muted-foreground)", opacity: restingOpacity },
                  },
                ]),
          ]
        })

        return {
          nodes: [{ kind: "group", key: id, ariaHidden: true, children: nodes }],
        }
      },
    }
  })
}

const GUIDE_STYLE = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: 0.45,
  strokeWidth: 1,
  strokeDasharray: "3 4",
} as const

/**
 * Dashed leaders from the active point to both axes, so its values can be read off the
 * ticks. Each point's pair is authored up front and `whenFocused` reveals only the
 * focused one; the pair stops at the point rather than crossing the whole plot.
 */
export function pointGuidesMark(data: PlotData) {
  return whenFocused(
    createMark<PlotPoint, number, number>(({ markIndex }) => {
      const id = `point-guides-${markIndex}`

      return {
        id,
        channels: {
          x: { scale: "x", values: data.points.map((point) => point.values.x) },
          y: { scale: "y", values: data.points.map((point) => point.values.y) },
        },
        render(context) {
          const { chart } = context
          const positions = positionsOf(data, context)
          const anchors: Array<ChartFocusAnchor> = []
          const rules: Array<SceneNode> = []

          for (const point of data.points) {
            const position = positions.get(point.id)

            if (!position) continue

            const key = `${id}:${point.id}`

            // The datum is the runs mark's own point object, which is what focus matches.
            anchors.push({
              key,
              markId: id,
              group: point.seriesKey,
              datum: point,
              datumIndex: point.index,
            })
            rules.push(
              {
                kind: "rule",
                key: `${key}:to-y-axis`,
                x1: chart.x,
                y1: position.y,
                x2: position.x,
                y2: position.y,
                style: GUIDE_STYLE,
              },
              {
                kind: "rule",
                key: `${key}:to-x-axis`,
                x1: position.x,
                y1: position.y,
                x2: position.x,
                y2: chart.y + chart.height,
                style: GUIDE_STYLE,
              },
            )
          }

          return {
            nodes: [{ kind: "group", key: id, ariaHidden: true, children: rules }],
            focusAnchors: anchors,
          }
        },
      }
    }),
  )
}

/** Dashed, so the frontier never reads as one more model's solid run. */
export const PARETO_STYLE = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: 0.75,
  strokeWidth: 1.5,
  strokeDasharray: "5 4",
} as const

/**
 * The Pareto frontier as a smooth dashed curve through the variants nothing beats on both
 * axes. It sits under the runs and takes no focus; the markers it passes through do. With
 * no frontier it draws nothing but stays in the chart, so the marks after it keep their keys.
 */
export function paretoFrontierMark(data: PlotData, frontier: ReadonlyArray<PlotPoint>) {
  return createMark<PlotPoint, number, number>(({ markIndex }) => {
    const id = `pareto-frontier-${markIndex}`

    return {
      id,
      channels: {
        x: { scale: "x", values: frontier.map((point) => point.values.x) },
        y: { scale: "y", values: frontier.map((point) => point.values.y) },
      },
      render(context) {
        const positions = positionsOf(data, context)
        const placed = frontier.flatMap((point) => {
          const position = positions.get(point.id)

          return position ? [{ point, position }] : []
        })

        if (placed.length < 2) return { nodes: [] }

        const points = placed.map(({ position }) => [position.x, position.y] as const)

        return {
          nodes: [
            {
              kind: "group",
              key: id,
              ariaHidden: true,
              children: [
                {
                  kind: "polyline",
                  key: `${id}:line`,
                  points,
                  path: paretoCurve(points),
                  style: { fill: "none", lineCap: "round", lineJoin: "round", ...PARETO_STYLE },
                },
              ],
            },
          ],
        }
      },
    }
  })
}

/** Effort names like "xhigh" read as small caps beneath their markers. */
const EFFORT_LABEL_GAP = 6

/**
 * The range view's per-marker effort names, set under each marker so a row reads
 * "low · medium · high" along its span. A name that would collide with the previous one
 * below moves above its marker; one that fits neither side is skipped, and the marker's
 * tooltip still names its effort. Names stay inside the plot and within half a row of
 * their marker, so a cramped chart drops them rather than spilling into the next row.
 */
export function effortLabelsMark(
  data: PlotData,
  { encoding, highlight }: { encoding: PlotEncoding; highlight: string | null },
) {
  return createMark<PlotPoint>(({ markIndex }) => {
    const id = `effort-labels-${markIndex}`

    return {
      id,
      channels: encodedChannels(data, encoding),
      render(context) {
        const { chart } = context
        const positions = positionsOf(data, context, encoding)
        const nodes: Array<SceneLabel> = []
        const rows = [
          ...new Set(Array.from(positions.values(), (position) => position.y)),
        ].toSorted((left, right) => left - right)
        const rowHalf = Math.min(
          Infinity,
          ...rows.slice(1).map((y, index) => (y - rows[index]) / 2),
        )

        for (const series of data.series) {
          const restingOpacity = isLit(series, highlight) ? 1 : DIMMED_OPACITY
          // Right edge of the last name placed in each lane: under the row, then over it.
          const laneRight = [-Infinity, -Infinity]
          const named = series.points
            .flatMap((point) => {
              const position = positions.get(point.id)

              return position && point.model.effort !== "default" ? [{ point, position }] : []
            })
            .toSorted((left, right) => left.position.x - right.position.x)

          for (const { point, position } of named) {
            const text = point.model.effort
            const half = (text.length * LABEL_EFFORT_SIZE * LABEL_WIDTH_RATIO) / 2
            const offset = markerHalf(point) + EFFORT_LABEL_GAP
            const reach = offset + LABEL_EFFORT_SIZE

            if (reach > rowHalf || half * 2 > chart.width) continue

            const fits = [
              position.y + reach <= chart.y + chart.height,
              position.y - reach >= chart.y,
            ]
            const x = Math.min(Math.max(position.x, chart.x + half), chart.x + chart.width - half)
            const lane = laneRight.findIndex(
              (right, index) => fits[index] && x - half >= right + LABEL_COLLISION_GAP,
            )

            if (lane === -1) continue

            laneRight[lane] = x + half
            nodes.push({
              kind: "label",
              key: `${id}:${point.id}`,
              className: CHART_LABEL_CLASS,
              ariaHidden: true,
              x,
              y: lane === 0 ? position.y + reach : position.y - offset,
              anchor: "middle",
              text,
              fontSize: LABEL_EFFORT_SIZE,
              fontWeight: 500,
              style: { fill: "var(--muted-foreground)", opacity: restingOpacity },
              focusOpacity: ({ focus }) =>
                focus == null ? undefined : focus.primary.group === series.key ? 1 : DIMMED_OPACITY,
            })
          }
        }

        return { nodes: [{ kind: "group", key: id, ariaHidden: true, children: nodes }] }
      },
    }
  })
}
