import { z } from "zod"

import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, parseRows } from "../utils"
import type { MetricReaders, MetricRow, MetricSource } from "../provider.types"
import type { ModelsDevListing, ModelsDevListingPayload } from "./models-dev.types"

const BASE_URL = "https://models.dev"
const CACHE_KEY = "llm-scores:source:models-dev-listing:v1"
const REQUEST_TIMEOUT_MS = 30_000

const priceSchema = z.number().nonnegative().finite()
const costSchema = z.object({
  cost: z.object({ input: priceSchema, output: priceSchema }),
})

const hostSchema = z.object({ models: z.record(z.string(), z.unknown()) })

/** `creator/model` → the entry the creator's own API has for it in `api.json`. */
type LabPrices = (id: string) => unknown

function listingSchema(labPrices: LabPrices): z.ZodType<ModelsDevListing> {
  return z
    .object({
      id: z.string().regex(/^[^/]+\/.+$/, "expected creator/model"),
      limit: z.object({ context: z.number().int().nonnegative().nullish() }).nullish(),
    })
    .transform((model) => {
      const listed = costSchema.safeParse(labPrices(model.id))
      const cost = listed.success ? listed.data.cost : null
      return {
        id: model.id,
        // Image and video models list a context of 0.
        contextTokens: model.limit?.context || null,
        // A lab lists a model it doesn't charge for, or hasn't priced, at $0 in and out.
        prices:
          cost && (cost.input > 0 || cost.output > 0)
            ? { input: cost.input, output: cost.output }
            : null,
      }
    })
}

/** Reads `api.json`, which lists every host's models; a host that doesn't parse is skipped. */
function labPricesFrom(hosts: Record<string, unknown>): LabPrices {
  const modelsByHost = new Map<string, Record<string, unknown>>()
  for (const [id, host] of Object.entries(hosts)) {
    const parsed = hostSchema.safeParse(host)
    if (parsed.success) modelsByHost.set(id, parsed.data.models)
  }

  return (id) => {
    const [creator, ...rest] = id.split("/")
    return modelsByHost.get(creator)?.[rest.join("/")]
  }
}

/** Reads `models.json` for each model's context and `api.json` for its lab's own price. */
export function parseModelsDevListing(models: unknown, hosts: unknown): ModelsDevListingPayload {
  const catalog = z.record(z.string(), z.unknown()).parse(models)
  const hostsById = z.record(z.string(), z.unknown()).parse(hosts)

  return parseRows(
    "models.dev",
    Object.values(catalog),
    listingSchema(labPricesFrom(hostsById)),
    "id",
  )
}

const modelsDevListingMetrics: MetricReaders<ModelsDevListing> = {
  inputPricePerMTokens: {
    scope: "model",
    read: (row) => row.prices?.input ?? null,
    presentation: { label: "Input token price", unit: "$/M tokens", format: "currency" },
    note: "the lab's own API",
  },
  outputPricePerMTokens: {
    scope: "model",
    read: (row) => row.prices?.output ?? null,
    presentation: { label: "Output token price", unit: "$/M tokens", format: "currency" },
    note: "the lab's own API",
  },
  contextTokens: {
    scope: "model",
    read: (row) => row.contextTokens,
    presentation: { label: "Context length", unit: "tokens", format: "tokens" },
    note: "listed window, not a long-context score",
  },
}

/**
 * The same catalog as `ModelsDevProvider`, read for what each lab lists: the context window, and
 * the token prices on the lab's own API. Resellers' prices are left out.
 */
export class ModelsDevListingProvider
  extends MetricProvider<ModelsDevListing>
  implements MetricSource<ModelsDevListingPayload, ModelsDevListing>
{
  readonly name = "modelsDevListing"
  readonly displayName = "models.dev"
  readonly href = BASE_URL
  readonly abbreviation = "MD"
  readonly cacheKey = CACHE_KEY
  /** Refetched once its cached copy is a day old. */
  readonly refreshWindowMs = 24 * 60 * 60 * 1000
  readonly metrics = modelsDevListingMetrics

  /** models.dev lists a model once, without effort variants. */
  toMetricRows(payload: ModelsDevListingPayload): Array<MetricRow> {
    return payload.rows.map((row) => ({
      sourceModelId: row.id,
      rawId: row.id,
      mode: "unknown",
      level: "unknown",
      metrics: this.readMetrics(row),
      measurements: describeMetrics(this.metrics, row),
      // The catalog already names and dates these models.
      metadata: null,
      effortConflict: null,
    }))
  }

  async fetchPayload(): Promise<ModelsDevListingPayload> {
    const [modelsResponse, hostsResponse] = await Promise.all(
      ["/models.json", "/api.json"].map((path) =>
        fetchOk(`models.dev ${path}`, `${BASE_URL}${path}`, { timeoutMs: REQUEST_TIMEOUT_MS }),
      ),
    )
    return parseModelsDevListing(await modelsResponse.json(), await hostsResponse.json())
  }
}
