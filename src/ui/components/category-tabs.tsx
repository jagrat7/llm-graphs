import type { RemixiconComponentType } from "@remixicon/react"

import {
  RiPuzzleLine,
  RiQuillPenLine,
  RiCodeSSlashLine,
  RiImageLine,
  RiMicLine,
  RiRobot2Line,
  RiSpeedUpLine,
  RiVideoLine,
} from "@remixicon/react"
import { Link } from "@tanstack/react-router"

import type { CategoryKey } from "#/ui/lib/category-graphs"

import { CATEGORY_GRAPHS, categoryGraphSearch, UPCOMING_CATEGORIES } from "#/ui/lib/category-graphs"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

/**
 * A chip the height of the controls below it. Its focus ring sits inside the box, so the
 * rings of neighbouring chips never overlap across the narrow gap between them.
 */
const TAB_CLASS =
  "text-control h-control-lg inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap -outline-offset-2"

/** A mark per subject, so the row can be scanned by shape before its words are read. */
const ICONS: Record<CategoryKey, RemixiconComponentType> = {
  coding: RiCodeSSlashLine,
  agents: RiRobot2Line,
  reasoning: RiPuzzleLine,
  chat: RiQuillPenLine,
  speed: RiSpeedUpLine,
  image: RiImageLine,
  video: RiVideoLine,
  speech: RiMicLine,
}

function CategoryIcon({ category }: { category: CategoryKey }) {
  const Icon = ICONS[category]

  return <Icon aria-hidden="true" className="size-3.5 shrink-0" />
}

function ChipContent({ category, label }: { category: CategoryKey; label: string }) {
  return (
    <>
      <CategoryIcon category={category} />
      {label}
    </>
  )
}

/**
 * The quick way to a chart: one chip per subject, each opening that subject's graph on its
 * preferred benchmark. The chip stays filled while the reader adjusts the chart within the
 * subject. A centred row of chips over the controls, so it reads as one more instrument for
 * the chart rather than a second bar of site navigation under the header.
 */
export function CategoryTabs({
  active,
  unavailable = [],
}: {
  /** The `CATEGORY_GRAPHS` key the chart on screen belongs to, if any. */
  active: CategoryKey | null
  /** Keys whose graph has nothing to draw right now, as when a benchmark is unreachable. */
  unavailable?: ReadonlyArray<CategoryKey>
}) {
  const info = useProvidersInfo()

  return (
    // Only as wide as its chips, so it centres; a phone has no room for every subject on one
    // line, so there the chips wrap onto a second, centred line.
    <nav
      aria-label="Graphs by category"
      className="mx-auto mb-5 flex w-fit max-w-full shrink-0 flex-wrap justify-center gap-1 max-sm:mb-3"
    >
      {CATEGORY_GRAPHS.map((graph) => {
        const search = categoryGraphSearch(graph, info)
        const content = <ChipContent category={graph.key} label={graph.label} />

        if (search == null || unavailable.includes(graph.key)) {
          return (
            <span
              key={graph.key}
              aria-disabled="true"
              title="No results right now"
              className={cn(TAB_CLASS, "text-muted-foreground/60")}
            >
              {content}
            </span>
          )
        }

        return (
          <Link
            key={graph.key}
            to="/"
            // The subject's own models, not the last chart's: a pinned list is dropped, so the
            // reader's saved picks apply, or the benchmark's defaults when none has results.
            search={(previous) => ({
              ...previous,
              ...search,
              z: undefined,
              zSource: undefined,
              models: undefined,
            })}
            state={{ graphShortcut: true }}
            resetScroll={false}
            // The router marks a link "page" itself when the URL matches it exactly; this keeps
            // the same mark once the reader has adjusted the chart within the subject.
            aria-current={graph.key === active ? "page" : undefined}
            className={cn(
              TAB_CLASS,
              "text-muted-foreground hover:text-foreground transition-colors",
              "aria-[current=page]:bg-foreground/10 aria-[current=page]:text-foreground",
            )}
          >
            {content}
          </Link>
        )
      })}
      {UPCOMING_CATEGORIES.map(({ key, label }) => (
        <span key={key} aria-disabled="true" className={cn(TAB_CLASS, "text-muted-foreground/60")}>
          <ChipContent category={key} label={label} />
          <span className="border-border text-2xs rounded-sm border border-dashed px-1">soon</span>
        </span>
      ))}
    </nav>
  )
}
