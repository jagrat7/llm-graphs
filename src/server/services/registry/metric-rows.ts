import type {
  ArtificialAnalysisPayload,
  DeepSWEPayload,
  MetricRow,
} from "../provider/provider.types"

import { normalizeLevel, parseArtificialAnalysisEffort } from "./effort"
import { trailingDateLength } from "./match-key"

/**
 * DeepSWE states effort in `reasoning_effort`. A null effort proves nothing about the mode, so
 * it is `unknown/unknown` rather than a default. DeepSWE has no names or dates to offer.
 */
export function deepsweMetricRows(payload: DeepSWEPayload): Array<MetricRow> {
  return payload.rows.map((row) => {
    const tokens = (row.mean_input_tokens ?? 0) + (row.mean_output_tokens ?? 0)

    return {
      sourceModelId: row.model,
      rawId: row.model,
      mode: row.reasoning_effort == null ? "unknown" : "on",
      level: row.reasoning_effort == null ? "unknown" : normalizeLevel(row.reasoning_effort),
      metrics: {
        score: row.pass_rate * 100,
        costPerMTokens:
          row.mean_cost_usd != null && tokens > 0 ? (row.mean_cost_usd / tokens) * 1_000_000 : null,
        durationSeconds: row.mean_duration_seconds,
      },
      metadata: null,
      effortConflict: null,
    }
  })
}

/** AA states effort in the name's labels; slug markers corroborate them. */
export function artificialAnalysisMetricRows(payload: ArtificialAnalysisPayload): Array<MetricRow> {
  return payload.rows.map((row) => ({
    ...parseArtificialAnalysisEffort(row.slug, row.name, trailingDateLength),
    rawId: row.slug,
    metrics: { tokensPerSecond: row.median_output_tokens_per_second },
    metadata: {
      name: row.name,
      creator: row.model_creator?.name ?? null,
      releaseDate: row.release_date,
    },
  }))
}
