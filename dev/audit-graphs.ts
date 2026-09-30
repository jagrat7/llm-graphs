/** Frozen-data audit; no upstream requests and no combinations of model selections. */
import { writeFile } from "node:fs/promises"
import { aggregateModels } from "../src/server/services/model-aggregator/derive"
import { allFixtureInputs } from "../src/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "../src/server/services/providers"
import {
  graphCases,
  axisSettings,
  axisBindings,
  unavailableMetrics,
  scoreSourceOf,
} from "../src/ui/lib/graph-state"
import { buildPlotData, plotQuality } from "../src/ui/lib/comparison-plot-data"
import { defaultPicks, offeredVariants } from "../src/ui/lib/model-view"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(allFixtureInputs())
const results = graphCases(info, { allOrders: false, allSources: true }).map(({ key, search }) => {
  const axes = axisSettings(search, info)
  const bindings = axisBindings(axes, info)
  const offered = offeredVariants(snapshot, bindings)
  const picks = defaultPicks(
    snapshot,
    offered,
    scoreSourceOf(axes),
    info,
    bindings.map((binding) => binding.metric),
  )
  const plot = buildPlotData(
    offered.filter((model) => picks.includes(model.model)),
    search,
  )
  const quality = plotQuality(plot)
  const status = unavailableMetrics(axes, info).length
    ? "unavailable-metric"
    : offered.length === 0
      ? "no-matching-configuration"
      : quality.meaningful
        ? "meaningful"
        : "constant-axis"
  return {
    key,
    search,
    status,
    offered: offered.length,
    models: picks,
    points: plot.points.length,
    domains: plot.domains,
    quality,
  }
})
const summary = Object.fromEntries(
  [...new Set(results.map((result) => result.status))].map((status) => [
    status,
    results.filter((result) => result.status === status).length,
  ]),
)
await writeFile(
  "docs/additional-provider-metrics-data-results.jsonl",
  [
    {
      kind: "summary",
      checkedAt: new Date().toISOString(),
      fetchedAt: snapshot.fetchedAt,
      summary,
    },
    ...results.map((result) => ({ kind: "case", ...result })),
  ]
    .map((record) => JSON.stringify(record))
    .join("\n") + "\n",
)
console.info(JSON.stringify(summary))
if (results.some((result) => result.status === "constant-axis")) process.exitCode = 1
