import { ArtificialAnalysisProvider } from "./artificial-analysis/artificial-analysis"
import { DeepSWEProvider } from "./deep-swe/deep-swe"
import { ModelsDevProvider } from "./models-dev/models-dev"
import type { MetricKey, ProviderName, ProvidersInfo } from "./provider.types"

import { metricNotes } from "./utils"

export const ProvidersService = {
  /** The sources that publish metrics. When two publish the same metric, the first is the default. */
  metricSources: {
    deepswe: new DeepSWEProvider(),
    artificialAnalysis: new ArtificialAnalysisProvider(),
  },

  /** models.dev: model names, vendors and logos. It publishes no metrics. */
  catalog: new ModelsDevProvider(),

  /** The metric sources that publish a metric, default first. */
  providersFor(metric: MetricKey): Array<ProviderName> {
    return Object.values(ProvidersService.metricSources)
      .filter((source) => source.metrics[metric] != null)
      .map((source) => source.name)
  },

  /** Everything the UI needs about the metric sources, as plain data. */
  info(): ProvidersInfo {
    const { deepswe, artificialAnalysis } = ProvidersService.metricSources

    return {
      displayNames: {
        deepswe: deepswe.displayName,
        artificialAnalysis: artificialAnalysis.displayName,
      },
      metricProviders: {
        score: ProvidersService.providersFor("score"),
        costPerMTokens: ProvidersService.providersFor("costPerMTokens"),
        tokensPerSecond: ProvidersService.providersFor("tokensPerSecond"),
        durationSeconds: ProvidersService.providersFor("durationSeconds"),
      },
      notes: {
        deepswe: metricNotes(deepswe.metrics),
        artificialAnalysis: metricNotes(artificialAnalysis.metrics),
      },
    }
  },
}

export type * from "./provider.types"
export type * from "./artificial-analysis/artificial-analysis.types"
export type * from "./deep-swe/deep-swe.types"
export type * from "./models-dev/models-dev.types"
