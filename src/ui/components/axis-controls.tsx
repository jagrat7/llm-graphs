import { RiArrowUpDownLine } from "@remixicon/react"
import { Fragment } from "react"

import type { Axis } from "#/ui/components/metric-select"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/server/api"

import { MetricSelect } from "#/ui/components/metric-select"
import { SourceSelect } from "#/ui/components/source-select"
import { Button } from "#/ui/components/ui/button"
import { Separator } from "#/ui/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { METRICS } from "#/ui/lib/metrics"
import { cn } from "#/ui/lib/utils"

export const AXIS_KEYS = ["x", "y", "z"] as const

export type AxisKey = (typeof AXIS_KEYS)[number]

const AXIS_LABELS: Record<AxisKey, Axis> = { x: "X", y: "Y", z: "Z" }
/** An empty `metric` is the unfilled Z slot that offers the third dimension. */
export type AxisSetting = { metric: Metric | null; source: ProviderName | null }
export type AxisState = Record<AxisKey, AxisSetting>

/** Ink and weight make the axis letters a structural spine; size keeps them under the metric. */
const AXIS_LABEL_CLASS = "text-foreground text-control font-semibold"

/**
 * A swap is a hinge between two adjacent rows, so each button spans both and
 * centres on the edge they share — which is exactly the space the axis letters
 * leave empty. Both live in one rail: letters at its outer edge, hinges pushed
 * up against the fields they trade, so neither costs the rows a column of its
 * own. Only neighbours trade places: X↔Y always, and Y↔Z once the depth axis is
 * filled. Tailwind needs the row start spelled out.
 */
const SWAP_PAIRS = [
  { from: "x", to: "y", rowStartClass: "row-start-1" },
  { from: "y", to: "z", rowStartClass: "row-start-2" },
] as const satisfies ReadonlyArray<{ from: AxisKey; to: AxisKey; rowStartClass: string }>

/** Letters and hinges contest the rail, so every cell states its row outright. */
const AXIS_ROW_START_CLASSES = ["row-start-1", "row-start-2", "row-start-3"] as const

export function AxisControls({
  axes,
  onAxisChange,
  onSwapAxes,
  disabled = false,
  unavailableMetrics,
  children,
}: {
  axes: AxisState
  onAxisChange: (axis: AxisKey, change: Partial<AxisSetting>) => void
  onSwapAxes: (first: AxisKey, second: AxisKey) => void
  disabled?: boolean
  unavailableMetrics?: Partial<Record<AxisKey, ReadonlyArray<Metric>>>
  /** The strip's right-hand side — the model picker in practice. */
  children?: React.ReactNode
}) {
  const used = AXIS_KEYS.map((key) => axes[key].metric).filter(
    (metric): metric is Metric => metric != null,
  )
  const hasSpareMetric = METRICS.some(
    (metric) => !used.includes(metric) && !unavailableMetrics?.z?.includes(metric),
  )

  return (
    // Side by side, the two halves are equal columns either side of the divider. The grid
    // fits its content, so both columns take the wider side's width (the axes': the picker's
    // chips contain their own size and ask for none) and the strip stays symmetric about the
    // divider, centred over the chart. The row stretches the picker to the axes' height, so
    // neither pushes the chart down on its own.
    <div className="mx-auto mb-6 flex w-full max-w-lg flex-col gap-3 min-[56rem]:grid min-[56rem]:w-fit min-[56rem]:max-w-none min-[56rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[56rem]:gap-4">
      {/* Every cell names its own column, so a row can drop its source mark and the
          rail can carry letters and hinges at once. Slack belongs to the source
          column, not the metric one: metric names are short and fixed, provider
          names are long and varied. Letting the metric track take the row instead
          balloons three selects into the widest thing on the page — which is what
          made the strip read as lopsided against the picker — while the attribution
          that actually needs the room truncates. The metric floor stays, so on a
          phone the source beside it can't squeeze out the label. The metric ceiling
          fits the longest metric plus the Z row's remove button, so that row never
          spills into "via". The source column hugs its widest name, so the divider
          follows the labels instead of leaving a hole before the picker, and the
          picker's column matches it. */}
      <div className="grid flex-1 grid-cols-[--spacing(6)_minmax(--spacing(32),--spacing(50))_minmax(0,max-content)] items-center gap-x-2 gap-y-1.5 min-[56rem]:min-w-0 min-[56rem]:flex-initial">
        {AXIS_KEYS.map((key, index) => {
          const { metric, source } = axes[key]
          const swap = SWAP_PAIRS.find((pair) => pair.from === key)

          return (
            <Fragment key={key}>
              <AxisRow
                axis={AXIS_LABELS[key]}
                rowStartClass={AXIS_ROW_START_CLASSES[index]}
                metric={metric}
                source={source}
                unavailable={[
                  ...used.filter((candidate) => candidate !== metric),
                  ...(unavailableMetrics?.[key] ?? []),
                ]}
                onMetricChange={(next) => onAxisChange(key, { metric: next })}
                onSourceChange={(next) => onAxisChange(key, { source: next })}
                onRemove={
                  key === "z" && metric != null
                    ? () => onAxisChange(key, { metric: null })
                    : undefined
                }
                disabled={disabled || (metric == null && !hasSpareMetric)}
              />
              {swap && metric != null && axes[swap.to].metric != null ? (
                <SwapAxesButton
                  first={AXIS_LABELS[swap.from]}
                  second={AXIS_LABELS[swap.to]}
                  rowStartClass={swap.rowStartClass}
                  onSwap={() => onSwapAxes(swap.from, swap.to)}
                  disabled={disabled}
                />
              ) : null}
            </Fragment>
          )
        })}
      </div>

      {/* Orientation is a prop rather than a class, so the stacked and side-by-side
          rules each need their own separator; only one is ever in the tree. */}
      <Separator className="min-[56rem]:hidden" />
      <Separator orientation="vertical" className="hidden self-stretch min-[56rem]:block" />

      {children}
    </div>
  )
}

function SwapAxesButton({
  first,
  second,
  rowStartClass,
  onSwap,
  disabled,
}: {
  first: Axis
  second: Axis
  rowStartClass: string
  onSwap: () => void
  disabled: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSwap}
            aria-label={`Swap the ${first} and ${second} axes`}
            disabled={disabled}
            // The rail is a fixed column, so the hinge keeps its width and takes a row's height.
            className={cn(
              "text-muted-foreground h-control-lg col-start-1 row-span-2 w-6 justify-self-end",
              rowStartClass,
            )}
          >
            <RiArrowUpDownLine aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>
        Swap {first} and {second}
      </TooltipContent>
    </Tooltip>
  )
}

function AxisRow({
  axis,
  rowStartClass,
  metric,
  source,
  unavailable,
  onMetricChange,
  onSourceChange,
  onRemove,
  disabled,
}: {
  axis: Axis
  rowStartClass: string
  metric: Metric | null
  source: ProviderName | null
  unavailable: ReadonlyArray<Metric>
  onMetricChange: (metric: Metric) => void
  onSourceChange: (source: ProviderName) => void
  onRemove?: () => void
  disabled: boolean
}) {
  return (
    <>
      {/* Shares the rail with the hinges, which reach past the row on touch —
          `relative` keeps the letter over their press fill rather than under it. */}
      <span
        aria-hidden="true"
        className={cn("relative col-start-1 justify-self-start", rowStartClass, AXIS_LABEL_CLASS)}
      >
        {axis}
      </span>
      <MetricSelect
        axis={axis}
        value={metric}
        onChange={onMetricChange}
        onRemove={onRemove}
        unavailable={unavailable}
        className={cn("col-start-2", rowStartClass)}
        disabled={disabled}
      />
      {metric != null && source != null ? (
        <SourceSelect
          axis={axis}
          metric={metric}
          value={source}
          onChange={onSourceChange}
          className={cn("col-start-3", rowStartClass)}
          disabled={disabled}
        />
      ) : null}
    </>
  )
}
