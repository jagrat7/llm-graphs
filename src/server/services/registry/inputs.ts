import type { CachedPayload } from "../cache"
import type {
  ArtificialAnalysisPayload,
  DeepSWEPayload,
  ModelsDevPayload,
} from "../provider/provider.types"
import type { RegistryInputs } from "./registry.types"

import { artificialAnalysisMetricRows, deepsweMetricRows } from "./metric-rows"

export type CachedSources = {
  deepswe: CachedPayload<DeepSWEPayload> | null
  artificialAnalysis: CachedPayload<ArtificialAnalysisPayload> | null
  modelsDev: CachedPayload<ModelsDevPayload> | null
}

/** Runs each metric source's adapter over its cached payload. A missing source adds nothing. */
export function registryInputs(sources: CachedSources): RegistryInputs {
  const { deepswe, artificialAnalysis, modelsDev } = sources

  return {
    metricSources: [
      {
        name: "artificialAnalysis",
        fetchedAt: artificialAnalysis?.fetchedAt ?? null,
        rows: artificialAnalysis ? artificialAnalysisMetricRows(artificialAnalysis.payload) : [],
        dropped: artificialAnalysis?.payload.dropped ?? [],
      },
      {
        name: "deepswe",
        fetchedAt: deepswe?.fetchedAt ?? null,
        rows: deepswe ? deepsweMetricRows(deepswe.payload) : [],
        dropped: deepswe?.payload.dropped ?? [],
      },
    ],
    catalog: { fetchedAt: modelsDev?.fetchedAt ?? null, payload: modelsDev?.payload ?? null },
  }
}

/** The inputs' fetch times, which is all that can change a derivation between deploys. */
export function inputsVersion(sources: CachedSources) {
  return [sources.deepswe, sources.artificialAnalysis, sources.modelsDev]
    .map((source) => source?.fetchedAt ?? "none")
    .join("|")
}
