import { z } from "zod"

import { parseRows } from "./parse-rows"
import {
  REFRESH_WINDOW_MS,
  type DeepSWEPayload,
  type DeepSWERow,
  type SourceDefinition,
} from "./provider.types"

const API_URL = "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json"
const CACHE_KEY = "llm-scores:source:deepswe:v1"
const REQUEST_TIMEOUT_MS = 20_000

const nullableNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null)
const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null)

const rowSchema: z.ZodType<DeepSWERow> = z.object({
  model: z.string().min(1),
  provider: nullableString,
  reasoning_effort: nullableString,
  pass_rate: z.number(),
  mean_duration_seconds: nullableNumber,
  mean_input_tokens: nullableNumber,
  mean_output_tokens: nullableNumber,
  mean_cost_usd: nullableNumber,
})

const payloadSchema = z.object({ rows: z.array(z.unknown()) })

export class DeepSWEProvider implements SourceDefinition<DeepSWEPayload> {
  readonly name = "deepswe"
  readonly cacheKey = CACHE_KEY
  readonly refreshWindowMs = REFRESH_WINDOW_MS.deepswe

  async fetchPayload(): Promise<DeepSWEPayload> {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) throw new Error(`DeepSWE returned ${response.status}`)

    const payload = payloadSchema.parse(await response.json())

    return parseRows("DeepSWE", payload.rows, rowSchema, "model")
  }
}
