import type { ModelsDevModel } from "../providers"
import type { ModelEntry } from "./model-aggregator.types"

import { firstWord, normalizeId } from "./match-key"

/** FNV-1a over the slug, so a vendor's hue never changes and needs no stored palette slot. */
export function vendorHue(slug: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) % 360
}

/** The OKLCH chroma and hue of a `#rrggbb` colour, the space the chart draws vendor colours in. */
export function oklch(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const b = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short

  return {
    chroma: Math.hypot(a, b),
    hue: Math.round((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  }
}

/** Below this a brand colour is black, white or grey, and its hue means nothing. */
const NEUTRAL_CHROMA = 0.02

/**
 * Where a vendor's models sit around its hue, newest first: the newest takes the hue itself and
 * the next ones alternate either side, then the pattern repeats. Close enough to read as one
 * vendor, far enough apart to tell its newest models apart.
 */
const MODEL_HUE_OFFSETS = [0, 10, -10, 20, -20]

/**
 * A black-and-white brand's models step from the theme's ink toward grey, `--vendor-ink-0` to `-2`,
 * all faintly tinted toward the brand's one tint hue.
 */
const NEUTRAL_SHADES = 3

/**
 * Each entry's chart colour: a hue near its vendor's brand (or hashed) hue, or for a black-and-white
 * brand a shade of the theme's ink tinted toward its tint (or hashed) hue. Neither for an entry with
 * no vendor.
 */
export function modelColors(
  entries: ReadonlyArray<Pick<ModelEntry, "id" | "vendor" | "releaseDate">>,
  styleOf: (vendor: string) => { color?: string; tint?: string } | undefined,
) {
  const colors = new Map<string, Pick<ModelEntry, "hue" | "shade">>()
  const byVendor = new Map<string, Array<(typeof entries)[number]>>()

  for (const entry of entries) {
    if (entry.vendor == null) {
      colors.set(entry.id, { hue: null })
      continue
    }
    const members = byVendor.get(entry.vendor) ?? []
    members.push(entry)
    byVendor.set(entry.vendor, members)
  }

  for (const [vendor, members] of byVendor) {
    const style = styleOf(vendor)
    const base = style?.color ? oklch(style.color) : { chroma: 1, hue: vendorHue(vendor) }
    const tintHue = style?.tint ? oklch(style.tint).hue : vendorHue(vendor)
    const newestFirst = members.toSorted(
      (left, right) =>
        (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "") ||
        left.id.localeCompare(right.id),
    )

    newestFirst.forEach((entry, rank) => {
      const offset = MODEL_HUE_OFFSETS[rank % MODEL_HUE_OFFSETS.length]
      colors.set(
        entry.id,
        base.chroma < NEUTRAL_CHROMA
          ? { hue: tintHue, shade: rank % NEUTRAL_SHADES }
          : { hue: (base.hue + offset + 360) % 360 },
      )
    })
  }

  return colors
}

/** "Qwen3 VL 8B (Reasoning)" → "Qwen3 VL 8B". Every trailing group goes. */
export function stripTrailingParentheticals(name: string) {
  let stripped = name.trim()
  let previous = ""

  while (stripped !== previous) {
    previous = stripped
    stripped = stripped.replace(/\s*\([^()]*\)\s*$/, "").trim()
  }

  return stripped.length > 0 ? stripped : name.trim()
}

/** The shortest name after stripping, ties broken alphabetically. Null when no row has one. */
export function pickSourceName(names: ReadonlyArray<string | null>) {
  return (
    names
      .filter((name): name is string => name != null && name.trim() !== "")
      .map((name) => stripTrailingParentheticals(name))
      .toSorted((left, right) => left.length - right.length || left.localeCompare(right))[0] ?? null
  )
}

export function earliestDate(dates: ReadonlyArray<string | null>) {
  return (
    dates.filter((date): date is string => date != null && date.length > 0).toSorted()[0] ?? null
  )
}

/** "Liquid AI" → `liquid-ai`. */
export function slugify(label: string) {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

export function catalogVendor(model: ModelsDevModel) {
  return model.id.split("/")[0]
}

/**
 * Knows what models.dev says about each first word: its vendor when every catalog model starting
 * with it agrees, and how siblings spell it in their names.
 */
export class CatalogIndex {
  private readonly vendorsByFirstWord = new Map<string, Set<string>>()
  private readonly siblingsByFirstWord = new Map<string, Array<ModelsDevModel>>()

  constructor(models: ReadonlyArray<ModelsDevModel>) {
    for (const model of models.toSorted((left, right) => left.id.localeCompare(right.id))) {
      const word = firstWord(model.id)
      const vendors = this.vendorsByFirstWord.get(word) ?? new Set()
      vendors.add(catalogVendor(model))
      this.vendorsByFirstWord.set(word, vendors)
      this.siblingsByFirstWord.set(word, [...(this.siblingsByFirstWord.get(word) ?? []), model])
    }
  }

  vendorForFirstWord(word: string) {
    const vendors = this.vendorsByFirstWord.get(word)

    return vendors?.size === 1 ? [...vendors][0] : null
  }

  /** "GPT" and "-" for `gpt`, read off the first sibling whose name starts with the word. */
  spellingOf(word: string) {
    for (const sibling of this.siblingsByFirstWord.get(word) ?? []) {
      if (!sibling.name.toLowerCase().startsWith(word)) continue

      const separator = sibling.name.charAt(word.length)

      return {
        spelling: sibling.name.slice(0, word.length),
        separator: separator === "-" ? "-" : " ",
      }
    }

    return null
  }
}

const SIZE_TOKEN = /^[a-z]?\d+(?:\.\d+)?[bkmt]$/

function capitalize(word: string) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

/**
 * A name for a model no source names: runs of numbers join with `.`, sizes are uppercased, and
 * the first word is spelled the way its catalog siblings spell it. `gpt-6-astra` → "GPT-6 Astra".
 */
export function deriveName(id: string, catalog: CatalogIndex) {
  const tokens: Array<string> = []

  for (const word of normalizeId(id).split("-")) {
    const previous = tokens.at(-1)
    if (
      /^\d+$/.test(word) &&
      previous != null &&
      /^\d+(?:\.\d+)*$/.test(previous) &&
      tokens.length > 1
    ) {
      tokens[tokens.length - 1] = `${previous}.${word}`
    } else {
      tokens.push(word)
    }
  }

  const [first, ...rest] = tokens
  const known = catalog.spellingOf(first)
  const head = known?.spelling ?? capitalize(first)
  const tail = rest.map((token) =>
    SIZE_TOKEN.test(token) ? token.toUpperCase() : capitalize(token),
  )

  return tail.length === 0 ? head : `${head}${known?.separator ?? " "}${tail.join(" ")}`
}
