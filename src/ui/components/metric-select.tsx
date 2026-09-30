import { RiAddLine, RiCloseLine } from "@remixicon/react"

import type { Metric } from "#/ui/lib/metrics"

import { Button } from "#/ui/components/ui/button"
import { ButtonGroup } from "#/ui/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/ui/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { isMetric, METRICS, METRIC_CONFIG } from "#/ui/lib/metrics"
import { cn } from "#/ui/lib/utils"

export type Axis = "X" | "Y" | "Z"

const EMPTY_CHIP_CLASS =
  "border-primary/40 text-accent-foreground border-dashed hover:text-accent-foreground"

export function MetricSelect({
  axis,
  value,
  onChange,
  onRemove,
  unavailable = [],
  className,
  disabled = false,
}: {
  axis: Axis
  /** `null` renders the empty ghost slot that offers to add this axis. */
  value: Metric | null
  onChange: (metric: Metric) => void
  onRemove?: () => void
  unavailable?: ReadonlyArray<Metric>
  className?: string
  disabled?: boolean
}) {
  const isEmpty = value == null
  const label = isEmpty ? `Add ${axis} axis` : `${axis}-axis metric`
  const metricLabel = value == null ? null : METRIC_CONFIG[value].shortLabel

  return (
    <ButtonGroup className={cn("w-full", className)}>
      <Select
        value={value ?? ""}
        onValueChange={(metric) => {
          if (metric != null && isMetric(metric)) onChange(metric)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={label}
          className={cn(
            "text-muted-foreground w-full justify-between gap-2 px-3 text-sm shadow-none hover:bg-muted hover:text-foreground min-h-11 sm:min-h-9 w-full",
            isEmpty ? EMPTY_CHIP_CLASS : null,
          )}
        >
          <span className="sr-only">{label}</span>
          {isEmpty ? (
            <span aria-hidden="true" className="flex items-center gap-2 font-semibold">
              <RiAddLine className="text-primary size-4" />
              Add {axis} axis
            </span>
          ) : (
            <SelectValue className="text-foreground font-semibold">{metricLabel}</SelectValue>
          )}
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="duration-200 ease-out motion-reduce:animate-none"
        >
          <SelectGroup>
            {METRICS.map((metric) => (
              <SelectItem
                key={metric}
                value={metric}
                disabled={unavailable.includes(metric)}
                className="min-h-11 text-sm sm:min-h-8"
              >
                {METRIC_CONFIG[metric].shortLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {onRemove ? (
        <Tooltip>
          {/* Shares the select's height, so it has to share its footprint too — at
              `icon-sm` the button reads as a sliver welded to the side of the field
              rather than the other half of one control. */}
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove ${axis} axis and return to the 2D chart`}
                className="text-muted-foreground min-h-11 sm:min-h-9"
              >
                <RiCloseLine aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Remove {axis} axis</TooltipContent>
        </Tooltip>
      ) : null}
    </ButtonGroup>
  )
}
