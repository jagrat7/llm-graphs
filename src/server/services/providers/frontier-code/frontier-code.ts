import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, isKnownLevel, normalizeLevel, parseRows } from "../utils"
import type {
  MetricReaders,
  MetricRow,
  MetricSource,
  ReasoningMode,
  SourcePayload,
} from "../provider.types"

const VERSION = "2.0"
const DATASET = "main"
const PAGE = "https://cognition.com/frontiercode"
const DATA_URL = `https://cognition.com/data/frontier-code-${VERSION}/data.json`
/** The leaderboard's own labels for its harness ids. */
const HARNESSES: Record<string, string> = {
  devin: "Devin CLI",
  "devin-cli": "Devin CLI",
  "devin-cli-swe1": "Devin CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  "grok-build": "Grok Build",
  muse: "Muse Code",
  "gemini-cli": "Gemini CLI",
  vibe: "Mistral Vibe",
  "mini-swe-agent": "mini-swe-agent",
}
/** Labs by a model name's first word; the feed's lab colours are shared, so they can't say. */
const CREATORS: Record<string, string> = {
  Claude: "Anthropic",
  GPT: "OpenAI",
  Gemini: "Google",
  Grok: "xAI",
  Muse: "Meta",
  Kimi: "Moonshot AI",
  GLM: "Z.AI",
  DeepSeek: "DeepSeek",
  Mistral: "Mistral",
  SWE: "Cognition",
  Inkling: "Thinking Machines",
  Beam: "Reflection AI",
}
const feedSchema = z.object({
  models: z.array(z.string().min(1)).min(1),
  harness: z.record(z.string(), z.string()),
  efforts: z.record(z.string(), z.array(z.string().min(1))),
  subsets: z.object({ [DATASET]: z.number().int().positive() }),
  data: z.record(
    z.string(),
    z.record(z.string(), z.record(z.string(), z.record(z.string(), z.unknown()))),
  ),
})
const rowSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  effort: z.string().min(1),
  harness: z.string().min(1),
  tasks: z.number().int().positive(),
  new_score: z.number().min(0).max(1),
  correct: z.number().min(0).max(1).nullable(),
  cost: z.number().nonnegative().nullable(),
  tokens: z.number().nonnegative().nullable(),
  flagged_rate: z.number().min(0).max(1).nullable(),
})
type FrontierCodeRow = z.infer<typeof rowSchema>
type FrontierCodePayload = SourcePayload<FrontierCodeRow>

/** Read the leaderboard's own versioned feed: one row per model and effort on the main task set. */
export function parseFrontierCodeFeed(raw: unknown): FrontierCodePayload {
  const feed = feedSchema.parse(raw)
  const runs = feed.models.flatMap((model) =>
    (feed.efforts[model] ?? []).map((effort) => ({
      ...feed.data[model]?.[effort]?.[DATASET],
      id: `${model} / ${effort}`,
      model,
      effort,
      harness: feed.harness[model],
      tasks: feed.subsets[DATASET],
    })),
  )
  // Validate identities before malformed measurements can hide a conflicting run.
  if (new Set(runs.map((run) => run.id)).size !== runs.length)
    throw new Error("FrontierCode duplicate run identity")
  const payload = parseRows("FrontierCode", runs, rowSchema, "id")
  // A listed model without efforts has no runs; keep it visible in diagnostics.
  const unlisted = feed.models
    .filter((model) => !feed.efforts[model]?.length)
    .map((model) => ({ id: model, reason: "efforts: none listed" }))
  return { rows: payload.rows, dropped: [...payload.dropped, ...unlisted] }
}

function percent(fraction: number) {
  return `${(fraction * 100).toFixed(1)}%`
}

function reasoning(effort: string): { mode: ReasoningMode; level: string } {
  if (effort === "na") return { mode: "unknown", level: "unknown" }
  const level = normalizeLevel(effort)
  return level === "none" ? { mode: "off", level: "unknown" } : { mode: "on", level }
}

function configuration(row: FrontierCodeRow) {
  return `${HARNESSES[row.harness] ?? row.harness} · FrontierCode ${VERSION}`
}

export class FrontierCodeProvider
  extends MetricProvider<FrontierCodeRow>
  implements MetricSource<FrontierCodePayload, FrontierCodeRow>
{
  readonly name = "frontierCode"
  readonly displayName = `FrontierCode ${VERSION}`
  readonly href = PAGE
  readonly abbreviation = "FC"
  readonly cacheKey = `llm-scores:source:frontierCode:${VERSION}:${DATASET}:v1`
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<FrontierCodeRow> = {
    score: {
      read: (row) => row.new_score * 100,
      presentation: { label: "Mergeability", unit: "%", format: "percent" },
      note: `FrontierCode ${VERSION}; maintainer-graded rubric score, zero if any blocking criterion fails`,
      describe: (row) => this.describe(row),
    },
    costPerTask: {
      read: (row) => row.cost,
      note: `FrontierCode ${VERSION}; published mean $/rollout at list API prices, same harness and effort`,
      describe: (row) => this.describe(row),
    },
  }
  private describe(row: FrontierCodeRow) {
    return {
      label: this.displayName,
      detail: [
        `${configuration(row)}; ${row.tasks} maintainer-written tasks`,
        row.correct != null ? `Pass rate: ${percent(row.correct)}` : null,
        row.flagged_rate != null
          ? `Runs zeroed for solution-bearing internet use: ${percent(row.flagged_rate)}`
          : null,
        row.cost == null
          ? "Task cost not reported"
          : "Cost uses list API prices, including public discounts",
        row.tokens != null
          ? `Mean output tokens/rollout: ${Math.round(row.tokens).toLocaleString("en-US")}`
          : null,
        row.effort === "na" ? "Reasoning effort not reported" : null,
      ]
        .filter(Boolean)
        .join("; "),
    }
  }
  toMetricRows(payload: FrontierCodePayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { mode, level } = reasoning(row.effort)
      return {
        sourceModelId: row.model.toLowerCase().replaceAll(/[\s.]+/g, "-"),
        rawId: row.id,
        mode,
        level,
        configuration: configuration(row),
        ...(mode === "unknown" || (mode === "on" && !isKnownLevel(level))
          ? { configurationKnown: false as const }
          : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: {
          name: row.model,
          creator: CREATORS[row.model.split(/[\s-]/)[0]] ?? null,
          releaseDate: null,
        },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<FrontierCodePayload> {
    return parseFrontierCodeFeed(
      await (await fetchOk(this.displayName, DATA_URL, { timeoutMs: 20_000 })).json(),
    )
  }
}
