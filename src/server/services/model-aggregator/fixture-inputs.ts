import type { CachedPayload } from "../cache/cache"
import type { ArtificialAnalysisPayload, DeepSWEPayload, ModelsDevPayload } from "../providers"
import type { AggregatorInputs } from "./model-aggregator.types"

import { ProvidersService } from "../providers"
import artificialAnalysisFixture from "./fixtures/artificial-analysis.json"
import deepsweFixture from "./fixtures/deepswe.json"
import modelsDevFixture from "./fixtures/models-dev.json"
import { catalogInput, metricSourceInput } from "./inputs"

export const fixtures = {
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
