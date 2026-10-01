import type { SourcePayload } from "../provider.types"

export type ArtificialAnalysisRow = {
  id: string
  name: string | null
  slug: string
  release_date: string | null
  model_creator: { name: string } | null
  median_output_tokens_per_second: number | null
  price_1m_input_tokens: number | null
  price_1m_output_tokens: number | null
  intelligence_index?: number | null
  cost_per_task?: number | null
  index_version?: string | null
}

export type ArtificialAnalysisPayload = SourcePayload<ArtificialAnalysisRow>
