import { Link } from "@tanstack/react-router"

import { APP_NAME } from "#/ui/lib/app-meta"
import { PAGE_COLUMN_CLASS } from "#/ui/lib/layout-styles"
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
    <header className="border-border/60 bg-background/85 h-header sticky top-0 z-40 border-b backdrop-blur-md">
      <div className={cn(PAGE_COLUMN_CLASS, "flex h-full items-center justify-between gap-2")}>
        <Link
          to="/"
          search={{ x: "cost", y: "score" }}
          aria-label={`${APP_NAME} home`}
          className="text-foreground min-h-control-lg -ml-1 flex items-center rounded-md px-1"
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
