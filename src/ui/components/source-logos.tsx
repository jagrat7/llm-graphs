import type { ProviderName } from "#/ui/lib/orpc-client"

import { SourceLogo } from "#/ui/components/source-logo"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { sourceLabel } from "#/ui/lib/sources"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

/**
 * A row of source marks that names every source on hover. Past `max` marks the
 * row stops reading as a glance, so the rest collapse behind a count that takes
 * a mark's slot — a crowded row is no wider than a full one.
 */
export function SourceLogos({
  sources,
  max = Infinity,
  className,
}: {
  sources: ReadonlyArray<ProviderName>
  max?: number
  className?: string
}) {
  const info = useProvidersInfo()
  const label = sources.map((source) => sourceLabel(source, info)).join(" · ")
  const shown = sources.length > max ? sources.slice(0, max - 1) : sources
  const hiddenCount = sources.length - shown.length

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={label}
            className={cn("text-muted-foreground inline-flex items-center gap-1.5", className)}
          />
        }
      >
        {shown.map((source) => (
          <SourceLogo key={source} source={source} className="size-3" />
        ))}
        {hiddenCount > 0 ? <span className="text-xs tabular-nums">+{hiddenCount}</span> : null}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
