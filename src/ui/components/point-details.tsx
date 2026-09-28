import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"
import type { PlotAxis, PlotPoint } from "#/ui/lib/comparison-plot-data"

import { ModelLogo } from "#/ui/components/model-logo"
import { formatMetric, METRIC_CONFIG } from "#/ui/lib/metrics"

const SOURCE_ABBREVIATIONS: Record<ProviderName, string> = {
  deepswe: "D",
  artificialAnalysis: "AA",
}

function sourceAbbreviation(point: PlotPoint, metric: Metric) {
  const source = point.model.sources[METRIC_CONFIG[metric].dataKey]

  return source == null ? null : SOURCE_ABBREVIATIONS[source]
}

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
  const effort = point.model.effort === "default" ? null : point.model.effort

  return (
    <div className={className}>
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
        <ModelLogo
          logoUrl={point.model.logoUrl}
          className="text-muted-foreground size-3.5 shrink-0"
        />
        <span className="truncate">{point.model.displayName}</span>
        {effort ? (
          <span className="text-muted-foreground shrink-0 text-xs font-normal">· {effort}</span>
        ) : null}
      </div>
      <dl className="mt-2 space-y-1">
        {axes.map((axis) => {
          const metric = metrics[axis]

          if (metric == null) return null

          const abbreviation = sourceAbbreviation(point, metric)

          return (
            <div key={axis} className="flex items-baseline justify-between gap-4 text-xs">
              <dt className="text-muted-foreground min-w-0 truncate">
                <span className="text-foreground font-medium">{axis.toUpperCase()}</span>{" "}
                {METRIC_CONFIG[metric].label}
              </dt>
              <dd className="shrink-0 font-medium tabular-nums">
                {formatMetric(point.values[axis], metric)}
                {abbreviation ? (
                  <span className="text-muted-foreground ml-1 font-normal">{abbreviation}</span>
                ) : null}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
