import type { z } from "zod"

import {
  METRIC_KEYS,
  type MetricKey,
  type MeasurementInfo,
  type MetricReaders,
  type MetricValues,
  type ReasoningMode,
  type SourcePayload,
} from "./provider.types"

/**
 * Fetches with a timeout and fails on a non-2xx response, naming `label` in the error so a failed
 * refresh says which source and request broke.
 */
export async function fetchOk(
  label: string,
  url: string,
  { timeoutMs, headers }: { timeoutMs: number; headers?: Record<string, string> },
) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })

  if (!response.ok) throw new Error(`${label} returned ${response.status}`)

  return response
}

/**
 * Parses rows one at a time, so one malformed row is dropped and recorded instead of failing the
 * whole response. A response where nothing parses is a failed fetch.
 */
export function parseRows<TRow>(
  source: string,
  rawRows: ReadonlyArray<unknown>,
  schema: z.ZodType<TRow>,
  idField: string,
): SourcePayload<TRow> {
  const payload: SourcePayload<TRow> = { rows: [], dropped: [] }

  for (const rawRow of rawRows) {
    const result = schema.safeParse(rawRow)

    if (result.success) {
      payload.rows.push(result.data)
      continue
    }

    const id = rawRow != null && typeof rawRow === "object" ? Reflect.get(rawRow, idField) : null
    payload.dropped.push({
      id: typeof id === "string" ? id : null,
      reason: result.error.issues
        .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
        .join("; "),
    })
  }

  if (payload.rows.length === 0) throw new Error(`${source} returned no parseable rows`)

  return payload
}

/** Calculates every metric in `readers` for one row. */
export function readMetrics<TRow>(readers: MetricReaders<TRow>, row: TRow) {
  const values: MetricValues = {}

  for (const metric of METRIC_KEYS) {
    const reader = readers[metric]
    if (reader) {
      const value = reader.read(row)
      values[metric] = value != null && Number.isFinite(value) && value >= 0 ? value : null
    }
  }

  return values
}

export const KNOWN_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const

const KNOWN_LEVEL_SET: ReadonlySet<string> = new Set(KNOWN_LEVELS)

/** Lowercases and closes up a level word, so `Xhigh`, `x-high`, and `xhigh` agree. */
export function normalizeLevel(word: string) {
  return word.toLowerCase().replaceAll(/[\s_-]+/g, "")
}

export function isKnownLevel(level: string) {
  return KNOWN_LEVEL_SET.has(level)
}

const LEVEL_ORDER: ReadonlyArray<string> = KNOWN_LEVELS
const MODE_ORDER: Record<ReasoningMode, number> = { off: 0, on: 1, unknown: 2 }

/** Sort rank: known levels low to high, then new level words, then `unknown`; non-reasoning first. */
export function effortOrder(mode: ReasoningMode, level: string) {
  const known = LEVEL_ORDER.indexOf(level)
  const levelRank =
    known >= 0 ? known : level === "unknown" ? LEVEL_ORDER.length + 1 : LEVEL_ORDER.length

  return levelRank * 3 + MODE_ORDER[mode]
}

/** The notes a source shows beside axis titles, by metric. */
export function metricNotes(readers: Partial<Record<MetricKey, { note?: string }>>) {
  const notes: Partial<Record<MetricKey, string>> = {}

  for (const metric of METRIC_KEYS) {
    const note = readers[metric]?.note
    if (note != null) notes[metric] = note
  }

  return notes
}

/** Words the model-id matcher drops. Their presence marks AA's non-reasoning Instruct rows. */
export const INSTRUCT_WORDS: ReadonlySet<string> = new Set(["instruct", "it", "chat"])

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

export function describeMetrics<TRow>(readers: MetricReaders<TRow>, row: TRow) {
  const measurements: Partial<Record<MetricKey, MeasurementInfo>> = {}
  for (const key of METRIC_KEYS) {
    const describe = readers[key]?.describe
    if (describe) measurements[key] = describe(row)
  }
  return measurements
}
