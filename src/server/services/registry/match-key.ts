import { INSTRUCT_WORDS } from "./effort"

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

const MONTH_NAMES = new Set([
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
])

function isMonth(value: number) {
  return value >= 1 && value <= 12
}

function isDay(value: number) {
  return value >= 1 && value <= 31
}

function isTwoDigits(word: string | undefined): word is string {
  return word != null && /^\d{2}$/.test(word)
}

/** `0813` (MMDD) or `2507` (YYMM). */
function isFourDigitStamp(word: string) {
  if (!/^\d{4}$/.test(word)) return false

  const head = Number(word.slice(0, 2))
  const tail = Number(word.slice(2))

  return (isMonth(head) && isDay(tail)) || (head >= 20 && head <= 39 && isMonth(tail))
}

/** How many trailing words form a snapshot date, e.g. `-20250219`, `-06-16`, `-03-2024`. */
export function trailingDateLength(words: ReadonlyArray<string>) {
  const count = words.length
  const last = words[count - 1] ?? ""
  const previous = words[count - 2]
  const third = words[count - 3]

  if (
    count >= 4 &&
    third != null &&
    /^20\d{2}$/.test(third) &&
    isTwoDigits(previous) &&
    isTwoDigits(last)
  ) {
    return 3
  }
  if (count >= 3 && isTwoDigits(previous) && isMonth(Number(previous)) && /^20\d{2}$/.test(last)) {
    return 2
  }
  if (count >= 3 && previous != null && MONTH_NAMES.has(previous) && /^\d{2,4}$/.test(last)) {
    return 2
  }
  if (
    count >= 3 &&
    isTwoDigits(previous) &&
    isTwoDigits(last) &&
    isMonth(Number(previous)) &&
    isDay(Number(last))
  ) {
    return 2
  }
  if (count >= 2 && (/^20\d{6}$/.test(last) || isFourDigitStamp(last))) return 1

  return 0
}
