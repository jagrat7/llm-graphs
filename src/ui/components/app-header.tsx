import { Link } from "@tanstack/react-router"

import { APP_NAME } from "#/ui/lib/app-meta"
import { CONTENT_WIDTH_CLASS, HEADER_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { cn } from "#/ui/lib/utils"

import ThemeToggle from "./theme-toggle"

/** Models on the Pareto frontier — the best score you can get at each cost. */
const FRONTIER_POINTS = [
  { cx: 3.5, cy: 19.5 },
  { cx: 7.25, cy: 11.2 },
  { cx: 20.5, cy: 4.5 },
]

/** Models the frontier beats on both axes, left sitting under the curve. */
const DOMINATED_POINTS = [
  { cx: 13.5, cy: 16.5 },
  { cx: 19, cy: 12.5 },
]

/** Kept in step with `public/favicon.svg`, which draws the same mark on a tile. */
function AppMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0">
      {DOMINATED_POINTS.map((point) => (
        <circle
          key={point.cx}
          cx={point.cx}
          cy={point.cy}
          r="1.9"
          className="fill-current opacity-30"
        />
      ))}
      <path
        d="M3.5 19.5 C5 11.5 10.5 6 20.5 4.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-primary"
      />
      {FRONTIER_POINTS.map((point) => (
        <circle key={point.cx} cx={point.cx} cy={point.cy} r="2.2" className="fill-current" />
      ))}
    </svg>
  )
}

/**
 * One destination, so there is nothing to navigate between — the bar carries the
 * mark and the theme control and stays out of the chart's way.
 */
export default function AppHeader() {
  return (
    <header
      className={cn(
        "border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md",
        HEADER_HEIGHT_CLASS,
      )}
    >
      <div
        className={cn(
          // Matches `PageShell`, so the mark's left edge lines up with the
          // content below it at every width.
          "mx-auto flex h-full items-center justify-between gap-2 px-4 sm:px-6",
          CONTENT_WIDTH_CLASS,
        )}
      >
        <Link
          to="/"
          search={{ x: "cost", y: "score" }}
          aria-label={`${APP_NAME} home`}
          className="text-foreground -ml-1 flex min-h-11 items-center rounded-md px-1 sm:min-h-8"
        >
          <AppMark />
        </Link>

        <ThemeToggle />
      </div>
    </header>
  )
}
