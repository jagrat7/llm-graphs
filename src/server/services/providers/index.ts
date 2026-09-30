import { ArtificialAnalysisProvider } from "./artificial-analysis/artificial-analysis"
import { DeepSWEProvider } from "./deep-swe/deep-swe"
import { ModelsDevProvider } from "./models-dev/models-dev"
import type { MetricKey, ProviderName } from "./provider.types"

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
}

export type * from "./provider.types"
