import type { CSSProperties } from "react"

import { cn } from "#/ui/lib/utils"

type MaskStyle = CSSProperties & { "--logo"?: string }

/**
 * A vendor's logo in its vendor's colour, as the chart draws it, so a selector keys the plot.
 * The logos are one-colour shapes, so the SVG is a mask over that colour; it is only ever an
 * image source, never markup in the page. A vendor without a real logo falls back to the chart's
 * own dot.
 */
export function ModelLogo({
  logoUrl,
  color,
  className,
}: {
  logoUrl: string | null
  color: string
  className?: string
}) {
  if (!logoUrl) {
    return (
      <span
        aria-hidden="true"
        style={{ backgroundColor: color }}
        className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      />
    )
  }

  const style: MaskStyle = { "--logo": `url("${logoUrl}")`, backgroundColor: color }

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-block size-4 shrink-0 [mask-image:var(--logo)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className,
      )}
    />
  )
}
