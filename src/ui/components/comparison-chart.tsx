import { Chart } from "@tanstack/charts/react/tooltip"
import { useId, useMemo, useRef, useState } from "react"

import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"
import type { Model } from "#/ui/lib/model-view"

import { ChartShareMenu } from "#/ui/components/chart-share-menu"
import { DataState } from "#/ui/components/data-state"
import { PointDetails } from "#/ui/components/point-details"
import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"
import { axisDescription, rangeAxisDescription } from "#/ui/lib/chart-axes"
import { CHART_EXPORT_DEFS_ATTRIBUTE, svgPlotImage } from "#/ui/lib/chart-image"
import { CHART_TOOLTIP_CARD_CLASS, CHART_TOOLTIP_WIDTH } from "#/ui/lib/chart-styles"
import { focusedPoint } from "#/ui/lib/chart-tooltip"
import { buildPlotData, describePlot, type PlotData } from "#/ui/lib/comparison-plot-data"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { rangeDefinition, rangeMinHeight } from "#/ui/lib/range-definition"
import { scatterDefinition } from "#/ui/lib/scatter-definition"
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

function describeRanges(data: PlotData) {
  const modelNoun = data.modelCount === 1 ? "model" : "models"
  const rowNoun = data.series.length === 1 ? "row" : "rows"

  return `Range chart of ${data.modelCount} ${modelNoun} in ${data.series.length} ${rowNoun}, one per model configuration, its efforts spread along the varying metric. Use arrow keys to move between points.`
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
  const logoPrefix = `chart-logo-${useId().replaceAll(/[^a-zA-Z0-9]/g, "")}`
  const data = useMemo(
    () => buildPlotData(models, { x: xMetric, y: yMetric }),
    [models, xMetric, yMetric],
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
  const { x: xSource, y: ySource } = sources
  const definition = useMemo(() => {
    const options = { highlight: lit, info, logoClass, sources: { x: xSource, y: ySource } }

    return view === "ranges" && flat != null
      ? rangeDefinition(data, { ...options, flat })
      : scatterDefinition(data, options)
  }, [data, flat, view, lit, info, logoClass, xSource, ySource])

  if (data.points.length === 0) {
    return <DataState className={CHART_HEIGHT_CLASS} title="No models have both selected metrics" />
  }

  return (
    <div
      ref={frameRef}
      className={`relative flex w-full flex-col ${CHART_HEIGHT_CLASS}`}
      data-chart-frame="loaded"
      style={
        view === "ranges"
          ? { minHeight: Math.max(512, rangeMinHeight(data.series.length) + 40), maxHeight: "none" }
          : undefined
      }
    >
      <LogoMasks logoClass={logoClass} />
      {/* A row of its own rather than an overlay: the plot's top-right corner is where
          the strongest, priciest models land. */}
      <div className="flex shrink-0 items-center justify-end gap-2 pb-2">
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

            return svgPlotImage(frameRef.current, scale)
          }}
        />
      </div>
      <div className="min-h-0 flex-1">
        <Chart
          key={view}
          definition={definition}
          ariaLabel={view === "ranges" ? describeRanges(data) : describePlot(data)}
          ariaDescription={
            view === "ranges" && flat != null
              ? rangeAxisDescription(data, flat, sources, info)
              : axisDescription(data, sources, info)
          }
          initialWidth={1200}
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
  )
}
