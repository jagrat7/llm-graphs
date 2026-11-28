import { createServerFn, createServerOnlyFn } from "@tanstack/react-start"

import { ProvidersService, type MetricKey, type ProviderName } from "../services/providers"
import { XPostsService, type DiscoveryModel } from "../services/x-posts"
import { snapshot } from "./models"

const HIGHER_IS_BETTER: ReadonlyArray<MetricKey> = ["score", "tokensPerSecond"]

type Readings = Partial<Record<ProviderName, Partial<Record<MetricKey, number>>>>

export const examples = createServerFn({ method: "GET" }).handler(async () => {
  const [payload, { entries, logos, variants }] = await Promise.all([
    XPostsService.examples(),
    snapshot(),
  ])
  if (payload == null) return null

  const covered = new Set(
    payload.groups.flatMap((group) => (group.posts.length > 0 ? group.models : [])),
  )
  const best = new Map<string, Readings>()
  for (const source of ProvidersService.names) {
    for (const row of variants[source]) {
      if (!covered.has(row.entryId) || row.refused) continue
      const readings = best.get(row.entryId) ?? {}
      const fromSource = (readings[source] ??= {})
      for (const metric of HIGHER_IS_BETTER) {
        const value = row.metrics[metric]
        if (value != null) fromSource[metric] = Math.max(value, fromSource[metric] ?? -Infinity)
      }
      best.set(row.entryId, readings)
    }
  }
  const models = entries.flatMap((entry) =>
    covered.has(entry.id)
      ? [
          {
            id: entry.id,
            name: entry.name,
            vendor: entry.vendor,
            releaseDate: entry.releaseDate,
            hue: entry.hue,
            ...(entry.shade == null ? {} : { shade: entry.shade }),
            logo: entry.vendor == null ? null : (logos[entry.vendor] ?? null),
            best: best.get(entry.id) ?? {},
          },
        ]
      : [],
  )

  return { ...payload, models }
})

/** Every benchmarked model, as discovery sees it. */
export const discoveryModels = createServerOnlyFn(async (): Promise<Array<DiscoveryModel>> => {
  const { entries, variants } = await snapshot()
  const benchmarked = new Set(
    Object.values(variants).flatMap((rows) => rows.map((row) => row.entryId)),
  )
  const makesImages = new Set(variants.designArena.map((row) => row.entryId))

  return entries.flatMap((entry) =>
    benchmarked.has(entry.id)
      ? [
          {
            id: entry.id,
            name: entry.name,
            vendor: entry.vendor,
            releaseDate: entry.releaseDate,
            makesImages: makesImages.has(entry.id),
          },
        ]
      : [],
  )
})

/** Searches X for new examples of every benchmarked model. Run daily by the cron route. */
export const discoverPosts = createServerOnlyFn(async () =>
  XPostsService.discover(await discoveryModels()),
)
