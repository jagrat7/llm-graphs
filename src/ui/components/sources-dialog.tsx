import { RiArrowRightUpLine, RiInformationLine, RiLineChartLine } from "@remixicon/react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import type { ProviderName, ProvidersInfo } from "#/server/api"
import type { Metric } from "#/ui/lib/metrics"

import { SourceLogo } from "#/ui/components/source-logo"
import { Button, buttonVariants } from "#/ui/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "#/ui/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { METRIC_CONFIG } from "#/ui/lib/metrics"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

type SourceCategory = ProvidersInfo["sources"][ProviderName]["category"]

/**
 * The dialog's sections, in the order a reader comparing models is likely to want them,
 * each with the graphs its benchmarks can draw, as [y, x].
 */
const CATEGORIES: ReadonlyArray<{
  key: SourceCategory
  title: string
  graphs: ReadonlyArray<readonly [Metric, Metric]>
}> = [
  {
    key: "coding",
    title: "Coding",
    graphs: [
      ["score", "cost"],
      ["score", "duration"],
    ],
  },
  {
    key: "agents",
    title: "Agents and automation",
    graphs: [
      ["score", "cost"],
      ["score", "duration"],
    ],
  },
  { key: "reasoning", title: "Reasoning", graphs: [["score", "cost"]] },
  {
    key: "preference",
    title: "Human preference",
    graphs: [["score", "votes"]],
  },
  {
    key: "market",
    title: "Prices, speed and specs",
    graphs: [
      ["score", "price"],
      ["speed", "price"],
    ],
  },
]

/** Task cost and duration follow the Score benchmark, so only the other axes name a source. */
const FOLLOWS_SCORE: ReadonlyArray<Metric> = ["cost", "duration"]

/**
 * A graph the group can draw, read from the first of its benchmarks that publishes both
 * axes. A pair none of them publishes is left out rather than linking to an empty chart.
 */
function groupGraph(
  [y, x]: readonly [Metric, Metric],
  members: ReadonlyArray<ProviderName>,
  info: ProvidersInfo,
) {
  const source = members.find((member) =>
    [y, x].every((metric) => info.metricProviders[METRIC_CONFIG[metric].dataKey].includes(member)),
  )
  if (source == null) return null

  return {
    label: `${METRIC_CONFIG[y].label} × ${METRIC_CONFIG[x].label}`,
    search: {
      x,
      y,
      xSource: FOLLOWS_SCORE.includes(x) ? undefined : source,
      ySource: source,
    },
  }
}

function SourceEntry({ source }: { source: ProviderName }) {
  const info = useProvidersInfo()
  const name = info.displayNames[source]
  const { href, publisher, summary } = info.sources[source]

  return (
    <li className="flex items-start gap-3">
      {/* Centred on the name's line, which sets the row's first baseline. */}
      <SourceLogo source={source} className="mt-0.5 size-4" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-field font-medium">{name}</p>
          {/* Its own control rather than an underlined name, so the list reads as credits and
              the way out to each leaderboard is one consistent mark at the row's end. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open the ${name} leaderboard (opens in a new tab)`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" }),
                    "text-muted-foreground hover:text-foreground -my-0.5 -me-1",
                  )}
                />
              }
            >
              <RiArrowRightUpLine aria-hidden="true" className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Open leaderboard</TooltipContent>
          </Tooltip>
        </div>
        {/* METR by METR says nothing; the credit line only appears when it adds a name. */}
        {name.startsWith(publisher) ? null : (
          <p className="text-muted-foreground text-control">by {publisher}</p>
        )}
        <p className="text-control/relaxed mt-1">{summary}</p>
      </div>
    </li>
  )
}

/**
 * Credits every benchmark the chart can draw from, grouped by what it measures. The site
 * only plots other people's results, so this is where the people who ran them are named.
 */
export default function SourcesDialog() {
  const info = useProvidersInfo()
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response keys are provider names
  const sources = Object.keys(info.displayNames) as Array<ProviderName>
  // Controlled so a graph link can close the dialog as it opens that graph.
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Sources"
            className="text-muted-foreground aria-expanded:bg-foreground/12 aria-expanded:text-foreground"
          >
            <RiInformationLine aria-hidden="true" />
          </Button>
        }
      />
      {/* Headerless: the groups say what the dialog is, so the title is only for assistive
          tech, and the close sits in the corner above the first group. The body scrolls
          inside the dialog, never the page behind. */}
      <DialogContent
        showCornerCloseButton
        className="flex max-h-[min(52rem,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">Benchmark sources</DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4">
          {CATEGORIES.map((category) => {
            const members = sources.filter(
              (source) => info.sources[source].category === category.key,
            )
            if (members.length === 0) return null
            const graphs = category.graphs.flatMap((pair) => groupGraph(pair, members, info) ?? [])

            return (
              // The heading sits in a margin beside its benchmarks, like a ruled pad's, so a
              // one-benchmark group takes one row instead of a block of its own.
              <section
                key={category.key}
                aria-labelledby={`sources-${category.key}`}
                className="border-border/60 grid gap-x-8 gap-y-4 border-b py-5 last:border-b-0 md:grid-cols-[11rem_1fr]"
              >
                <div>
                  <h3 id={`sources-${category.key}`} className="text-field font-semibold">
                    {category.title}
                  </h3>
                  <ul className="mt-1.5 grid gap-0.5">
                    {graphs.map((graph) => (
                      <li key={graph.label}>
                        <Link
                          to="/"
                          search={(previous) => ({
                            ...previous,
                            ...graph.search,
                            z: undefined,
                          })}
                          onClick={() => setOpen(false)}
                          className="text-muted-foreground hover:text-primary text-control -mx-1 inline-flex items-start gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:underline"
                        >
                          <RiLineChartLine aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                          {graph.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {members.map((source) => (
                    <SourceEntry key={source} source={source} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
