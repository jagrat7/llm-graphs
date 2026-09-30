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
})

function findLeaderboard(value: unknown): unknown {
  if (value == null || typeof value !== "object") return null
  if (!Array.isArray(value) && Object.hasOwn(value, "leaderboard"))
    return Reflect.get(value, "leaderboard")
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
    // Any category, adjustment, or schema change fails refresh; the cache keeps its good copy.
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
    describe: (row) => ({
      label: "Arena Text · overall · style control",
      updatedAt: row.updatedAt,
      detail: `${row.votes.toLocaleString("en-US")} votes`,
      interval: { low: row.ratingLower, high: row.ratingUpper },
      preliminary: row.releaseType === "pre_release",
    }),
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
  readonly cacheKey = "llm-scores:source:arena:text-overall-style-control:v3"
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
