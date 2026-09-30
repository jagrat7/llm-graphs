import { ArtificialAnalysisProvider } from "./artificial-analysis/artificial-analysis"
import { DeepSWEProvider } from "./deep-swe/deep-swe"
import { METRProvider } from "./metr/metr"
import { ArenaProvider } from "./arena/arena"
import { ModelsDevProvider } from "./models-dev/models-dev"
import {
  METRIC_KEYS,
  type MetricKey,
  type ProviderName,
  type ProvidersInfo,
} from "./provider.types"
import { metricNotes } from "./utils"

/** Register a provider once here; downloading, metadata, diagnostics and UI discovery follow. */
const metricSources = {
  artificialAnalysis: new ArtificialAnalysisProvider(),
  deepswe: new DeepSWEProvider(),
  metr: new METRProvider(),
  arena: new ArenaProvider(),
}

export type RegisteredProviderName = keyof typeof metricSources

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the registry defines this union
const names = Object.keys(metricSources) as Array<ProviderName>

function record<T>(make: (name: ProviderName) => T): Record<ProviderName, T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- all registry keys are populated
  return Object.fromEntries(names.map((name) => [name, make(name)])) as Record<ProviderName, T>
}

export const ProvidersService = {
  metricSources,
  catalog: new ModelsDevProvider(),
  names,
  record,
  providersFor(metric: MetricKey): Array<ProviderName> {
    return (
      ProvidersService.names
        .filter((name) => metricSources[name].metrics[metric] != null)
        // Preserve the existing benchmark defaults as new sources are registered.
        .toSorted((a, b) => Number(b === "deepswe") - Number(a === "deepswe"))
    )
  },
  info(): ProvidersInfo {
    return {
      displayNames: record((name) => metricSources[name].displayName),
      sources: record((name) => ({
        href: metricSources[name].href,
        abbreviation: metricSources[name].abbreviation,
      })),
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- all metric keys are populated
      metricProviders: Object.fromEntries(
        METRIC_KEYS.map((key) => [key, ProvidersService.providersFor(key)]),
      ) as ProvidersInfo["metricProviders"],
      notes: record((name) => metricNotes(metricSources[name].metrics)),
      scopes: record((name) =>
        Object.fromEntries(
          METRIC_KEYS.flatMap((key) =>
            metricSources[name].metrics[key]?.scope === "model" ? [[key, "model"]] : [],
          ),
        ),
      ),
      presentation: record((name) =>
        Object.fromEntries(
          METRIC_KEYS.flatMap((key) => {
            const presentation = metricSources[name].metrics[key]?.presentation
            return presentation ? [[key, presentation]] : []
          }),
        ),
      ),
    }
  },
}

export type * from "./provider.types"
export type * from "./artificial-analysis/artificial-analysis.types"
export type * from "./deep-swe/deep-swe.types"
export type * from "./models-dev/models-dev.types"
export type * from "./metr/metr.types"
export type * from "./arena/arena.types"
