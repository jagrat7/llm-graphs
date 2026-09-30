import type { ModelsDevModel } from "../providers"

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
