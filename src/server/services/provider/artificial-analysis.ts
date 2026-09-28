import { z } from "zod"

import { env } from "#/env"

import { parseRows } from "./parse-rows"
import {
  REFRESH_WINDOW_MS,
  type ArtificialAnalysisPayload,
  type ArtificialAnalysisRow,
  type SourceDefinition,
} from "./provider.types"

const API_URL = "https://artificialanalysis.ai/api/v2/language/models/free"
const CACHE_KEY = "llm-scores:source:artificial-analysis:v1"
const MAX_PAGES = 100
const REQUEST_TIMEOUT_MS = 20_000

const rowSchema: z.ZodType<ArtificialAnalysisRow> = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    release_date: z.string().nullish(),
    model_creator: z.object({ name: z.string().min(1) }).nullish(),
    performance: z.object({ median_output_tokens_per_second: z.number().nullish() }).nullish(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    release_date: row.release_date ?? null,
    model_creator: row.model_creator ? { name: row.model_creator.name } : null,
    median_output_tokens_per_second: row.performance?.median_output_tokens_per_second ?? null,
  }))

const pageSchema = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({
    has_more: z.boolean(),
  }),
})

export class ArtificialAnalysisProvider implements SourceDefinition<ArtificialAnalysisPayload> {
  readonly name = "artificialAnalysis"
  readonly cacheKey = CACHE_KEY
  readonly refreshWindowMs = REFRESH_WINDOW_MS.artificialAnalysis

  async fetchPayload(): Promise<ArtificialAnalysisPayload> {
    if (!env.AA_API_KEY) throw new Error("AA_API_KEY is not configured")

    const rawRows: Array<unknown> = []

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetch(`${API_URL}?page=${page}`, {
        headers: { "x-api-key": env.AA_API_KEY },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`Artificial Analysis returned ${response.status}`)
      }

      const payload = pageSchema.parse(await response.json())
      rawRows.push(...payload.data)

      if (!payload.pagination.has_more) {
        return parseRows("Artificial Analysis", rawRows, rowSchema, "slug")
      }
    }

    throw new Error(`Artificial Analysis still had more pages after ${MAX_PAGES}`)
  }
}
