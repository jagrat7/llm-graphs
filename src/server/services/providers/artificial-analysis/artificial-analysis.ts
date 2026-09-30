import { MetricProvider } from "../metric-provider"
import { z } from "zod"

import { env } from "#/env"

import { fetchOk, parseRows, describeMetrics } from "../utils"
import { namelessEffort, parseArtificialAnalysisEffort } from "./effort"
import { artificialAnalysisMetrics } from "./metrics"
import type { MetricRow, MetricSource } from "../provider.types"
import type { ArtificialAnalysisPayload, ArtificialAnalysisRow } from "./artificial-analysis.types"

const API_URL = "https://artificialanalysis.ai/api/v2/language/models/free"
const CACHE_KEY = "llm-scores:source:artificial-analysis:v3"
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
    evaluations: z
      .object({ artificial_analysis_intelligence_index: z.number().nullish() })
      .nullish(),
    artificial_analysis_intelligence_index_cost: z
      .object({
        cost_per_task: z.object({ total_cost: z.number().nullish() }).nullish(),
      })
      .nullish(),
    pricing: z
      .object({
        price_1m_input_tokens: z.number().nullish(),
        price_1m_output_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .transform((row) => ({
    id: row.id,
    intelligence_index: row.evaluations?.artificial_analysis_intelligence_index ?? null,
    cost_per_task:
      row.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost ?? null,
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
  intelligence_index_version: z.union([z.string(), z.number()]).optional(),
  pagination: z.object({
    has_more: z.boolean(),
  }),
})

export class ArtificialAnalysisProvider
  extends MetricProvider<ArtificialAnalysisRow>
  implements MetricSource<ArtificialAnalysisPayload, ArtificialAnalysisRow>
{
  readonly name = "artificialAnalysis"
  readonly displayName = "Artificial Analysis"
  readonly href = "https://artificialanalysis.ai/"
  readonly abbreviation = "AA"
  readonly cacheKey = CACHE_KEY
  /** Refetched once its cached copy is six hours old. */
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics = artificialAnalysisMetrics

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
      measurements: describeMetrics(this.metrics, row),
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
    let version: string | null = null

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetchOk(this.displayName, `${API_URL}?page=${page}`, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: { "x-api-key": env.AA_API_KEY },
      })

      const payload = pageSchema.parse(await response.json())
      const pageVersion =
        payload.intelligence_index_version == null
          ? null
          : String(payload.intelligence_index_version)
      if (page > 1 && pageVersion !== version)
        throw new Error("AA index version changed during pagination")
      version = pageVersion
      rawRows.push(...payload.data)

      if (!payload.pagination.has_more) {
        const parsed = parseRows(this.displayName, rawRows, rowSchema, "slug")
        parsed.rows = parsed.rows.map((row) => ({ ...row, index_version: version }))
        return parsed
      }
    }

    throw new Error(`${this.displayName} still had more pages after ${MAX_PAGES}`)
  }
}
