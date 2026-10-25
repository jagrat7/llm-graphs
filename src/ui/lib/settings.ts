import { atomWithStorage, createJSONStorage } from "jotai/utils"
import { z } from "zod"

import type { Model } from "#/ui/lib/model-view"
import type { ModelSnapshot } from "#/server/api"

import { DEFAULT_PICK_COUNT, logoDataUrl, pinRank, vendorLabel } from "#/ui/lib/model-view"

export const SETTINGS_STORAGE_KEY = "settings"

/** How many models the chart may open on, before the reader picks their own. */
export const OPENING_MODEL_COUNTS = [6, DEFAULT_PICK_COUNT, 12] as const

/**
 * Each field falls back on its own, so a stored value from an older build, or one
 * missing a setting added since, keeps whatever it still says rather than starting over.
 */
const settingsSchema = z.object({
  /** Vendor slugs whose models stay off the picker, the defaults, and the chart. */
  hiddenProviders: z.array(z.string()).catch([]).default([]),
  /** Whether the scatter opens with its Pareto frontier drawn. */
  paretoFrontier: z.boolean().catch(true).default(true),
  /** Logo markers on the chart; off, every point is a plain dot. */
  vendorLogos: z.boolean().catch(true).default(true),
  /** Every effort level a model ran at, or only its highest. */
  effortLevels: z.enum(["all", "highest"]).catch("all").default("all"),
  /** How many models the chart opens on until the reader picks. */
  openingModels: z
    .union(OPENING_MODEL_COUNTS.map((count) => z.literal(count)))
    .catch(DEFAULT_PICK_COUNT)
    .default(DEFAULT_PICK_COUNT),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

export function isDefaultSettings(settings: Settings) {
  return (
    settings.hiddenProviders.length === 0 &&
    settings.paretoFrontier === DEFAULT_SETTINGS.paretoFrontier &&
    settings.vendorLogos === DEFAULT_SETTINGS.vendorLogos &&
    settings.effortLevels === DEFAULT_SETTINGS.effortLevels &&
    settings.openingModels === DEFAULT_SETTINGS.openingModels
  )
}

export function parseSettings(value: unknown): Settings {
  // An array is an object too, but no settings ever stored one; it starts over from defaults.
  return settingsSchema.parse(
    value != null && typeof value === "object" && !Array.isArray(value) ? value : {},
  )
}

const json = createJSONStorage<unknown>()

/**
 * This browser's settings. Read on mount rather than on init, so the server render and
 * the first client render agree; other tabs pick up changes through the `storage` event.
 */
export const settingsAtom = atomWithStorage<Settings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS, {
  getItem: (key, fallback) => parseSettings(json.getItem(key, fallback)),
  setItem: (key, value) => {
    try {
      json.setItem(key, value)
    } catch {
      // Private browsing denies writes; the settings still hold for this session.
    }
  },
  removeItem: (key) => json.removeItem(key),
  subscribe: (key, callback, fallback) =>
    json.subscribe?.(key, (value) => callback(parseSettings(value)), fallback),
})

/** Models without a vendor have nothing to hide them by, so they always stay. */
export function withoutHiddenProviders<T extends Pick<Model, "vendor">>(
  models: ReadonlyArray<T>,
  hidden: ReadonlyArray<string>,
): Array<T> {
  if (hidden.length === 0) return [...models]
  const set = new Set(hidden)

  return models.filter((model) => model.vendor == null || !set.has(model.vendor))
}

/** One run per model and configuration, the same split the chart draws its series by. */
function runKey(model: Pick<Model, "model" | "configuration">) {
  return `${model.model}\u0000${model.configuration ?? ""}`
}

/** Each model's highest effort level, so a run collapses to the single point it peaks at. */
export function highestEffortOnly<T extends Pick<Model, "model" | "configuration" | "effortOrder">>(
  models: ReadonlyArray<T>,
): Array<T> {
  const highest = new Map<string, number>()
  for (const model of models) {
    highest.set(runKey(model), Math.max(model.effortOrder, highest.get(runKey(model)) ?? -Infinity))
  }

  return models.filter((model) => model.effortOrder === highest.get(runKey(model)))
}

export type ProviderOption = {
  vendor: string
  label: string
  logoUrl: string | null
  modelCount: number
}

/** Every vendor in the snapshot, in the model picker's order: pinned labs, then the busiest. */
export function providerOptions(snapshot: ModelSnapshot): Array<ProviderOption> {
  const counts = new Map<string, number>()
  for (const entry of snapshot.entries) {
    if (entry.vendor != null) counts.set(entry.vendor, (counts.get(entry.vendor) ?? 0) + 1)
  }

  return [...counts]
    .map(([vendor, modelCount]) => ({
      vendor,
      label: vendorLabel(vendor),
      logoUrl: logoDataUrl(snapshot.logos[vendor]),
      modelCount,
    }))
    .toSorted(
      (left, right) =>
        pinRank(left.vendor) - pinRank(right.vendor) ||
        right.modelCount - left.modelCount ||
        left.label.localeCompare(right.label),
    )
}
