import { z } from "zod"

import { fetchOk, parseRows } from "../utils"
import {
  REFRESH_WINDOW_MS,
  type ModelsDevModel,
  type ModelsDevPayload,
  type ModelsDevHost,
  type SourceDefinition,
} from "../provider.types"

const BASE_URL = "https://models.dev"
const CACHE_KEY = "llm-scores:source:models-dev:v1"
const REQUEST_TIMEOUT_MS = 30_000
/** A lab slug models.dev can't know, so its logo is the generic mark it serves for any miss. */
const GENERIC_LOGO_SLUG = "llm-graphs-no-such-lab"

const modelSchema: z.ZodType<ModelsDevModel> = z
  .object({
    id: z.string().regex(/^[^/]+\/.+$/, "expected creator/model"),
    name: z.string().min(1),
    release_date: z.string().nullish(),
    family: z.string().nullish(),
  })
  .transform((model) => ({
    id: model.id,
    name: model.name,
    release_date: model.release_date ?? null,
    family: model.family ?? null,
  }))

const providerSchema = z.object({ id: z.string().min(1), name: z.string().min(1) })

function fetchPath(path: string) {
  return fetchOk(`models.dev ${path}`, `${BASE_URL}${path}`, { timeoutMs: REQUEST_TIMEOUT_MS })
}

async function fetchLogo(slug: string) {
  return (await fetchPath(`/logos/labs/${encodeURIComponent(slug)}.svg`)).text()
}

/**
 * models.dev is a catalog, not a metric source: it names models, dates them, and gives each
 * vendor a logo. The payload is trimmed to the fields the aggregator uses.
 */
export class ModelsDevProvider implements SourceDefinition<ModelsDevPayload> {
  readonly name = "modelsDev"
  readonly cacheKey = CACHE_KEY
  readonly refreshWindowMs = REFRESH_WINDOW_MS.modelsDev

  async fetchPayload(): Promise<ModelsDevPayload> {
    const [modelsResponse, providersResponse] = await Promise.all([
      fetchPath("/models.json"),
      fetchPath("/api.json"),
    ])
    const catalog = z.record(z.string(), z.unknown()).parse(await modelsResponse.json())
    const hosts = z.record(z.string(), z.unknown()).parse(await providersResponse.json())
    const models = parseRows("models.dev", Object.values(catalog), modelSchema, "id")
    const providers: Array<ModelsDevHost> = []

    for (const host of Object.values(hosts)) {
      const parsed = providerSchema.safeParse(host)
      if (parsed.success) providers.push({ id: parsed.data.id, name: parsed.data.name })
    }

    if (providers.length === 0) throw new Error("models.dev api.json listed no providers")

    const vendors = Array.from(
      new Set(models.rows.map((model) => model.id.split("/")[0])),
    ).toSorted()
    const [genericLogo, ...vendorLogos] = await Promise.all([
      fetchLogo(GENERIC_LOGO_SLUG),
      ...vendors.map((vendor) => fetchLogo(vendor)),
    ])

    return {
      ...models,
      providers: providers.toSorted((left, right) => left.id.localeCompare(right.id)),
      logos: Object.fromEntries(vendors.map((vendor, index) => [vendor, vendorLogos[index]])),
      genericLogo,
    }
  }
}
