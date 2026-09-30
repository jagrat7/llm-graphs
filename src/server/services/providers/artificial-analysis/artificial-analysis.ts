import { z } from "zod"

import { env } from "#/env"

import { fetchOk, parseRows, readMetrics } from "../utils"
import { namelessEffort, parseArtificialAnalysisEffort } from "./effort"
import { artificialAnalysisMetrics } from "./metrics"
import {
  REFRESH_WINDOW_MS,
  type ArtificialAnalysisPayload,
  type ArtificialAnalysisRow,
  type MetricRow,
  type MetricSource,
} from "../provider.types"

const API_URL = "https://artificialanalysis.ai/api/v2/language/models/free"
const CACHE_KEY = "llm-scores:source:artificial-analysis:v2"
const MAX_PAGES = 100
const REQUEST_TIMEOUT_MS = 20_000

const rowSchema: z.ZodType<ArtificialAnalysisRow> = z
  .object({
    id: z.string().min(1),
    name: z.string().nullish(),
    slug: z.string().min(1),
    release_date: z.string().nullish(),
    model_creator: z.object({ name: z.string().min(1) }).nullish(),
    performance: z.object({ median_output_tokens_per_second: z.number().nullish() }).nullish(),
    pricing: z
      .object({
        price_1m_input_tokens: z.number().nullish(),
        price_1m_output_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .transform((row) => ({
    id: row.id,
    // A nameless row still has metrics; the aggregator names it from its id instead.
    name: row.name || null,
    slug: row.slug,
    release_date: row.release_date ?? null,
    model_creator: row.model_creator ? { name: row.model_creator.name } : null,
    median_output_tokens_per_second: row.performance?.median_output_tokens_per_second ?? null,
    price_1m_input_tokens: row.pricing?.price_1m_input_tokens ?? null,
    price_1m_output_tokens: row.pricing?.price_1m_output_tokens ?? null,
  }))

const pageSchema = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({
    has_more: z.boolean(),
  }),
})

export class ArtificialAnalysisProvider implements MetricSource<
  ArtificialAnalysisPayload,
  ArtificialAnalysisRow
> {
  readonly name = "artificialAnalysis"
  readonly displayName = "Artificial Analysis"
  readonly cacheKey = CACHE_KEY
  readonly refreshWindowMs = REFRESH_WINDOW_MS.artificialAnalysis
  readonly metrics = artificialAnalysisMetrics

  readMetrics(row: ArtificialAnalysisRow) {
    return readMetrics(this.metrics, row)
  }

  /** AA states effort in the name's labels; slug markers corroborate them. */
  toMetricRows(payload: ArtificialAnalysisPayload): Array<MetricRow> {
    const parsed = payload.rows.map((row) =>
      parseArtificialAnalysisEffort(row.slug, row.name ?? ""),
    )
    const leveledIds = new Set(
      parsed.flatMap((effort, index) =>
        payload.rows[index].name != null && effort.level !== "unknown"
          ? [effort.sourceModelId]
          : [],
      ),
    )

    return payload.rows.map((row, index) => ({
      ...(row.name == null ? namelessEffort(row.slug, parsed[index], leveledIds) : parsed[index]),
      rawId: row.slug,
      metrics: this.readMetrics(row),
      metadata: {
        name: row.name,
        creator: row.model_creator?.name ?? null,
        releaseDate: row.release_date,
      },
    }))
  }

  async fetchPayload(): Promise<ArtificialAnalysisPayload> {
    if (!env.AA_API_KEY) throw new Error("AA_API_KEY is not configured")

    const rawRows: Array<unknown> = []

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetchOk(this.displayName, `${API_URL}?page=${page}`, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: { "x-api-key": env.AA_API_KEY },
      })

      const payload = pageSchema.parse(await response.json())
      rawRows.push(...payload.data)

      if (!payload.pagination.has_more) {
        return parseRows(this.displayName, rawRows, rowSchema, "slug")
      }
    }

    throw new Error(`${this.displayName} still had more pages after ${MAX_PAGES}`)
  }
}
