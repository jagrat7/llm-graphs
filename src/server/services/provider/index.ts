import { SourceCache } from "../cache"
import { ArtificialAnalysisProvider } from "./artificial-analysis"
import { DeepSWEProvider } from "./deep-swe"
import { EFFORT_ORDER, getModelConfig } from "./model-config"
import type { ProviderService } from "./provider-service.interface"
import type {
  ArtificialAnalysisPayload,
  ArtificialAnalysisProviderModel,
  DeepSWEPayload,
  DeepSWEProviderModel,
  ProviderModel,
  ProviderModelDataByProvider,
  ProviderName,
  SourceDefinition,
} from "./provider.types"

const EFFORT_SUFFIX_PATTERN = /-(low|medium|high|xhigh|max)$/

type ProviderSources = {
  deepswe: SourceDefinition<DeepSWEPayload>
  artificialAnalysis: SourceDefinition<ArtificialAnalysisPayload>
}

function configured(model: string, effort: string) {
  const config = getModelConfig(model)

  return {
    model,
    displayName: config.displayName,
    family: config.family,
    chartColor: config.chartColor,
    isDefault: config.isDefault,
    effort,
    effortOrder: EFFORT_ORDER[effort] ?? 0,
  }
}

function deepsweModels(payload: DeepSWEPayload): Array<DeepSWEProviderModel> {
  return payload.rows.map((row) => {
    const tokens = (row.mean_input_tokens ?? 0) + (row.mean_output_tokens ?? 0)

    return {
      ...configured(row.model, row.reasoning_effort ?? "default"),
      score: row.pass_rate * 100,
      costPerMTokens:
        row.mean_cost_usd != null && tokens > 0 ? (row.mean_cost_usd / tokens) * 1_000_000 : null,
      durationSeconds: row.mean_duration_seconds,
    }
  })
}

function artificialAnalysisModels(
  payload: ArtificialAnalysisPayload,
): Array<ArtificialAnalysisProviderModel> {
  return payload.rows.map((row) => {
    const effortMatch = row.slug.match(EFFORT_SUFFIX_PATTERN)
    const model = effortMatch ? row.slug.slice(0, -effortMatch[0].length) : row.slug
    const base = configured(model, effortMatch?.[1] ?? "default")

    return {
      ...base,
      displayName: row.name,
      tokensPerSecond: row.median_output_tokens_per_second,
    }
  })
}

export class ProviderDataService implements ProviderService {
  constructor(
    private readonly cache = new SourceCache(),
    private readonly sources: ProviderSources = {
      deepswe: new DeepSWEProvider(),
      artificialAnalysis: new ArtificialAnalysisProvider(),
    },
  ) {}

  private readonly loaders: {
    [TProvider in ProviderName]: () => Promise<Array<ProviderModelDataByProvider[TProvider]>>
  } = {
    deepswe: async () => {
      const cached = await this.cache.read(this.sources.deepswe)

      return cached ? deepsweModels(cached.payload) : []
    },
    artificialAnalysis: async () => {
      const cached = await this.cache.read(this.sources.artificialAnalysis)

      return cached ? artificialAnalysisModels(cached.payload) : []
    },
  }

  fetchModels<TProvider extends ProviderName>(
    provider: TProvider,
  ): Promise<Array<ProviderModelDataByProvider[TProvider]>> {
    return this.loaders[provider]()
  }

  async listModels(provider: ProviderName): Promise<Array<ProviderModel>> {
    const models = await this.fetchModels(provider)

    return Array.from(
      new Map(
        models.map(({ model, displayName, family, chartColor, isDefault, effort, effortOrder }) => [
          `${model}:${effort}`,
          { model, displayName, family, chartColor, isDefault, effort, effortOrder },
        ]),
      ).values(),
    )
  }

  async getModel<TProvider extends ProviderName>(
    provider: TProvider,
    model: string,
    effort = "default",
  ): Promise<ProviderModelDataByProvider[TProvider] | null> {
    const models = await this.fetchModels(provider)

    return (
      models.find(
        (providerModel) => providerModel.model === model && providerModel.effort === effort,
      ) ?? null
    )
  }
}

export type { ProviderModelData } from "./provider.types"
