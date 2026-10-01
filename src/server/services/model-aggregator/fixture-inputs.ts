import type { CachedPayload } from "../cache/cache"
import type { ArtificialAnalysisPayload, DeepSWEPayload, ModelsDevPayload } from "../providers"
import type { AggregatorInputs } from "./model-aggregator.types"

import { ProvidersService } from "../providers"
import artificialAnalysisFixture from "./fixtures/artificial-analysis.json"
import metrFixture from "./fixtures/metr.json"
import arenaFixture from "./fixtures/arena.json"
import deepsweFixture from "./fixtures/deepswe.json"
import automationBenchFixture from "./fixtures/automation-bench.json"
import terminalBenchFixture from "./fixtures/terminal-bench.json"
import terminalBenchScienceFixture from "./fixtures/terminal-bench-science.json"
import modelsDevFixture from "./fixtures/models-dev.json"
import arcPrizeFixture from "./fixtures/arc-prize.json"
import cursorBenchFixture from "./fixtures/cursor-bench.json"
import { catalogInput, metricSourceInput } from "./inputs"

export const fixtures = {
  cursorBench: cursorBenchFixture,
  arcPrize: arcPrizeFixture,
  automationBench: automationBenchFixture,
  terminalBench: terminalBenchFixture,
  terminalBenchScience: terminalBenchScienceFixture,
  metr: metrFixture,
  arena: arenaFixture,
  deepswe: deepsweFixture satisfies CachedPayload<DeepSWEPayload>,
  artificialAnalysis: artificialAnalysisFixture satisfies CachedPayload<ArtificialAnalysisPayload>,
  modelsDev: modelsDevFixture satisfies CachedPayload<ModelsDevPayload>,
}

/** The aggregator's inputs built from the committed fixtures, for tests. */
export function fixtureInputs(
  artificialAnalysis: CachedPayload<ArtificialAnalysisPayload> = fixtures.artificialAnalysis,
): AggregatorInputs {
  return {
    metricSources: [
      metricSourceInput(ProvidersService.metricSources.artificialAnalysis, artificialAnalysis),
      metricSourceInput(ProvidersService.metricSources.deepswe, fixtures.deepswe),
    ],
    catalog: catalogInput(fixtures.modelsDev),
  }
}

export function allFixtureInputs(): AggregatorInputs {
  const inputs = fixtureInputs()
  inputs.metricSources.push(
    metricSourceInput(ProvidersService.metricSources.cursorBench, fixtures.cursorBench),
    metricSourceInput(ProvidersService.metricSources.arcPrize, fixtures.arcPrize),
    metricSourceInput(ProvidersService.metricSources.metr, fixtures.metr),
    metricSourceInput(ProvidersService.metricSources.arena, fixtures.arena),
    metricSourceInput(ProvidersService.metricSources.automationBench, fixtures.automationBench),
    metricSourceInput(ProvidersService.metricSources.terminalBench, fixtures.terminalBench),
    metricSourceInput(
      ProvidersService.metricSources.terminalBenchScience,
      fixtures.terminalBenchScience,
    ),
  )
  return inputs
}
