import type { CSSProperties } from "react"

import { cn } from "#/ui/lib/utils"

type MaskStyle = CSSProperties & { "--logo": string }

/**
 * A vendor's models.dev logo, drawn as a mask over `currentColor` so it stays muted like the
 * surrounding text. The SVG is only ever an image source, never markup in the page. A vendor
 * without a real logo falls back to the chart's own dot.
 */
export function ModelLogo({ logoUrl, className }: { logoUrl: string | null; className?: string }) {
  if (!logoUrl) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block size-2 shrink-0 rounded-full bg-current", className)}
      />
    )
  }

  const style: MaskStyle = { "--logo": `url("${logoUrl}")` }

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-block size-4 shrink-0 bg-current [mask-image:var(--logo)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className,
      )}
    />
  )
}
