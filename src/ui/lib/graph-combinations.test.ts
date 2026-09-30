import { describe, expect, it } from "vitest"

import type { PlotMetrics } from "./comparison-plot-data"
import type { MetricBinding } from "./model-view"

import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { fixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { buildPlotData } from "./comparison-plot-data"
import { METRICS, METRIC_CONFIG, resolveSource } from "./metrics"
import { defaultPicks, offeredVariants } from "./model-view"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(fixtureInputs())
const combinations: Array<PlotMetrics> = METRICS.flatMap((x) =>
  METRICS.filter((y) => y !== x).flatMap((y) =>
    [null, ...METRICS.filter((z) => z !== x && z !== y)].map((z) => ({ x, y, z })),
  ),
)

describe("every selectable graph combination", () => {
  it.each(combinations)("plots measured configurations for $x / $y / $z", (metrics) => {
    const selectedMetrics = [metrics.x, metrics.y, metrics.z].filter((metric) => metric != null)
    const bindings: Array<MetricBinding> = selectedMetrics.map((metric) => ({
      metric: METRIC_CONFIG[metric].dataKey,
      source: resolveSource(metric, undefined, info),
    }))
    const offered = offeredVariants(snapshot, bindings)
    const picks = defaultPicks(
      snapshot,
      offered,
      selectedMetrics.includes("score") ? "deepswe" : null,
      info,
    )
    const plot = buildPlotData(
      offered.filter((model) => picks.includes(model.model)),
      metrics,
    )

    expect(plot.modelCount).toBeGreaterThan(1)
    expect(plot.excludedCount).toBe(0)
    for (const axis of plot.axes) {
      expect(plot.domains[axis].max).toBeGreaterThan(plot.domains[axis].min)
    }
    for (const point of plot.points) {
      for (const axis of plot.axes) {
        expect(Number.isFinite(point.values[axis])).toBe(true)
        expect(point.unit[axis]).toBeGreaterThanOrEqual(0)
        expect(point.unit[axis]).toBeLessThanOrEqual(1)
      }
      for (const binding of bindings) {
        const measured = snapshot.variants[binding.source].find(
          (variant) =>
            variant.entryId === point.model.model &&
            variant.mode === point.model.mode &&
            variant.level === point.model.level,
        )
        expect(point.model[binding.metric]).toBe(measured?.metrics[binding.metric])
        expect(point.model.sources[binding.metric]).toBe(binding.source)
      }
    }
  })
})
