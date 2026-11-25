import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, parseRows } from "../utils"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"

const BOARD = "image"
const PAGE = `https://www.designarena.ai/leaderboard?section=${BOARD}&board=${BOARD}`
/** How the page streams its React flight data, one call per script element. */
const FLIGHT_PUSH = "self.__next_f.push("
const TRAILING_PARENTHETICAL = /^(.+?)\s*\(([^()]+)\)$/
const NAMED_SETTINGS = /^(?:[a-z]+:\s*[^,]+,?\s*)+$/i
const QUALITY_LEVEL = /^(?:very[ _])?(?:low|medium|high)$|^(?:auto|max)$/i
/** Labs by DesignArena's provider slug, where the slug isn't the lab's name. */
const CREATORS: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  bytedance: "ByteDance",
  microsoft: "Microsoft",
  "black-forest-labs": "Black Forest Labs",
  alibaba: "Alibaba",
  qwen: "Alibaba",
  klingai: "Kling",
}

const boardRowSchema = z.object({
  modelId: z.string().min(1),
  elo: z.number().positive(),
  battles: z.number().int().positive(),
  winRate: z.number().min(0).max(100),
  btStdErr: z.number().positive().nullish(),
  avgGenerationTimeMs: z.number().positive().nullish(),
  avgCostUsd: z.number().nonnegative().nullish(),
})
const registryEntrySchema = z.object({
  displayName: z.string().trim().min(1),
  provider: z.string().nullish(),
})
const rowSchema = boardRowSchema.extend({
  displayName: z.string().min(1),
  provider: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
export type DesignArenaRow = z.infer<typeof rowSchema>
export type DesignArenaPayload = SourcePayload<DesignArenaRow>

/** The flight data as text, each script element read on its own so a bad one can't spill over. */
function flightText(html: string) {
  return html
    .split("</script>")
    .map((script) => {
      const call = script.lastIndexOf(FLIGHT_PUSH)
      const body = call < 0 ? "" : script.slice(call + FLIGHT_PUSH.length).trimEnd()
      if (!body.endsWith(")")) return ""
      try {
        const chunk: unknown = JSON.parse(body.slice(0, -1))
        return Array.isArray(chunk) && typeof chunk[1] === "string" ? chunk[1] : ""
      } catch {
        return ""
      }
    })
    .join("")
}

/** The JSON object that opens at `start`, read by matching its braces. */
function objectAt(text: string, start: number): unknown {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === "\\") index++
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === "{") depth++
    else if (char === "}" && --depth === 0) return JSON.parse(text.slice(start, index + 1))
  }
  throw new Error("DesignArena page data is cut off")
}

/**
 * Read the image board and its model registry from the React flight data the leaderboard page
 * server-renders, without running the site's JavaScript.
 */
export function parseDesignArenaPage(html: string): DesignArenaPayload {
  const text = flightText(html)
  const boardAt = text.indexOf(`{"arenaType":"models","category":"${BOARD}"`)
  if (boardAt < 0) throw new Error(`DesignArena ${BOARD} board missing`)
  const board = z
    .object({
      data: z.array(z.unknown()).min(1),
      metadata: z.object({ lastUpdateTime: z.string().nullish() }).nullish(),
    })
    .parse(objectAt(text, boardAt))
  const registryAt = text.indexOf('"registry":{"models":')
  if (registryAt < 0) throw new Error("DesignArena model registry missing")
  const registry = new Map(
    Object.entries(
      z
        .record(z.string(), z.unknown())
        .parse(objectAt(text, text.indexOf("{", registryAt + '"registry":{"models":'.length - 1))),
    ).flatMap(([id, entry]) => {
      const parsed = registryEntrySchema.safeParse(entry)
      return parsed.success ? [[id, parsed.data] as const] : []
    }),
  )
  const updatedAt = board.metadata?.lastUpdateTime ?? null

  return parseRows(
    "DesignArena",
    board.data.map((row) => {
      const id = row != null && typeof row === "object" ? Reflect.get(row, "modelId") : null
      const model = typeof id === "string" ? registry.get(id) : undefined
      return model && row != null && typeof row === "object"
        ? { ...row, displayName: model.displayName, provider: model.provider ?? null, updatedAt }
        : row
    }),
    rowSchema,
    "modelId",
  )
}

export function designArenaModel(displayName: string) {
  const match = TRAILING_PARENTHETICAL.exec(displayName)
  if (!match) return { name: displayName, configuration: null }
  const [, name, inside] = match
  if (NAMED_SETTINGS.test(inside)) {
    const configuration = inside
      .split(",")
      .map((part) => part.replace(/:\s*/, " ").trim())
      .filter(Boolean)
      .join(", ")
    return { name, configuration }
  }
  if (QUALITY_LEVEL.test(inside)) {
    return { name, configuration: `quality ${inside.replace("_", " ").toLowerCase()}` }
  }
  return { name, configuration: null }
}

function creator(provider: string | null) {
  if (!provider) return null
  return CREATORS[provider] ?? provider
}

export class DesignArenaProvider
  extends MetricProvider<DesignArenaRow>
  implements MetricSource<DesignArenaPayload, DesignArenaRow>
{
  readonly name = "designArena"
  readonly displayName = "DesignArena Image"
  readonly href = PAGE
  readonly abbreviation = "DA"
  readonly publisher = "Intelligence"
  readonly category = "image"
  readonly summary =
    "Ratings from blind, side-by-side human votes between images two anonymous models made from the same prompt."
  readonly cacheKey = `llm-scores:source:designArena:${BOARD}:v1`
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics: MetricReaders<DesignArenaRow> = {
    score: {
      read: (row) => row.elo,
      presentation: { label: "Preference rating", unit: "points", format: "number" },
      note: "DesignArena image board; blind human preference, not pass rate",
      describe: (row) => ({
        ...this.describe(row),
        ...(row.btStdErr
          ? { interval: { low: row.elo - row.btStdErr, high: row.elo + row.btStdErr } }
          : {}),
      }),
    },
    costPerTask: {
      read: (row) => row.avgCostUsd ?? null,
      presentation: { label: "Cost per image", unit: "$/image", format: "currency" },
      note: "DesignArena; mean cost of one image",
      describe: (row) => this.describe(row),
    },
    durationSeconds: {
      read: (row) => (row.avgGenerationTimeMs == null ? null : row.avgGenerationTimeMs / 1000),
      presentation: { label: "Time per image", unit: "s", format: "number" },
      note: "DesignArena; mean time to generate one image",
      describe: (row) => this.describe(row),
    },
    votes: {
      read: (row) => row.battles,
      presentation: { label: "Vote count", unit: "votes", format: "integer" },
      note: "Votes for this DesignArena model; evidence volume, not model quality",
    },
  }
  private describe(row: DesignArenaRow) {
    return {
      label: this.displayName,
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
      detail: `${this.displayName} · ${row.battles.toLocaleString("en-US")} votes · ${row.winRate}% won`,
    }
  }
  toMetricRows(payload: DesignArenaPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { name, configuration } = designArenaModel(row.displayName)
      return {
        sourceModelId: name,
        rawId: row.modelId,
        // Image models don't reason and have one setting, so there's no effort to tag.
        mode: "off",
        level: "default",
        ...(configuration ? { configuration } : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name, creator: creator(row.provider), releaseDate: null },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<DesignArenaPayload> {
    return parseDesignArenaPage(
      await (await fetchOk(this.displayName, PAGE, { timeoutMs: 20_000 })).text(),
    )
  }
}
