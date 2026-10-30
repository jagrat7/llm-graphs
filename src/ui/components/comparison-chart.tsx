import { createChartRuntime } from "@tanstack/charts"
import { renderChartSvg } from "@tanstack/charts/svg"
import { Chart } from "@tanstack/charts/react/tooltip"
import { useId, useMemo, useRef, useState } from "react"

import type { ChartDefinition, ChartSize, ChartTextMeasurer } from "@tanstack/charts"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/server/api"
import type { Model } from "#/ui/lib/model-view"

import { ChartShareMenu } from "#/ui/components/chart-share-menu"
import { DataState } from "#/ui/components/data-state"
import { PointDetails } from "#/ui/components/point-details"
import { Toggle } from "#/ui/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"
import { isRatioMetric, metricPresentation } from "#/ui/lib/metrics"
import { axisDescription, rangeAxisDescription } from "#/ui/lib/chart-axes"
import { CHART_EXPORT_DEFS_ATTRIBUTE, SHARE_PLOT_SIZE, svgPlotImage } from "#/ui/lib/chart-image"
import { CHART_TOOLTIP_CARD_CLASS, CHART_TOOLTIP_WIDTH } from "#/ui/lib/chart-styles"
import { useChartTextMeasurer } from "#/ui/lib/chart-text"
import { focusedPoint } from "#/ui/lib/chart-tooltip"
import {
  buildPlotData,
  describePlot,
  type AxisScale,
  type PlotData,
  type PlotPoint,
} from "#/ui/lib/comparison-plot-data"
import {
  CHART_FRAME_CLASS,
  CHART_MIN_HEIGHT_VAR,
  CHART_TOOLBAR_HEIGHT_PX,
  type ChartFrameStyle,
} from "#/ui/lib/layout-styles"
import { PARETO_STYLE } from "#/ui/lib/chart-marks"
import { drawnFrontier } from "#/ui/lib/pareto"
import { rangeDefinition, rangeMinHeight } from "#/ui/lib/range-definition"
import { scatterDefinition } from "#/ui/lib/scatter-definition"
import { useSettings } from "#/ui/lib/settings"
import { stackedAxis } from "#/ui/lib/stacking"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"

/**
 * Vendor logos are drawn as model-coloured rects masked by the logo, so they read in
 * the model's colour on either theme. The library's scene has no image primitive, so
 * the masks live here and each logo's rect picks its mask up through a class.
 */
function LogoMasks({ logoClass }: { logoClass: Map<string, string> }) {
  if (logoClass.size === 0) return null

  const entries = Array.from(logoClass)

  return (
    // Image export copies these into the chart's own SVG, which has no other way to reach them.
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      className="absolute"
      {...{ [CHART_EXPORT_DEFS_ATTRIBUTE]: "" }}
    >
      <defs>
        {entries.map(([url, className]) => (
          // Alpha, not luminance: the logo is a dark shape on a transparent field.
          <mask
            key={className}
            id={`${className}-mask`}
            maskContentUnits="objectBoundingBox"
            style={{ maskType: "alpha" }}
          >
            <image href={url} width={1} height={1} preserveAspectRatio="xMidYMid meet" />
          </mask>
        ))}
      </defs>
      <style>
        {entries.map(([, className]) => `.${className}{mask:url(#${className}-mask)}`).join("")}
      </style>
    </svg>
  )
}

type ChartView = "ranges" | "scatter"

/**
 * The plot laid out afresh at the shared image's size rather than the screen's. It is
 * mounted out of sight inside the frame for the moment it takes to draw, so the page's
 * styles, fonts and logo masks reach it as they reach the chart on screen.
 */
async function sharePlotImage(
  frame: HTMLElement,
  definition: ChartDefinition<PlotPoint>,
  size: ChartSize,
  measureText: ChartTextMeasurer | undefined,
  scale: number,
) {
  const scene = createChartRuntime().render(definition, size, {
    measureText,
    typography: { fontFamily: getComputedStyle(frame).fontFamily },
  })
  const stage = document.createElement("div")

  stage.setAttribute("aria-hidden", "true")
  Object.assign(stage.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${size.width}px`,
    height: `${size.height}px`,
    pointerEvents: "none",
  })
  stage.innerHTML = renderChartSvg(scene, { ariaLabel: "", tabIndex: -1 })
  frame.append(stage)

  try {
    return await svgPlotImage(frame, scale, stage.querySelector("svg"))
  } finally {
    stage.remove()
  }
}

function describeRanges(data: PlotData) {
  const modelNoun = data.modelCount === 1 ? "model" : "models"
  const rowNoun = data.series.length === 1 ? "row" : "rows"

  return `Range chart of ${data.modelCount} ${modelNoun} in ${data.series.length} ${rowNoun}, one per model configuration, its efforts spread along the varying metric. Use arrow keys to move between points.`
}

/** A highlighted model wins over the frontier's emphasis, so the description says which fades. */
function describeFrontier(frontier: Array<PlotPoint>, highlighted: string | null) {
  const emphasis =
    highlighted == null
      ? "Variants off it are muted."
      : `${highlighted} is highlighted, so every other model is muted, the frontier's included.`

  return `The dashed line is the Pareto frontier, the effort variants no other variant beats on both axes: ${frontier.map((point) => point.label).join(", ")}. ${emphasis}`
}

/**
 * The toolbar toggles' look: on, they take a firmer fill and full-strength text than the
 * toggle's muted default, so their state reads at a glance.
 */
const TOOLBAR_TOGGLE_CLASS =
  "text-muted-foreground aria-pressed:bg-foreground/12 aria-pressed:text-foreground gap-1.5"
/** Swatches stay dim until their toggle is on. */
const TOOLBAR_SWATCH_CLASS =
  "size-auto overflow-visible opacity-40 transition-opacity group-aria-pressed/toggle:opacity-100"

/** A small dashed line with a bend, as the toggle's key. */
const FRONTIER_SWATCH = "M2 11 L7 4 L18 2"

/**
 * Shows or hides the frontier, and doubles as its key: the swatch names the dashed
 * line, which would otherwise read as one more model's run. On, it takes a firmer fill
 * and full-strength text than the toggle's muted default, so its state reads at a glance.
 */
function FrontierToggle({
  pressed,
  onPressedChange,
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={(next) => onPressedChange(next)}
      className={TOOLBAR_TOGGLE_CLASS}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="13"
        viewBox="0 0 20 13"
        // `size-auto` opts out of the toggle's square icon size, keeping the swatch wide.
        className={TOOLBAR_SWATCH_CLASS}
        fill="none"
        strokeLinecap="round"
      >
        <path
          d={FRONTIER_SWATCH}
          stroke={PARETO_STYLE.stroke}
          strokeWidth={PARETO_STYLE.strokeWidth}
          strokeDasharray="3.5 3"
        />
      </svg>
      Pareto frontier
    </Toggle>
  )
}

/** Ruler ticks that close up along the line, as on one decade of a log axis. */
const LOG_SWATCH = "M2 2 V11 M10 5 V11 M14.5 5 V11 M17 5 V11 M18.5 2 V11"

/**
 * Puts one axis on a log scale or back. It starts in the state detection picked (see
 * `axisScale`), and names the metric rather than the axis, since the range view lays
 * either metric out left to right.
 */
function LogToggle({
  label,
  pressed,
  onPressedChange,
}: {
  label: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={(next) => onPressedChange(next)}
      aria-label={`Log scale for ${label}`}
      className={TOOLBAR_TOGGLE_CLASS}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="13"
        viewBox="0 0 20 13"
        className={TOOLBAR_SWATCH_CLASS}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
      >
        <path d={LOG_SWATCH} />
      </svg>
      Log {label.charAt(0).toLowerCase() + label.slice(1)}
    </Toggle>
  )
}

/**
 * Lets the reader go back to the scatter when stacked efforts default to ranges. The
 * range view's axis title already says how rows are sorted, so the switch stays bare.
 */
function StackedViewSwitch({
  view,
  onChange,
}: {
  view: ChartView
  onChange: (view: ChartView) => void
}) {
  return (
    <ToggleGroup
      aria-label="Chart view"
      size="sm"
      variant="outline"
      spacing={0}
      value={[view]}
      onValueChange={(values) => {
        const next = values[0]

        if (next === "ranges" || next === "scatter") onChange(next)
      }}
    >
      <ToggleGroupItem value="ranges">Ranges</ToggleGroupItem>
      <ToggleGroupItem value="scatter">Scatter</ToggleGroupItem>
    </ToggleGroup>
  )
}

export function ComparisonChart({
  models,
  sources,
  xMetric,
  yMetric,
  highlight = null,
  getShareLink,
}: {
  models: Array<Model>
  sources: Record<"x" | "y", ProviderName | null>
  xMetric: Metric
  yMetric: Metric
  /** Model id to emphasise, e.g. while its picker pill is hovered. */
  highlight?: string | null
  /** The page's link to this exact comparison, for the share menu. */
  getShareLink?: () => string
}) {
  const info = useProvidersInfo()
  const frameRef = useRef<HTMLDivElement>(null)
  const measureText = useChartTextMeasurer()
  const logoPrefix = `chart-logo-${useId().replaceAll(/[^a-zA-Z0-9]/g, "")}`
  const { x: xSource, y: ySource } = sources
  // A reader's linear or log choice follows the metric, whichever axis it moves to; a
  // metric they have not touched takes the scale detection picks.
  const scaleKey = { x: `${xMetric}@${xSource}`, y: `${yMetric}@${ySource}` }
  const [scaleChoices, setScaleChoices] = useState<Record<string, AxisScale>>({})
  const xScale = scaleChoices[scaleKey.x]
  const yScale = scaleChoices[scaleKey.y]
  const data = useMemo(
    () =>
      buildPlotData(
        models,
        { x: xMetric, y: yMetric },
        {
          x: isRatioMetric(xMetric, xSource, info),
          y: isRatioMetric(yMetric, ySource, info),
        },
        { x: xScale, y: yScale },
      ),
    [models, xMetric, yMetric, xSource, ySource, info, xScale, yScale],
  )
  // One mask per vendor logo, shared by every point of that vendor.
  const logoClass = useMemo(() => {
    const urls = new Set(data.points.flatMap((point) => (point.logoUrl ? [point.logoUrl] : [])))

    return new Map(Array.from(urls, (url, index) => [url, `${logoPrefix}-${index}`]))
  }, [data, logoPrefix])

  // A selected model can still be off the chart for lack of a metric; emphasising it
  // would only dim everything that is plotted.
  const lit =
    highlight != null && data.series.some((series) => series.points[0]?.model.model === highlight)
      ? highlight
      : null
  const flat = useMemo(() => stackedAxis(data), [data])
  // The reader's choice holds for this pair of metrics; a new pair starts from the
  // view that suits it.
  const metricsKey = `${xMetric}/${yMetric}`
  const [choices, setChoices] = useState<Record<string, ChartView>>({})
  const view: ChartView = flat == null ? "scatter" : (choices[metricsKey] ?? "ranges")
  // The range view has no numeric axis to draw it along, so only the scatter shows it.
  const frontier = useMemo(() => (view === "scatter" ? drawnFrontier(data) : []), [data, view])
  // One switch for every pair of metrics: someone who hides the frontier wants it gone.
  // It is the same setting the header's settings carry, so the choice outlives the visit.
  const [settings, setSettings] = useSettings()
  const frontierOn = settings.paretoFrontier
  const setFrontierOn = (next: boolean) =>
    setSettings((current) => ({ ...current, paretoFrontier: next }))
  const hasFrontier = frontier.length > 0
  const showFrontier = hasFrontier && frontierOn
  // Rows in the range view have no numeric scale along the fixed metric, so only the
  // metric that spreads gets a switch there.
  const logAxes = (["x", "y"] as const).filter(
    (axis) => data.logAllowed[axis] && !(view === "ranges" && axis === flat),
  )
  const definition = useMemo(() => {
    const options = { highlight: lit, info, logoClass, sources: { x: xSource, y: ySource } }

    return view === "ranges" && flat != null
      ? rangeDefinition(data, { ...options, flat })
      : scatterDefinition(data, { ...options, frontier: frontierOn })
  }, [data, flat, view, lit, info, logoClass, xSource, ySource, frontierOn])

  // The range view grows with its rows; the scatter fits whatever height the page gives it.
  const frameStyle: ChartFrameStyle | undefined =
    view === "ranges"
      ? {
          [CHART_MIN_HEIGHT_VAR]: `${rangeMinHeight(data.series.length) + CHART_TOOLBAR_HEIGHT_PX}px`,
        }
      : undefined

  if (data.points.length === 0) {
    return <DataState className={CHART_FRAME_CLASS} title="No models have both selected metrics" />
  }

  return (
    <div
      ref={frameRef}
      className={`relative flex w-full flex-col ${CHART_FRAME_CLASS}`}
      data-chart-frame="loaded"
      style={frameStyle}
    >
      <LogoMasks logoClass={logoClass} />
      {/* A row of its own rather than an overlay: the plot's top-right corner is where
          the strongest, priciest models land. It wraps rather than overflow a phone. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
        {hasFrontier && <FrontierToggle pressed={frontierOn} onPressedChange={setFrontierOn} />}
        {logAxes.map((axis) => (
          <LogToggle
            key={axis}
            label={metricPresentation(data.metrics[axis]!, sources[axis], info).label}
            pressed={data.scales[axis] === "log"}
            onPressedChange={(next) =>
              setScaleChoices((previous) => ({
                ...previous,
                [scaleKey[axis]]: next ? "log" : "linear",
              }))
            }
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          {flat != null && (
            <StackedViewSwitch
              view={view}
              onChange={(next) => setChoices((previous) => ({ ...previous, [metricsKey]: next }))}
            />
          )}
          <ChartShareMenu
            data={data}
            sources={sources}
            getLink={getShareLink}
            renderPlot={(scale) => {
              if (!frameRef.current) throw new Error("Chart is not mounted")

              // Rows keep the height they need to stay apart, as they do on screen.
              const height =
                view === "ranges"
                  ? Math.max(SHARE_PLOT_SIZE.height, rangeMinHeight(data.series.length))
                  : SHARE_PLOT_SIZE.height

              return sharePlotImage(
                frameRef.current,
                definition,
                { width: SHARE_PLOT_SIZE.width, height },
                measureText,
                scale,
              )
            }}
          />
        </div>
      </div>
      {/* The plot fills a layer over its box rather than sizing by percentage: the box's
          height comes from the page's flex column, which a percentage can't resolve against. */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Chart
            key={view}
            definition={definition}
            ariaLabel={view === "ranges" ? describeRanges(data) : describePlot(data)}
            ariaDescription={
              view === "ranges" && flat != null
                ? rangeAxisDescription(data, flat, sources, info)
                : [
                    axisDescription(data, sources, info),
                    showFrontier &&
                      describeFrontier(
                        frontier,
                        data.series.find((series) => series.points[0]?.model.model === lit)
                          ?.label ?? null,
                      ),
                  ]
                    .filter(Boolean)
                    .join(" ")
            }
            initialWidth={1200}
            measureText={measureText}
            style={{ height: "100%" }}
            // A custom body drops the library's card chrome, so the card brings its own.
            renderTooltipBody={({ points, primaryPoint }) => {
              const point = focusedPoint(points, primaryPoint)

              return point ? (
                <div className={CHART_TOOLTIP_CARD_CLASS} style={{ width: CHART_TOOLTIP_WIDTH }}>
                  <PointDetails axes={data.axes} metrics={data.metrics} point={point} />
                </div>
              ) : null
            }}
          />
        </div>
      </div>
    </div>
  )
}
