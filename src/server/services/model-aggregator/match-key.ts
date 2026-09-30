import { INSTRUCT_WORDS } from "../providers/utils"

/**
 * Step 1 of the match key, and the spelling entry ids use: lowercase, `.` `_` `:` as `-`, and
 * nothing up to the last `/`. `openai/gpt-5.5` becomes `gpt-5-5`.
 */
export function normalizeId(id: string) {
  return (id.split("/").at(-1) ?? id)
    .toLowerCase()
    .replaceAll(/[._:\s]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

export function firstWord(id: string) {
  return normalizeId(id).split("-")[0]
}

export type MatchContext = {
  /** Hosting-provider prefixes to drop, longest first. */
  hostPrefixes: ReadonlyArray<ReadonlyArray<string>>
}

/**
 * A host slug is dropped as a prefix only when no catalog model id starts with it, so
 * `databricks-gpt-5-6-terra` loses `databricks` while `mistral-large` keeps `mistral`.
 */
export function buildMatchContext(
  hostSlugs: ReadonlyArray<string>,
  catalogIds: ReadonlyArray<string>,
): MatchContext {
  const catalog = catalogIds.map((id) => normalizeId(id))
  const hostPrefixes = hostSlugs
    .map((slug) => normalizeId(slug))
    .filter(
      (host) => host.length > 0 && !catalog.some((id) => id === host || id.startsWith(`${host}-`)),
    )
    .map((host) => host.split("-"))
    .toSorted((left, right) => right.length - left.length)

  return { hostPrefixes }
}

function startsWithWords(words: ReadonlyArray<string>, prefix: ReadonlyArray<string>) {
  return prefix.every((word, index) => words[index] === word)
}

/** Steps 1–4: normalize, collapse a doubled first word, drop a host prefix and Instruct words. */
export function matchWords(id: string, context: MatchContext) {
  let words = normalizeId(id).split("-").filter(Boolean)

  if (words.length > 1 && words[0] === words[1]) words = words.slice(1)

  const host = context.hostPrefixes.find(
    (prefix) => words.length > prefix.length && startsWithWords(words, prefix),
  )
  if (host) words = words.slice(host.length)

  const kept = words.filter((word) => !INSTRUCT_WORDS.has(word))

  return kept.length > 0 ? kept : words
}

function hasDigit(word: string) {
  return /\d/.test(word)
}

/**
 * Step 5: words may appear in any order, but words with digits keep theirs, so
 * `claude-4-5-haiku` = `claude-haiku-4-5` while `gpt-5` ≠ `gpt-5-5`.
 */
export function keyOfWords(words: ReadonlyArray<string>) {
  const named = words.filter((word) => !hasDigit(word)).toSorted()
  const numbered = words.filter((word) => hasDigit(word))

  return `${named.join("-")}|${numbered.join("-")}`
}
