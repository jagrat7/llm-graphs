import { createContext, useContext } from "react"
// Settings parse in the browser, so they use zod's tree-shakeable build.
import { z } from "zod/mini"

import type { Model } from "#/ui/lib/model-view"
import type { ModelSnapshot } from "#/server/api"

import { createCookieStore, parseJsonCookie } from "#/ui/lib/cookie-store"
import { logoDataUrl, pinRank, vendorLabel } from "#/ui/lib/model-view"

export const SETTINGS_COOKIE = "settings"

/**
 * Each field falls back on its own, so a stored value from an older build, or one
 * missing a setting added since, keeps whatever it still says rather than starting over.
 */
const settingsSchema = z.object({
  /** Vendor slugs whose models stay off the picker, the defaults, and the chart. */
  hiddenProviders: z.catch(z.array(z.string()), []),
  /** Whether the scatter opens with its Pareto frontier drawn. */
  paretoFrontier: z.catch(z.boolean(), true),
  /** Logo markers on the chart; off, every point is a plain dot. */
  vendorLogos: z.catch(z.boolean(), true),
  /** Every effort level a model ran at, or only its highest. */
  effortLevels: z.catch(z.enum(["all", "highest"]), "all"),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

export function isDefaultSettings(settings: Settings) {
  return (
    settings.hiddenProviders.length === 0 &&
    settings.paretoFrontier === DEFAULT_SETTINGS.paretoFrontier &&
    settings.vendorLogos === DEFAULT_SETTINGS.vendorLogos &&
    settings.effortLevels === DEFAULT_SETTINGS.effortLevels
  )
}

export function parseSettings(value: unknown): Settings {
  // An array is an object too, but no settings ever stored one; it starts over from defaults.
  return settingsSchema.parse(
    value != null && typeof value === "object" && !Array.isArray(value) ? value : {},
  )
}

/**
 * This browser's settings, kept in a cookie so the server renders the chart with them: hidden
 * providers decide which models the first HTML carries.
 */
const settingsCookie = createCookieStore<Settings>({
  name: SETTINGS_COOKIE,
  parse: (value) => parseSettings(parseJsonCookie(value)),
  isEmpty: isDefaultSettings,
})

export const readSettings = settingsCookie.read

/** The request's settings, handed down by the root route; the defaults outside a router. */
export const SavedSettingsContext = createContext<Settings>(DEFAULT_SETTINGS)

/** This tab's settings and a setter, like `useState`. Saving the defaults deletes the cookie. */
export function useSettings() {
  const settings = settingsCookie.useValue(useContext(SavedSettingsContext))

  function setSettings(update: Settings | ((current: Settings) => Settings)) {
    void settingsCookie.save(typeof update === "function" ? update(settings) : update)
  }

  return [settings, setSettings] as const
}

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
