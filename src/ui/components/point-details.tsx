import type { Metric } from "#/ui/lib/metrics"
import type { PlotAxis, PlotPoint } from "#/ui/lib/comparison-plot-data"

import { ModelLogo } from "#/ui/components/model-logo"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { formatMetric, metricPresentation, METRIC_CONFIG } from "#/ui/lib/metrics"

/**
 * The active-point readout shared by both charts' floating popovers, so the 2D and
 * 3D renderers show the same values, units and provenance.
 */
export function PointDetails({
  axes,
  className,
  metrics,
  point,
}: {
  axes: ReadonlyArray<PlotAxis>
  className?: string
  metrics: Record<PlotAxis, Metric | null>
  point: PlotPoint
}) {
  const info = useProvidersInfo()
  const effort = point.model.effort === "default" ? null : point.model.effort
  const displayedDetails = new Set<string>()

  return (
    <div className={className}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium">
        <ModelLogo
          logoUrl={point.model.logoUrl}
          className="text-muted-foreground size-3.5 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">{point.model.displayName}</span>
        {effort ? (
          <span className="text-muted-foreground basis-full pl-5 text-xs font-normal">
            {effort}
          </span>
        ) : null}
      </div>
      <dl className="mt-2 flex flex-col gap-1">
        {axes.map((axis) => {
          const metric = metrics[axis]

          if (metric == null) return null

          const source = point.model.sources[METRIC_CONFIG[metric].dataKey]
          const abbreviation = source == null ? null : info.sources[source].abbreviation
          const measurement = point.model.measurements?.[METRIC_CONFIG[metric].dataKey]
          const presentation = metricPresentation(metric, source, info)
          const detail = measurement?.detail
          const showDetail = detail != null && !displayedDetails.has(detail)
          if (detail) displayedDetails.add(detail)

          return (
            <div
              key={axis}
              title={
                measurement
                  ? `${measurement.label}${measurement.detail ? ` · ${measurement.detail}` : ""}${measurement.updatedAt ? ` · ${measurement.updatedAt.slice(0, 10)}` : ""}`
                  : undefined
              }
              className="flex flex-col gap-0.5 text-xs"
            >
              <dt className="text-muted-foreground min-w-0 truncate">
                <span className="text-foreground font-medium">{axis.toUpperCase()}</span>{" "}
                {presentation.label}
              </dt>
              <dd className="flex flex-wrap items-baseline gap-x-1 font-medium tabular-nums">
                {formatMetric(point.values[axis], metric, source, info)}
                {metric === "cost"
                  ? "/task"
                  : presentation.format === "currency"
                    ? "/M tokens"
                    : null}
                {metric === "speed" ? " tokens/s" : null}
                {presentation.format === "tokens" ? " tokens" : null}
                {metric === "votes" ? " votes" : null}
                {metric === "score" && presentation.format === "number"
                  ? ` ${presentation.unit}`
                  : null}
                {measurement?.interval ? (
                  <span className="text-muted-foreground font-normal whitespace-nowrap">
                    ({formatMetric(measurement.interval.low, metric, source, info)}–
                    {formatMetric(measurement.interval.high, metric, source, info)})
                  </span>
                ) : null}
                {measurement?.preliminary ? (
                  <span className="text-muted-foreground font-normal">preliminary</span>
                ) : null}
                {abbreviation ? (
                  <span className="text-muted-foreground font-normal">{abbreviation}</span>
                ) : null}
              </dd>
              {showDetail ? (
                <dd className="text-muted-foreground text-xs wrap-anywhere">{detail}</dd>
              ) : null}
              {measurement?.updatedAt ? (
                <dd className="text-muted-foreground text-xs">
                  Updated {measurement.updatedAt.slice(0, 10)}
                </dd>
              ) : null}
            </div>
          )
        })}
      </dl>
    </div>
  )
}
