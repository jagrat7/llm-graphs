import { RiAddLine, RiCloseLine } from "@remixicon/react"

import type { Metric } from "#/ui/lib/metrics"

import { SourceLogos } from "#/ui/components/source-logos"
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
import { isMetric, metricProviders, METRICS, METRIC_CONFIG } from "#/ui/lib/metrics"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

export type Axis = "X" | "Y" | "Z"

const EMPTY_CHIP_CLASS =
  "border-primary/40 text-accent-foreground border-dashed hover:text-accent-foreground"

/** Past this many marks a menu row stops reading as a glance. */
const MAX_PROVIDER_LOGOS = 4

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
  const info = useProvidersInfo()
  const isEmpty = value == null
  const label = isEmpty ? `Add ${axis} axis` : `${axis}-axis metric`
  const metricLabel = value == null ? null : METRIC_CONFIG[value].shortLabel

  return (
    <ButtonGroup className={cn("w-full min-w-0", className)}>
      <Select
        value={value ?? ""}
        onValueChange={(metric) => {
          if (metric != null && isMetric(metric)) onChange(metric)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          size="xl"
          aria-label={label}
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground w-full min-w-0 justify-between gap-2 px-3 shadow-none",
            isEmpty ? EMPTY_CHIP_CLASS : null,
          )}
        >
          <span className="sr-only">{label}</span>
          {isEmpty ? (
            <span aria-hidden="true" className="flex items-center gap-2 font-semibold">
              <RiAddLine className="text-primary size-4" />
              Add
            </span>
          ) : (
            // The trigger's flex row defeats `line-clamp`, so the label truncates itself.
            <SelectValue className="text-foreground min-w-0 font-semibold">
              <span className="truncate">{metricLabel}</span>
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="text-field w-max max-w-(--available-width) min-w-(--anchor-width) duration-200 ease-out motion-reduce:animate-none"
        >
          <SelectGroup>
            {METRICS.map((metric) => (
              <SelectItem
                key={metric}
                value={metric}
                disabled={unavailable.includes(metric)}
                className="pr-7"
              >
                {METRIC_CONFIG[metric].shortLabel}
                {/* Which providers publish the metric, so a choice can be weighed before it is
                    made. Hidden from the option's name, which stays the metric alone; a
                    disabled item swallows pointer events, so the marks opt back in. */}
                <span aria-hidden="true" className="ml-auto pl-4">
                  <SourceLogos
                    sources={metricProviders(metric, info)}
                    max={MAX_PROVIDER_LOGOS}
                    className="pointer-events-auto gap-1"
                  />
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {onRemove ? (
        <Tooltip>
          {/* Shares the select's size step, so it reads as the other half of one control
              rather than a sliver welded to the side of the field. */}
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-xl"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove ${axis} axis and return to the 2D chart`}
                className="text-muted-foreground"
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
