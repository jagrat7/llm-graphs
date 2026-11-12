import { createChartRuntime } from "@tanstack/charts"
import { renderChartSvg } from "@tanstack/charts/svg"
import { Chart } from "@tanstack/charts/react/tooltip"
import { useId, useMemo, useRef, useState } from "react"

import type { ChartDefinition, ChartSize, ChartTextMeasurer } from "@tanstack/charts"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/server/api"
import type { Model } from "#/ui/lib/model-view"

import { ChartImportButton } from "#/ui/components/chart-import-button"
import { ChartShareMenu } from "#/ui/components/chart-share-menu"
import { DataState } from "#/ui/components/data-state"
import { PointDetails } from "#/ui/components/point-details"
import { Toggle } from "#/ui/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"
import { isRatioMetric, metricPresentation } from "#/ui/lib/metrics"
import { axisDescription, barAxisDescription } from "#/ui/lib/chart-axes"
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
  CHART_TOOLBAR_CLASS,
  CHART_TOOLBAR_ACTIONS_CLASS,
  CHART_TOOLBAR_CONTROLS_CLASS,
} from "#/ui/lib/layout-styles"
import { PARETO_STYLE } from "#/ui/lib/chart-marks"
import { barDefinition, barsMinWidth } from "#/ui/lib/bar-definition"
import { drawnFrontier } from "#/ui/lib/pareto"
import { scatterDefinition } from "#/ui/lib/scatter-definition"
import { useSetting } from "#/ui/lib/settings"
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

type ChartView = "bars" | "scatter"

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

function describeBars(data: PlotData) {
  const modelNoun = data.modelCount === 1 ? "model" : "models"
  const groupNoun = data.series.length === 1 ? "group" : "groups"

  return `Bar chart of ${data.modelCount} ${modelNoun} in ${data.series.length} ${groupNoun}, one per model configuration, with one bar per effort sized by the varying metric. Use arrow keys to move between bars.`
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
 * Puts one axis on a log scale or back. It starts linear, and names the metric rather
 * than the axis, since the views lay a metric out on whichever side suits them.
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
 * Lets the reader go back to the scatter when stacked efforts default to bars. The
 * bar view's axis title already says how groups are sorted, so the switch stays bare.
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

        if (next === "bars" || next === "scatter") onChange(next)
      }}
    >
      <ToggleGroupItem value="bars">Bars</ToggleGroupItem>
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
  logMetrics,
  onLogMetricChange,
}: {
  models: Array<Model>
  sources: Record<"x" | "y", ProviderName | null>
  xMetric: Metric
  yMetric: Metric
  /** Model id to emphasise, e.g. while its picker pill is hovered. */
  highlight?: string | null
  /** The page's link to this exact comparison, for the share menu. */
  getShareLink?: () => string
  /** Metrics the reader put on a log scale; every other axis is linear. */
  logMetrics: ReadonlyArray<Metric>
  onLogMetricChange: (metric: Metric, log: boolean) => void
}) {
  const info = useProvidersInfo()
  const frameRef = useRef<HTMLDivElement>(null)
  const measureText = useChartTextMeasurer()
  const logoPrefix = `chart-logo-${useId().replaceAll(/[^a-zA-Z0-9]/g, "")}`
  const { x: xSource, y: ySource } = sources
  // A log choice follows the metric, whichever axis it moves to.
  const scaleOf = (metric: Metric): AxisScale => (logMetrics.includes(metric) ? "log" : "linear")
  const xScale = scaleOf(xMetric)
  const yScale = scaleOf(yMetric)
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
  const view: ChartView = flat == null ? "scatter" : (choices[metricsKey] ?? "bars")
  // The bar view has no numeric axis to draw it along, so only the scatter shows it.
  const frontier = useMemo(() => (view === "scatter" ? drawnFrontier(data) : []), [data, view])
  // One switch for every pair of metrics: someone who hides the frontier wants it gone.
  // It is the same setting the header's settings carry, so the choice outlives the visit.
  const [frontierOn, setFrontierOn] = useSetting("paretoFrontier")
  const [paperGrid] = useSetting("paperGrid")
  const hasFrontier = frontier.length > 0
  const showFrontier = hasFrontier && frontierOn
  // Everything the bar view and the scatter draw differently, decided in one place.
  const plot = useMemo(() => {
    const plotSources = { x: xSource, y: ySource }
    const options = { highlight: lit, info, logoClass, sources: plotSources }

    if (view === "bars" && flat != null) {
      return {
        definition: barDefinition(data, { ...options, flat }),
        label: describeBars(data),
        description: barAxisDescription(data, flat, plotSources, info),
        // Bars keep a readable width on a narrow screen, which scrolls sideways to reach them.
        minWidth: barsMinWidth(data),
        // Bars stand on zero and groups have no scale at all, so only the scatter goes log.
        logAxes: [],
      }
    }

    const litLabel =
      data.series.find((series) => series.points[0]?.model.model === lit)?.label ?? null

    return {
      definition: scatterDefinition(data, { ...options, frontier: frontierOn, paperGrid }),
      label: describePlot(data),
      description: [
        axisDescription(data, plotSources, info),
        showFrontier && describeFrontier(frontier, litLabel),
      ]
        .filter(Boolean)
        .join(" "),
      minWidth: undefined,
      logAxes: (["x", "y"] as const).filter((axis) => data.logAllowed[axis]),
    }
  }, [
    data,
    flat,
    view,
    lit,
    info,
    logoClass,
    xSource,
    ySource,
    frontierOn,
    paperGrid,
    showFrontier,
    frontier,
  ])
  const { definition, minWidth } = plot

  if (data.points.length === 0) {
    return <DataState className={CHART_FRAME_CLASS} title="No models have both selected metrics" />
  }

  return (
    <div
      ref={frameRef}
      className={`relative flex w-full flex-col ${CHART_FRAME_CLASS}`}
      data-chart-frame="loaded"
    >
      <LogoMasks logoClass={logoClass} />
      <div className={CHART_TOOLBAR_CLASS}>
        <div className={CHART_TOOLBAR_CONTROLS_CLASS}>
          {hasFrontier && <FrontierToggle pressed={frontierOn} onPressedChange={setFrontierOn} />}
          {plot.logAxes.map((axis) => (
            <LogToggle
              key={axis}
              label={metricPresentation(data.metrics[axis]!, sources[axis], info).label}
              pressed={data.scales[axis] === "log"}
              onPressedChange={(next) => onLogMetricChange(data.metrics[axis]!, next)}
            />
          ))}
          {flat != null && (
            <StackedViewSwitch
              view={view}
              onChange={(next) => setChoices((previous) => ({ ...previous, [metricsKey]: next }))}
            />
          )}
        </div>
        <div className={CHART_TOOLBAR_ACTIONS_CLASS}>
          <ChartImportButton />
          <ChartShareMenu
            data={data}
            sources={sources}
            getLink={getShareLink}
            renderPlot={(scale) => {
              if (!frameRef.current) throw new Error("Chart is not mounted")

              // Bars keep the width they need to stay apart, as they do on screen.
              const width = Math.max(SHARE_PLOT_SIZE.width, minWidth ?? 0)

              return sharePlotImage(
                frameRef.current,
                definition,
                { width, height: SHARE_PLOT_SIZE.height },
                measureText,
                scale,
              )
            }}
          />
        </div>
      </div>
      {/* The plot fills a layer over its box rather than sizing by percentage: the box's
          height comes from the page's flex column, which a percentage can't resolve against.
          The bar view's groups set the layer's minimum width, so a narrow screen scrolls
          sideways through them rather than squeezing every bar to a hairline. */}
      <div data-slot="chart-plot" className="relative min-h-0 flex-1">
        <div
          data-slot="chart-scroll"
          className={`absolute inset-0 ${minWidth == null ? "" : "overflow-x-auto overflow-y-hidden"}`}
        >
          <Chart
            key={view}
            definition={definition}
            ariaLabel={plot.label}
            ariaDescription={plot.description}
            initialWidth={1200}
            measureText={measureText}
            style={{ height: "100%", minWidth }}
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
