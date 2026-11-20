import { z } from "zod"

import { MetricProvider } from "../metric-provider"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"
import { describeMetrics, fetchOk, isKnownLevel, parseRows, reasoningFromEffort } from "../utils"

const PAGE = "https://clutterbench.adamholter.chatgpt.site/"
const PROMPTS = {
  raw: { name: "clutterBench", label: "Raw prompt" },
  simple: { name: "clutterBenchSimple", label: "Simple prompt" },
} as const
type Prompt = keyof typeof PROMPTS

const CREATORS = new Map([
  ["Claude", "Anthropic"],
  ["DeepSeek", "DeepSeek"],
  ["Gemini", "Google"],
  ["GPT", "OpenAI"],
  ["Grok", "xAI"],
])

const dataSchema = z.object({
  board: z.array(z.unknown()).min(1),
  builtAt: z.iso.datetime(),
  grader: z.string().min(1),
  cost: z.object({ pricesFetchedAt: z.iso.datetime().nullish() }).optional(),
})
const rowSchema = z.object({
  model: z.string().min(1),
  name: z.string().trim().min(1),
  effort: z.string().trim(),
  result: z.object({
    n: z.number().int().positive(),
    clutter: z.number().min(0).max(100),
    usd: z.number().nonnegative().nullish(),
    sec: z.number().positive().nullish(),
  }),
  builtAt: z.iso.datetime(),
  grader: z.string().min(1),
  pricesFetchedAt: z.iso.datetime().nullish(),
})

type ClutterBenchRow = z.infer<typeof rowSchema>
type ClutterBenchPayload = SourcePayload<ClutterBenchRow>
let pending: Promise<unknown> | undefined

function fetchData() {
  pending ??= fetchOk("ClutterBench", `${PAGE}data.json`, { timeoutMs: 15_000 })
    .then((response) => response.json())
    .finally(() => {
      pending = undefined
    })
  return pending
}

export function parseClutterBench(data: unknown, prompt: Prompt): ClutterBenchPayload {
  const { board, builtAt, grader, cost } = dataSchema.parse(data)
  const payload = parseRows(
    "ClutterBench",
    board.map((row) =>
      row != null && typeof row === "object"
        ? {
            ...row,
            result: Reflect.get(row, prompt),
            builtAt,
            grader,
            pricesFetchedAt: cost?.pricesFetchedAt,
          }
        : row,
    ),
    rowSchema,
    "model",
  )
  if (new Set(payload.rows.map((row) => row.model)).size !== payload.rows.length)
    throw new Error("ClutterBench duplicate run identity")
  return payload
}

export class ClutterBenchProvider
  extends MetricProvider<ClutterBenchRow>
  implements MetricSource<ClutterBenchPayload, ClutterBenchRow>
{
  readonly name: (typeof PROMPTS)[Prompt]["name"]
  readonly displayName: string
  readonly cacheKey: string
  readonly href = `${PAGE}#leaderboard`
  readonly abbreviation = "CB"
  readonly publisher = "Adam Holter"
  readonly category = "ui"
  readonly summary: string
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<ClutterBenchRow> = {
    score: {
      read: (row) => row.result.clutter,
      presentation: { label: "Clutter", unit: "%", format: "percent", better: "lower" },
      note: "Mean share of drawn area marked for removal plus half the area marked for shrinking. Lower is better.",
      describe: (row) => this.describe(row, `Grader ${row.grader}`),
    },
    costPerTask: {
      read: (row) => row.result.usd ?? null,
      presentation: { label: "Estimated cost", unit: "$/graphic", format: "currency" },
      note: "Publisher's estimate for one request at API list prices",
      describe: (row) =>
        this.describe(row, "One request at API list prices", row.pricesFetchedAt ?? row.builtAt),
    },
    durationSeconds: {
      read: (row) => row.result.sec ?? null,
      presentation: { label: "Graphic duration", unit: "s", format: "number" },
      note: "Mean wall-clock time per graphic, including browsing",
      describe: (row) => this.describe(row, "Wall-clock time including browsing"),
    },
  }

  constructor(private readonly prompt: Prompt) {
    super()
    const { name, label } = PROMPTS[prompt]
    this.name = name
    this.displayName = `ClutterBench (${label.toLowerCase()})`
    this.cacheKey = `llm-scores:source:${name}:v1`
    this.summary =
      prompt === "raw"
        ? "Measures clutter in HTML graphics made with a basic request for a tasteful graphic."
        : "Measures clutter in HTML graphics made with explicit instructions to keep them simple."
  }

  private describe(row: ClutterBenchRow, detail: string, updatedAt = row.builtAt) {
    return {
      label: this.displayName,
      detail: `${row.result.n} scored graphics · ${detail}`,
      updatedAt,
    }
  }

  toMetricRows(payload: ClutterBenchPayload): Array<MetricRow> {
    return payload.rows.map<MetricRow>((row) => {
      const suffix = ` (${row.effort})`
      const name = row.name.endsWith(suffix) ? row.name.slice(0, -suffix.length) : row.name
      const { mode, level } = reasoningFromEffort(row.effort)
      return {
        sourceModelId: name,
        rawId: row.model,
        mode,
        level,
        harness: this.displayName,
        ...(mode === "unknown" || (mode === "on" && !isKnownLevel(level))
          ? { configurationKnown: false }
          : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name, creator: CREATORS.get(name.split(/[ -]/)[0]) ?? null, releaseDate: null },
        effortConflict: null,
      }
    })
  }

  async fetchPayload(): Promise<ClutterBenchPayload> {
    return parseClutterBench(await fetchData(), this.prompt)
  }
}
