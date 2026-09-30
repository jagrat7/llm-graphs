import type { ModelFamily } from "./model-config"

export const PROVIDERS = {
  deepswe: { displayName: "DeepSWE" },
  artificialAnalysis: { displayName: "Artificial Analysis" },
} as const

export type ProviderName = keyof typeof PROVIDERS
export type SourceName = ProviderName | "modelsDev"

/** How often each source is refetched once its cached copy is this old. */
export const REFRESH_WINDOW_MS: Record<SourceName, number> = {
  deepswe: 60 * 60 * 1000,
  artificialAnalysis: 6 * 60 * 60 * 1000,
  modelsDev: 24 * 60 * 60 * 1000,
}

export type SourceDefinition<TPayload> = {
  readonly name: SourceName
  readonly cacheKey: string
  readonly refreshWindowMs: number
  fetchPayload(): Promise<TPayload>
}

/** A row that failed to parse. It is dropped, and kept here so the registry can report it. */
export type DroppedRow = {
  id: string | null
  reason: string
}

export type SourcePayload<TRow> = {
  rows: Array<TRow>
  dropped: Array<DroppedRow>
}

export type DeepSWERow = {
  model: string
  provider: string | null
  reasoning_effort: string | null
  pass_rate: number
  mean_duration_seconds: number | null
  mean_input_tokens: number | null
  mean_output_tokens: number | null
  mean_cost_usd: number | null
}

export type ArtificialAnalysisRow = {
  id: string
  name: string | null
  slug: string
  release_date: string | null
  model_creator: { name: string } | null
  median_output_tokens_per_second: number | null
}

export type ModelsDevModel = {
  /** `creator/model`, where the creator is the vendor slug. */
  id: string
  name: string
  release_date: string | null
  family: string | null
}

export type ModelsDevHost = {
  /** A hosting provider slug from `api.json`, e.g. `deepinfra`. */
  id: string
  name: string
}

export type ModelsDevPayload = SourcePayload<ModelsDevModel> & {
  providers: Array<ModelsDevHost>
  /** Vendor slug → lab logo SVG, for every vendor in `rows`. */
  logos: Record<string, string>
  /** What models.dev serves for a lab it doesn't know. A logo equal to this isn't real. */
  genericLogo: string
}

export type DeepSWEPayload = SourcePayload<DeepSWERow>
export type ArtificialAnalysisPayload = SourcePayload<ArtificialAnalysisRow>

export type ProviderModel = {
  model: string
  displayName: string
  family: ModelFamily
  chartColor: string
  isDefault: boolean
  effort: string
  effortOrder: number
}

export type DeepSWEProviderModel = ProviderModel & {
  score: number | null
  costPerMTokens: number | null
  durationSeconds: number | null
}

export type ArtificialAnalysisProviderModel = ProviderModel & {
  tokensPerSecond: number | null
}

export type ProviderModelDataByProvider = {
  deepswe: DeepSWEProviderModel
  artificialAnalysis: ArtificialAnalysisProviderModel
}

export type ProviderModelData = ProviderModelDataByProvider[ProviderName]
