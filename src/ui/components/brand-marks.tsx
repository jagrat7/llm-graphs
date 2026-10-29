import { cn } from "#/ui/lib/utils"

/**
 * The name the way a tokenizer would split it: "LL", "M", " Graph", "s", each span
 * underlined, as a tokenizer debug view marks them. The rules are drawn from the
 * theme's own inks, stepping from the primary down to a hairline, so the mark
 * follows whichever palette is on and adds no colour of its own.
 */
const TOKENS = [
  { text: "LL", className: "border-primary/70" },
  { text: "M", className: "border-accent-foreground/60" },
  { text: " Graph", className: "border-muted-foreground/50" },
  { text: "s", className: "border-border" },
] as const

export function TokenWordmark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-brand inline-flex items-center gap-px text-[15px] leading-none font-bold tracking-[-0.02em] whitespace-pre",
        className,
      )}
    >
      {TOKENS.map((token) => (
        <span key={token.text} className={cn("border-b-[3px] px-px pb-[3px]", token.className)}>
          {token.text}
        </span>
      ))}
    </span>
  )
}

/**
 * Alternate mark, not used in the product today: the raised-eyebrow face, the
 * site's reaction to every leaderboard. Kept for social cards and one-offs.
 */
export function EyebrowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" fill="none">
        <path d="M3.5 10.5h7" />
        <path d="M13.5 9.5c2-3 4.5-4 7-3.5" />
      </g>
      <circle cx="7" cy="16.5" r="2.7" fill="currentColor" />
      <circle cx="17" cy="15" r="2.7" fill="currentColor" />
    </svg>
  )
}
