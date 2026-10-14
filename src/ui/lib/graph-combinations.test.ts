import { expect, it } from "vitest"
import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { buildDiagnostics } from "#/server/services/model-aggregator/diagnostics"
import { allFixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { buildPlotData, plotQuality } from "./comparison-plot-data"
import {
  graphCases,
  axisSettings,
  axisBindings,
  unavailableMetrics,
  scoreSourceOf,
  compatibleComparison,
  hasMeaningfulComparison,
} from "./graph-state"
import { defaultPicks, offeredVariants } from "./model-view"
import { METRICS, METRIC_CONFIG } from "./metrics"

it("validates every registered benchmark and metric set against one shared snapshot", () => {
  const info = ProvidersService.info()
  const derivation = aggregateModels(allFixtureInputs())
  const { snapshot } = derivation
  const measuredByEntry = ProvidersService.record((source) => {
    const rows = new Map<string, (typeof snapshot.variants)[typeof source]>()
    for (const row of snapshot.variants[source]) {
      const group = rows.get(row.entryId) ?? []
      group.push(row)
      rows.set(row.entryId, group)
    }
    return rows
  })
  // Axis permutations share the same joins/domains: cover each metric set and every source.
  const cases = graphCases(info, { allOrders: false, allSources: true })
  expect(new Set(cases.map((item) => item.key)).size).toBe(cases.length)
  expect(new Set(METRICS.map((metric) => METRIC_CONFIG[metric].dataKey))).toEqual(
    new Set(Object.keys(info.metricProviders)),
  )
  expect(buildDiagnostics(derivation).counts.failures).toBe(0)
  for (const source of ProvidersService.names)
    expect(snapshot.variants[source].length, source).toBeGreaterThan(0)

  for (const { key, search } of cases) {
    const axes = axisSettings(search, info)
    const bindings = axisBindings(axes, info)
    const offered = offeredVariants(snapshot, bindings)
    if (unavailableMetrics(axes, info).length > 0) {
      expect(offered, key).toHaveLength(0)
      continue
    }
    if (offered.length === 0) continue // Safe refusal when configurations cannot match.
    const picks = defaultPicks(
      snapshot,
      offered,
      scoreSourceOf(axes),
      info,
      bindings.map((b) => b.metric),
    )
    const plot = buildPlotData(
      offered.filter((row) => picks.includes(row.model)),
      search,
    )
    const validCoordinates = plot.points.every((point) =>
      plot.axes.every(
        (axis) =>
          Number.isFinite(point.values[axis]) && point.unit[axis] >= 0 && point.unit[axis] <= 1,
      ),
    )
    const validProvenance = plot.points.every((point) =>
      bindings.every((binding) => {
        const measured = measuredByEntry[binding.source].get(point.model.model) ?? []
        const exact = measured.find(
          (row) =>
            row.mode === point.model.mode &&
            row.level === point.model.level &&
            row.configuration === point.model.configuration,
        )
        const valueMatches =
          binding.scope === "model"
            ? measured.some((row) => row.metrics[binding.metric] === point.model[binding.metric])
            : point.model[binding.metric] === exact?.metrics[binding.metric]
        return valueMatches && point.model.sources[binding.metric] === binding.source
      }),
    )
    expect(
      {
        meaningful: plotQuality(plot).meaningful,
        excluded: plot.excludedCount,
        validCoordinates,
        validProvenance,
      },
      key,
    ).toEqual({ meaningful: true, excluded: 0, validCoordinates: true, validProvenance: true })
  }
  for (const source of info.metricProviders.score) {
    const compatible = compatibleComparison(
      { x: "cost", y: "score", z: "speed", ySource: source },
      info,
      snapshot,
    )
    expect(hasMeaningfulComparison(compatible, info, snapshot), source).toBe(true)
    expect(scoreSourceOf(axisSettings(compatible, info))).toBe(source)
  }
  expect(
    compatibleComparison({ x: "cost", y: "score", z: "speed", ySource: "metr" }, info, snapshot),
  ).toEqual({ x: "price", y: "score", ySource: "metr" })
}, 15_000)
