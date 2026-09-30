import { MetricProvider } from "../metric-provider"
import { z } from "zod"
import { fetchOk, parseRows, describeMetrics } from "../utils"
import type { MetricReaders, MetricSource, MetricRow } from "../provider.types"
import type { ArenaPayload, ArenaRow } from "./arena.types"

const leaderboardSchema = z.object({
  arenaSlug: z.literal("text"),
  leaderboardSlug: z.literal("overall"),
  params: z.object({
    category: z.literal("overall"),
    styleControl: z.literal(true),
    factuality: z.literal(false).optional(),
  }),
  voteCutoffISOString: z.iso.datetime(),
  entries: z.array(z.unknown()).min(1),
})
const selectionSchema = leaderboardSchema.pick({
  arenaSlug: true,
  leaderboardSlug: true,
  params: true,
})
const rowSchema: z.ZodType<ArenaRow> = z.object({
  modelKey: z.string().min(1),
  modelDisplayName: z.string().min(1),
  modelOrganization: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null),
  rating: z.number().positive(),
  ratingLower: z.number().positive(),
  ratingUpper: z.number().positive(),
  votes: z.number().int().positive(),
  releaseType: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  updatedAt: z.iso.datetime(),
  inputPricePerMillion: z
    .number()
    .nonnegative()
    .nullish()
    .transform((v) => v ?? null),
  outputPricePerMillion: z
    .number()
    .nonnegative()
    .nullish()
    .transform((v) => v ?? null),
  contextLength: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  rank: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  rankLower: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  rankUpper: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
})

function findLeaderboard(value: unknown): unknown {
  if (value == null || typeof value !== "object") return null
  if (!Array.isArray(value) && Object.hasOwn(value, "leaderboard")) {
    const candidate: unknown = Reflect.get(value, "leaderboard")
    if (selectionSchema.safeParse(candidate).success) return candidate
  }
  for (const child of Object.values(value)) {
    const found = findLeaderboard(child)
    if (found) return found
  }
  return null
}

/** Decode first-party server data, never evaluate the page's scripts or depend on table markup. */
export function parseArenaPage(html: string): ArenaPayload {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[1,.*?\])\)<\/script>/gs)]
    .map((match) => {
      const chunk: unknown = JSON.parse(match[1])
      return Array.isArray(chunk) && typeof chunk[1] === "string" ? chunk[1] : ""
    })
    .join("")
  for (const line of chunks.split("\n")) {
    const record = /^[\da-f]+:([[{].*)$/.exec(line)
    if (!record) continue
    let value: unknown
    try {
      value = JSON.parse(record[1])
    } catch {
      continue
    }
    const raw = findLeaderboard(value)
    if (raw == null) continue
    // Only the requested category/adjustment qualifies; malformed selected data fails refresh.
    const board = leaderboardSchema.parse(raw)
    return parseRows(
      "Arena",
      board.entries.map((entry) => ({
        ...(entry != null && typeof entry === "object" ? entry : {}),
        updatedAt: board.voteCutoffISOString,
      })),
      rowSchema,
      "modelDisplayName",
    )
  }
  throw new Error("Arena Text structured leaderboard was not found")
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
    describe: (row) => {
      // Arena's upper rank is the better (numerically smaller) position.
      const low =
        row.rankLower != null && row.rankUpper != null
          ? Math.min(row.rankLower, row.rankUpper)
          : null
      const high =
        row.rankLower != null && row.rankUpper != null
          ? Math.max(row.rankLower, row.rankUpper)
          : null
      const rank =
        row.rank == null
          ? ""
          : ` · rank ${row.rank}${low != null && high != null && low <= row.rank && high >= row.rank ? ` (${low}–${high})` : ""}`
      return {
        label: "Arena Text · overall · style control",
        updatedAt: row.updatedAt,
        detail: `${row.votes.toLocaleString("en-US")} votes${rank}`,
        interval: { low: row.ratingLower, high: row.ratingUpper },
        preliminary: row.releaseType === "pre_release",
      }
    },
  },
  costPerMTokens: {
    read: (row) =>
      row.inputPricePerMillion != null && row.outputPricePerMillion != null
        ? (3 * row.inputPricePerMillion + row.outputPricePerMillion) / 4
        : null,
    scope: "model",
    presentation: { label: "Token price", unit: "$/M tokens", format: "currency" },
    note: "Arena listed prices, 3:1 input/output blend; not benchmark task cost",
  },
  inputPricePerMTokens: {
    read: (row) => row.inputPricePerMillion,
    scope: "model",
    presentation: { label: "Input token price", unit: "$/M tokens", format: "currency" },
  },
  outputPricePerMTokens: {
    read: (row) => row.outputPricePerMillion,
    scope: "model",
    presentation: { label: "Output token price", unit: "$/M tokens", format: "currency" },
  },
  contextTokens: {
    read: (row) => row.contextLength,
    scope: "model",
    presentation: { label: "Context length", unit: "tokens", format: "tokens" },
    note: "Arena listed context window; not an evaluated long-context capability score",
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
  readonly cacheKey = "llm-scores:source:arena:text-overall-style-control:v4"
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics = metrics
  toMetricRows(payload: ArenaPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const effort = arenaEffort(row.modelDisplayName)
      return {
        ...effort,
        ...(effort.mode === "unknown" || effort.level === "unknown"
          ? { configurationKnown: false as const }
          : {}),
        rawId: row.modelDisplayName,
        effortConflict: null,
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name: row.modelDisplayName, creator: row.modelOrganization, releaseDate: null },
      }
    })
  }
  async fetchPayload(): Promise<ArenaPayload> {
    const response = await fetchOk(this.displayName, this.href, { timeoutMs: 20_000 })
    return parseArenaPage(await response.text())
  }
}
