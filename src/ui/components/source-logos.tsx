import type { ProviderName } from "#/ui/lib/orpc-client"

import { SourceLogo } from "#/ui/components/source-logo"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { sourceLabel } from "#/ui/lib/sources"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

/** Source marks with icon-and-name tooltips; the overflow count takes one of `max` slots. */
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
  const shown = sources.length > max ? sources.slice(0, max - 1) : sources
  const hidden = sources.slice(shown.length)

  return (
    <span className={cn("text-muted-foreground inline-flex items-center gap-1.5", className)}>
      {[shown, hidden].map((group, index) =>
        group.length > 0 ? (
          <Tooltip key={index === 0 ? "visible" : "overflow"}>
            <TooltipTrigger
              render={<span />}
              aria-label={group.map((source) => sourceLabel(source, info)).join(" · ")}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-[inherit]",
                index === 1 ? "rounded-sm px-0.5 text-xs tabular-nums" : null,
              )}
            >
              {index === 0 ? (
                group.map((source) => (
                  <SourceLogo key={source} source={source} className="size-3" />
                ))
              ) : (
                <>+{group.length}</>
              )}
            </TooltipTrigger>
            {/* Tooltip backgrounds invert the page theme; monochrome marks must follow. */}
            <TooltipContent
              side={index === 1 ? "right" : "top"}
              className="flex-col items-start gap-1 [color-scheme:dark] dark:[color-scheme:light]"
            >
              {group.map((source) => (
                <span key={source} className="flex items-center gap-1.5">
                  <SourceLogo source={source} className="size-3" />
                  {sourceLabel(source, info)}
                </span>
              ))}
            </TooltipContent>
          </Tooltip>
        ) : null,
      )}
    </span>
  )
}
