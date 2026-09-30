import { z } from "zod"

import { fetchOk, normalizeLevel, parseRows, readMetrics } from "../utils"
import { deepsweMetrics } from "./metrics"
import {
  REFRESH_WINDOW_MS,
  type DeepSWEPayload,
  type DeepSWERow,
  type MetricRow,
  type MetricSource,
} from "../provider.types"

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
  reasoning_effort: nullableString,
  pass_rate: z.number(),
  mean_duration_seconds: nullableNumber,
  mean_input_tokens: nullableNumber,
  mean_output_tokens: nullableNumber,
  mean_cost_usd: nullableNumber,
})

const payloadSchema = z.object({ rows: z.array(z.unknown()) })

export class DeepSWEProvider implements MetricSource<DeepSWEPayload, DeepSWERow> {
  readonly name = "deepswe"
  readonly displayName = "DeepSWE"
  readonly cacheKey = CACHE_KEY
  readonly refreshWindowMs = REFRESH_WINDOW_MS.deepswe
  readonly metrics = deepsweMetrics

  readMetrics(row: DeepSWERow) {
    return readMetrics(this.metrics, row)
  }

  /**
   * DeepSWE states effort in `reasoning_effort`. A null effort proves nothing about the mode, so
   * it is `unknown/unknown` rather than a default. DeepSWE has no names or dates to offer.
   */
  toMetricRows(payload: DeepSWEPayload): Array<MetricRow> {
    return payload.rows.map((row) => ({
      sourceModelId: row.model,
      rawId: row.model,
      mode: row.reasoning_effort == null ? "unknown" : "on",
      level: row.reasoning_effort == null ? "unknown" : normalizeLevel(row.reasoning_effort),
      metrics: this.readMetrics(row),
      metadata: null,
      effortConflict: null,
    }))
  }

  async fetchPayload(): Promise<DeepSWEPayload> {
    const response = await fetchOk(this.displayName, API_URL, { timeoutMs: REQUEST_TIMEOUT_MS })

    const payload = payloadSchema.parse(await response.json())

    return parseRows(this.displayName, payload.rows, rowSchema, "model")
  }
}
