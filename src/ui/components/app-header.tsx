import { RiLineChartLine, RiTwitterXLine } from "@remixicon/react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "#/ui/components/ui/button"
import { APP_NAME } from "#/ui/lib/app-meta"
import { PAGE_COLUMN_CLASS } from "#/ui/lib/layout-styles"
import { cn } from "#/ui/lib/utils"

import { TokenWordmark } from "./brand-marks"
import SettingsMenu from "./settings-menu"
import SourcesDialog from "./sources-dialog"
import ThemeToggle from "./theme-toggle"

const NAV_LINK_CLASS = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "text-muted-foreground data-[status=active]:bg-foreground/10 data-[status=active]:text-foreground gap-1.5",
)

export default function AppHeader() {
  return (
    <header className="border-border/60 bg-background/85 h-header sticky top-0 z-40 border-b backdrop-blur-md">
      <div className={cn(PAGE_COLUMN_CLASS, "flex h-full items-center gap-1 sm:gap-2")}>
        <Link
          to="/"
          search={{ x: "cost", y: "score" }}
          aria-label={`${APP_NAME} home`}
          className="text-foreground min-h-control-lg -ml-1 flex items-center rounded-md px-1"
        >
          <TokenWordmark />
        </Link>

        <nav aria-label="Pages" className="flex items-center gap-1 sm:ml-2">
          <Link
            to="/"
            search={{ x: "cost", y: "score" }}
            activeOptions={{ exact: true, includeSearch: false }}
            className={cn(NAV_LINK_CLASS, "max-sm:hidden")}
          >
            <RiLineChartLine aria-hidden="true" />
            <span className="max-sm:sr-only">Graphs</span>
          </Link>
          <Link to="/examples" className={NAV_LINK_CLASS}>
            <RiTwitterXLine aria-hidden="true" />
            <span className="max-sm:sr-only">Examples</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SourcesDialog />
          <SettingsMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
