import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"

import { SourceLogo } from "#/ui/components/source-logo"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/ui/components/ui/select"
import { metricProviders } from "#/ui/lib/metrics"
import { isSource, sourceLabel } from "#/ui/lib/sources"
import { cn } from "#/ui/lib/utils"

/**
 * "via" is the shared left edge of every row, so it carries no padding — the
 * inset belongs to what follows it, matching the select trigger's own `px-2`
 * so the marks line up whether the row is a control or plain attribution.
 */
const VIA_ROW_CLASS = "text-muted-foreground text-sm sm:text-xs flex items-center gap-1.5"

/**
 * A metric published by a single provider has no choice to offer, so it reads as
 * plain attribution. Only a genuinely contested metric becomes a control.
 */
export function SourceSelect({
  axis,
  metric,
  value,
  onChange,
  className,
  disabled = false,
}: {
  axis: string
  metric: Metric
  value: ProviderName
  onChange: (source: ProviderName) => void
  className?: string
  disabled?: boolean
}) {
  const info = useProvidersInfo()
  const sources = metricProviders(metric, info)

  if (metric === "cost" || sources.length < 2) {
    return (
      <p className={cn(VIA_ROW_CLASS, className)}>
        <span aria-hidden="true">via</span>
        <span className="flex min-h-11 items-center gap-1.5 truncate px-2 sm:min-h-8">
          <SourceLogo source={value} className="size-3" accent />
          <span className="truncate">{sourceLabel(value, info)}</span>
        </span>
      </p>
    )
  }

  return (
    <p className={cn(VIA_ROW_CLASS, className)}>
      <span aria-hidden="true">via</span>
      <Select
        value={value}
        onValueChange={(source) => {
          if (source != null && isSource(source, info)) onChange(source)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          aria-label={`${axis}-axis data source`}
          className="text-muted-foreground hover:border-input hover:bg-muted hover:text-foreground min-h-11 min-w-0 gap-1.5 border-transparent bg-transparent px-2 text-sm shadow-none sm:min-h-8 sm:text-xs"
        >
          {/* Base UI resolves the label from the raw value, so the mark is rendered here. */}
          {/* The trigger lays the value out as a flex row, which kills the registry's
              `line-clamp`; the label carries its own truncation instead. */}
          <SelectValue className="min-w-0">
            {(selected: ProviderName) => (
              <>
                <SourceLogo source={selected} className="size-3" />
                <span className="truncate">{sourceLabel(selected, info)}</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="duration-200 ease-out motion-reduce:animate-none"
        >
          {/* A menu that reads louder than the trigger that opened it inverts the
              hierarchy, so the items ride the same annotation step. */}
          <SelectGroup>
            {sources.map((source) => (
              <SelectItem
                key={source}
                value={source}
                className="min-h-11 text-sm sm:min-h-8 sm:text-xs"
              >
                <SourceLogo source={source} className="size-3" />
                {sourceLabel(source, info)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </p>
  )
}
