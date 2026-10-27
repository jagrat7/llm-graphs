import { parquetReadObjects } from "hyparquet"
import { MetricProvider } from "../metric-provider"
import { z } from "zod"
import { fetchOk, parseRows, describeMetrics } from "../utils"
import type { MetricReaders, MetricSource, MetricRow } from "../provider.types"
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
  // Parquet int64 values decode as bigint; accept numbers in inline records too.
  rank: z.union([z.bigint(), z.number()]).transform(Number).pipe(z.number().int().positive()),
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

/** Only explicit labels identify effort; model names such as qwen3.8-max remain model names. */
export function arenaEffort(id: string) {
  const labeled =
    /\s+\((?:thinking[- ]|reasoning[- ])?(minimal|low|medium|high|xhigh|max)\)$/i.exec(id)
  if (labeled)
    return {
      sourceModelId: id.slice(0, -labeled[0].length),
      mode: "on" as const,
      level: labeled[1].toLowerCase(),
    }
  const parentheticalMode = /\s+\((thinking|reasoning|non-thinking|non-reasoning)\)$/i.exec(id)
  if (parentheticalMode)
    return {
      sourceModelId: id.slice(0, -parentheticalMode[0].length),
      mode: parentheticalMode[1].toLowerCase().startsWith("non-")
        ? ("off" as const)
        : ("on" as const),
      level: "unknown",
    }
  const suffix = /-(minimal|low|medium|high|xhigh|max)$/i.exec(id)
  const effortModel = /^(gpt-|claude-|gemini-|muse-spark-)/i.test(id)
  if (suffix && effortModel)
    return {
      sourceModelId: id.slice(0, -suffix[0].length),
      mode: "on" as const,
      level: suffix[1].toLowerCase(),
    }
  const nonReasoning = /-(no-thinking|non-thinking|non-reasoning)$/i.exec(id)
  if (nonReasoning)
    return {
      sourceModelId: id.slice(0, -nonReasoning[0].length),
      mode: "off" as const,
      level: "unknown",
    }
  const reasoning = /-(thinking|reasoning)$/.exec(id)
  if (reasoning)
    return {
      sourceModelId: id.slice(0, -reasoning[0].length),
      mode: "on" as const,
      level: "unknown",
    }
  return { sourceModelId: id, mode: "unknown" as const, level: "unknown" }
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
      const effort = arenaEffort(row.modelName)
      return {
        ...effort,
        ...(effort.mode === "unknown" || effort.level === "unknown"
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
