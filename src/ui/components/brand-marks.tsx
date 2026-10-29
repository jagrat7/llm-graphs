import { cn } from "#/ui/lib/utils"

/**
 * The name the way a tokenizer would split it: "LL", "M", " Graph", "s", each
 * on its own highlight. This is the header wordmark.
 */
const TOKENS = [
  { text: "LL", className: "bg-[#ffd166] dark:bg-[#ffd166]/30" },
  { text: "M", className: "bg-[#9ee7b4] dark:bg-[#9ee7b4]/30" },
  { text: " Graph", className: "bg-[#ffb3c7] dark:bg-[#ffb3c7]/30" },
  { text: "s", className: "bg-[#cdb8ff] dark:bg-[#cdb8ff]/30" },
] as const

export function TokenWordmark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-brand inline-flex items-center text-[15px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap",
        className,
      )}
    >
      {TOKENS.map((token) => (
        <span key={token.text} className={cn("rounded-[3px] px-px py-[3px]", token.className)}>
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
