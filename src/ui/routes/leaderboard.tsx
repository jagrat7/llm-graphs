import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"

import type { MetricBinding } from "#/ui/lib/registry-view"

import { TableSkeleton } from "#/ui/components/chart-skeleton"
import { DataError, DataState } from "#/ui/components/data-state"
import { LeaderboardTable } from "#/ui/components/leaderboard-table"
import { PageShell } from "#/ui/components/page-shell"
import { SourceFooter } from "#/ui/components/source-attribution"
import { Badge } from "#/ui/components/ui/badge"
import { offeredVariants } from "#/ui/lib/registry-view"
import { useRegistrySnapshot } from "#/ui/lib/use-registry"

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
})

/** DeepSWE's model×effort rows, with AA's speed wherever AA lists the same variant. */
const LEADERBOARD_BINDINGS: Array<MetricBinding> = [
  { metric: "score", source: "deepswe" },
  { metric: "costPerMTokens", source: "deepswe" },
  { metric: "durationSeconds", source: "deepswe" },
  { metric: "tokensPerSecond", source: "artificialAnalysis", required: false },
]

function LeaderboardPage() {
  const { data: snapshot, isPending, isError } = useRegistrySnapshot()
  const data = useMemo(
    () => (snapshot ? { models: offeredVariants(snapshot, LEADERBOARD_BINDINGS) } : undefined),
    [snapshot],
  )

  return (
    <PageShell className="pt-8 pb-8">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight lowercase">Leaderboard</h1>
          <p className="text-muted-foreground mt-1 text-xs">DeepSWE model×effort results</p>
        </div>
        {data ? <Badge variant="secondary">{data.models.length} variants</Badge> : null}
      </div>

      {isPending ? <TableSkeleton /> : null}
      {isError ? <DataError className="h-48">Unable to load model data</DataError> : null}
      {data && data.models.length === 0 ? (
        <DataState className="h-48" title="No model results are available" />
      ) : null}
      {data && data.models.length > 0 ? <LeaderboardTable models={data.models} /> : null}
      {data ? <SourceFooter /> : null}
    </PageShell>
  )
}
