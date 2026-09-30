import type { SourcePayload } from "../provider.types"

export type DeepSWERow = {
  model: string
  reasoning_effort: string | null
  pass_rate: number
  mean_duration_seconds: number | null
  mean_input_tokens: number | null
  mean_output_tokens: number | null
  mean_cost_usd: number | null
}

export type DeepSWEPayload = SourcePayload<DeepSWERow>
