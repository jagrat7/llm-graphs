import type {
  ChartFocusAnchor,
  ChartMarkState,
  ChartPoint,
  MarkRenderContext,
  SceneLabel,
  SceneNode,
} from "@tanstack/charts"

import { createMark, whenFocused } from "@tanstack/charts"

import type { PlotData, PlotPoint, PlotSeries } from "#/ui/lib/comparison-plot-data"

import {
  CHART_ACTIVE_SCALE,
  CHART_RULING_CLASS,
  CHART_RULING_OPACITY,
  CHART_TRANSITION_MS,
} from "#/ui/lib/chart-styles"
import { minorRulings } from "#/ui/lib/paper-rulings"
import {
  LABEL_EFFORT_SIZE,
  LABEL_NAME_SIZE,
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
 * included, since the frontier's line is the one to follow. Pointer focus still lights
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

function scatterChannels(data: PlotData) {
  return {
    x: { scale: "x", values: data.points.map((point) => point.values.x) },
    y: { scale: "y", values: data.points.map((point) => point.values.y) },
  }
}

function positionsOf(data: PlotData, { scales }: Pick<MarkRenderContext, "scales">) {
  const positions = new Map<string, LabelPosition>()

  for (const point of data.points) {
    const x = scales.x.map(point.values.x)
    const y = scales.y.map(point.values.y)

    if (Number.isFinite(x) && Number.isFinite(y)) positions.set(point.id, { x, y })
  }

  return positions
}

export const FOCUS_TRANSITION = {
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
export const SERIES_FOCUS_STATES: ReadonlyArray<ChartMarkState<PlotPoint>> = [
  {
    when: ({ matches }) => !matches("series"),
    style: { opacity: DIMMED_OPACITY },
    transition: FOCUS_TRANSITION,
  },
  {
    when: ({ matches }) => matches("series"),
    style: { opacity: 1, strokeOpacity: ACTIVE_LINE_OPACITY },
    transition: FOCUS_TRANSITION,
  },
]

const FOCUS_STATES: ReadonlyArray<ChartMarkState<PlotPoint>> = [
  ...SERIES_FOCUS_STATES,
  // Dots grow under the pointer; logos keep their box and rely on the focus ring.
  { when: { focus: "primary" }, style: { r: ACTIVE_POINT_RADIUS }, transition: FOCUS_TRANSITION },
]

/**
 * Each model's effort run: a connecting line under one marker per effort. Logos are
 * painted as rects filled with the model colour and masked by the vendor logo
 * (`logoClass` maps a logo URL to the class carrying that mask); models without a logo
 * get a plain dot. Markers are the run's only interactive geometry; the connecting line
 * just follows its points' focus state.
 */
export function modelRunsMark(
  data: PlotData,
  {
    highlight,
    frontier,
    logoClass,
  }: Emphasis & {
    /** Model id to emphasise from outside the chart, e.g. a hovered picker pill. */
    highlight: string | null
    logoClass: Map<string, string>
  },
) {
  const emphasis = { highlight, frontier }

  return createMark<PlotPoint>(({ markIndex }) => {
    const id = `model-runs-${markIndex}`

    return {
      id,
      channels: scatterChannels(data),
      states: { data: data.points, definitions: FOCUS_STATES },
      render(context) {
        const positions = positionsOf(data, context)
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
              xValue: point.values.x,
              yValue: point.values.y,
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
            lines.push({
              kind: "polyline",
              key: `${id}:line:${series.key}`,
              ariaHidden: true,
              points: owners.map((point) => [point.x, point.y] as const),
              pointOwners: owners,
              style: {
                fill: "none",
                stroke: series.color,
                strokeWidth: 2,
                strokeOpacity: LINE_OPACITY,
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
const RULING_STYLE = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: CHART_RULING_OPACITY,
  strokeWidth: 1,
} as const

/**
 * The sheet's minor rulings, drawn first so everything else sits on top of them: a
 * hairline at each subdivision between the gridlines, out to the plot's edges, so the
 * plot reads as graph paper on either theme. Off, the mark stays but draws nothing, so the
 * marks after it keep their keys.
 */
export function paperRulingsMark(shown = true) {
  return createMark<PlotPoint, number, number>(({ markIndex }) => {
    const id = `paper-rulings-${markIndex}`

    return {
      id,
      channels: {
        x: { scale: "x", values: [] },
        y: { scale: "y", values: [] },
      },
      render({ chart, scales }) {
        if (!shown) return { nodes: [] }

        const positions = (axis: "x" | "y") => scales[axis].ticks.map((tick) => tick.position)
        const columns = minorRulings(positions("x"), chart.x, chart.x + chart.width)
        const rows = minorRulings(positions("y"), chart.y, chart.y + chart.height)
        const rules: Array<SceneNode> = [
          ...columns.map(
            (x): SceneNode => ({
              kind: "rule",
              key: `${id}:x:${x.toFixed(2)}`,
              x1: x,
              y1: chart.y,
              x2: x,
              y2: chart.y + chart.height,
            }),
          ),
          ...rows.map(
            (y): SceneNode => ({
              kind: "rule",
              key: `${id}:y:${y.toFixed(2)}`,
              x1: chart.x,
              y1: y,
              x2: chart.x + chart.width,
              y2: y,
            }),
          ),
        ]

        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: CHART_RULING_CLASS,
              ariaHidden: true,
              style: RULING_STYLE,
              children: rules,
            },
          ],
        }
      },
    }
  })
}

export const PARETO_STYLE = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: 0.75,
  strokeWidth: 1.5,
  strokeDasharray: "5 4",
} as const

/**
 * The Pareto frontier as a dashed line through the variants nothing beats on both
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
