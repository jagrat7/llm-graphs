import { parquetReadObjects } from "hyparquet"
import { MetricProvider } from "../metric-provider"
import { z } from "zod"
import { fetchOk, parseRows, describeMetrics, KNOWN_LEVELS, normalizeLevel } from "../utils"
import type { MetricReaders, MetricSource, MetricRow, ReasoningMode } from "../provider.types"
import type { ArenaPayload, ArenaRow } from "./arena.types"

const DATASET_URL =
  "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text_style_control/latest-00000-of-00001.parquet"
const CATEGORY = "overall"

const recordFields = z.object({
  model_name: z.string().trim().min(1),
  organization: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null),
  rating: z.number().positive(),
  rating_lower: z.number().positive(),
  rating_upper: z.number().positive(),
  vote_count: z.number().int().positive(),
  // Parquet int64 values decode as bigint.
  rank: z.bigint().transform(Number).pipe(z.number().int().positive()),
  leaderboard_publish_date: z.iso.date(),
})

const recordSchema: z.ZodType<ArenaRow> = recordFields.transform((record) => ({
  modelName: record.model_name,
  organization: record.organization,
  rating: record.rating,
  ratingLower: record.rating_lower,
  ratingUpper: record.rating_upper,
  votes: record.vote_count,
  rank: record.rank,
  publishDate: record.leaderboard_publish_date,
}))
const COLUMNS = [...Object.keys(recordFields.shape), "category"]

export function parseArenaRecords(records: ReadonlyArray<Record<string, unknown>>): ArenaPayload {
  const overall = records.filter((record) => record.category === CATEGORY)
  const payload = parseRows("Arena", overall, recordSchema, "model_name")
  const dates = new Set(payload.rows.map((row) => row.publishDate))
  if (dates.size > 1)
    throw new Error(`Arena latest split mixes publish dates: ${[...dates].join(", ")}`)
  return payload
}

type Qualifier =
  | { kind: "effort"; level: string }
  | { kind: "mode"; mode: "on" | "off" }
  | { kind: "budget"; budget: string }
  | { kind: "idWord"; word: string }

const QUALIFIER_KINDS: ReadonlyArray<readonly [RegExp, (word: string) => Qualifier]> = [
  [
    new RegExp(`^(?:${KNOWN_LEVELS.join("|")})$`, "i"),
    (word) => ({ kind: "effort", level: word.toLowerCase() }),
  ],
  [/^(?:thinking|reasoning)$/i, () => ({ kind: "mode", mode: "on" })],
  [/^non-(?:thinking|reasoning)$/i, () => ({ kind: "mode", mode: "off" })],
  [/^\d+k$/i, (word) => ({ kind: "budget", budget: word.toUpperCase() })],
]

function qualifier(word: string): Qualifier {
  const kind = QUALIFIER_KINDS.find(([pattern]) => pattern.test(word))
  return kind ? kind[1](word) : { kind: "idWord", word }
}

function parseArenaName(name: string) {
  const match = /^(.+?)\s*\(([^()]*)\)$/.exec(name)
  const head = match?.[1] ?? name
  const last = /[-\s]([^-\s]+)$/.exec(head)
  const trailing = last ? qualifier(last[1]) : null
  const trailingMode = trailing?.kind === "mode" ? trailing : null
  // Other sources spell `Command R+` as `command-r-plus`.
  const base = (trailingMode ? head.slice(0, last?.index) : head).replace(/\+$/, " Plus")
  const qualifiers = (match?.[2] ?? "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(qualifier)
  return { base, qualifiers: trailingMode ? [trailingMode, ...qualifiers] : qualifiers }
}

function arenaVariant(name: string) {
  const { base, qualifiers } = parseArenaName(name)
  let mode: ReasoningMode = "unknown"
  let level = "unknown"
  let budget: string | null = null
  const words = [base]
  for (const token of qualifiers) {
    if (token.kind === "effort") [mode, level] = ["on", token.level]
    else if (token.kind === "mode") mode = token.mode
    else if (token.kind === "budget") budget = token.budget
    else words.push(token.word)
  }
  // A budget with no effort word is the effort; beside one, it sets this run apart.
  if (budget && level === "unknown")
    return { sourceModelId: words.join(" "), mode: "on" as const, level: normalizeLevel(budget) }
  return {
    sourceModelId: words.join(" "),
    mode,
    level,
    ...(budget ? { configuration: `${budget} thinking budget` } : {}),
  }
}

const metrics: MetricReaders<ArenaRow> = {
  score: {
    read: (row) =>
      row.ratingLower <= row.rating && row.ratingUpper >= row.rating ? row.rating : null,
    presentation: { label: "Preference rating", unit: "points", format: "number" },
    note: "Arena Text overall, style control; blind human preference, not pass rate",
    describe: (row) => ({
      label: "Arena Text · overall · style control",
      updatedAt: row.publishDate,
      detail: `${row.votes.toLocaleString("en-US")} votes · rank ${row.rank}`,
      interval: { low: row.ratingLower, high: row.ratingUpper },
    }),
  },
  votes: {
    read: (row) => row.votes,
    presentation: { label: "Vote count", unit: "votes", format: "integer" },
    note: "Votes for this Arena configuration; evidence volume, not model quality",
  },
}
export class ArenaProvider
  extends MetricProvider<ArenaRow>
  implements MetricSource<ArenaPayload, ArenaRow>
{
  readonly name = "arena"
  readonly displayName = "Arena Text"
  readonly href = "https://arena.ai/leaderboard/text"
  readonly abbreviation = "Arena"
  readonly cacheKey = "llm-scores:source:arena:text-overall-style-control:v5"
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics = metrics
  toMetricRows(payload: ArenaPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const variant = arenaVariant(row.modelName)
      return {
        ...variant,
        ...(variant.mode === "unknown" || variant.level === "unknown"
          ? { configurationKnown: false as const }
          : {}),
        rawId: row.modelName,
        effortConflict: null,
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name: row.modelName, creator: row.organization, releaseDate: null },
      }
    })
  }
  async fetchPayload(): Promise<ArenaPayload> {
    const response = await fetchOk(this.displayName, DATASET_URL, { timeoutMs: 20_000 })
    const file = await response.arrayBuffer()
    let records: Array<Record<string, unknown>>
    try {
      records = await parquetReadObjects({ file, columns: COLUMNS })
    } catch (cause) {
      throw new Error(`${this.displayName} returned an unreadable parquet file: ${String(cause)}`, {
        cause,
      })
    }
    return parseArenaRecords(records)
  }
}
