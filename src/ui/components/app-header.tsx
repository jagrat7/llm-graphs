import { Link } from "@tanstack/react-router"

import { APP_NAME } from "#/ui/lib/app-meta"
import { CONTENT_WIDTH_CLASS, HEADER_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { cn } from "#/ui/lib/utils"

import { TokenWordmark } from "./brand-marks"
import SettingsMenu from "./settings-menu"
import ThemeToggle from "./theme-toggle"

/**
 * One destination, so there is nothing to navigate between — the bar carries the
 * wordmark, the settings, and the theme control, and stays out of the chart's way.
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
          <TokenWordmark />
        </Link>

        <div className="flex items-center gap-1">
          <SettingsMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
