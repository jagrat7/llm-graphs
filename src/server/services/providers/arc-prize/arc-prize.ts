import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, normalizeLevel, parseRows } from "../utils"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"

const DATASET = "v2_Semi_Private"
const DATA_URL = "https://arcprize.org/media/data/leaderboard/v2.json"
const feedSchema = z.object({
  version: z.literal("v2"),
  generatedAt: z.iso.datetime(),
  datasets: z.array(z.object({ id: z.literal(DATASET) })).length(1),
  evaluations: z.array(z.unknown()).min(1),
})
const rowSchema = z
  .object({
    datasetId: z.literal(DATASET),
    modelId: z.string().min(1),
    modelDisplayName: z.string().min(1),
    modelType: z.enum(["Base LLM", "CoT"]),
    modelReleaseDate: z.iso.datetime().nullable(),
    providerDisplayName: z.string().min(1),
    score: z.number().min(0).max(1),
    costPerTask: z.number().nonnegative().nullable(),
    resultsUrl: z.string(),
    display: z.literal(true),
  })
  .transform(({ datasetId: _datasetId, display: _display, modelType, ...row }) => ({
    ...row,
    reasoning: modelType === "CoT",
  }))
type ARCRow = z.infer<typeof rowSchema> & { updatedAt: string }
type ARCPayload = SourcePayload<ARCRow>

/** Pin the benchmark and eval split; never borrow ARC-AGI-1/3 costs or competition systems. */
export function parseARCPrizeFeed(raw: unknown): ARCPayload {
  const feed = feedSchema.parse(raw)
  const evaluations = feed.evaluations.filter((row) => {
    if (row == null || typeof row !== "object") return true
    const type = Reflect.get(row, "modelType")
    // These are intentional scope exclusions, not malformed source observations.
    return (
      Reflect.get(row, "display") !== false &&
      ![null, "", "Custom", "Refinement", "CoT + Synthesis"].includes(type)
    )
  })
  const payload = parseRows("ARC Prize", evaluations, rowSchema, "modelId")
  const unique = new Map<string, ARCRow>()
  for (const row of payload.rows) {
    const value = { ...row, updatedAt: feed.generatedAt }
    const previous = unique.get(row.modelId)
    if (previous && JSON.stringify(previous) !== JSON.stringify(value))
      throw new Error(`ARC Prize conflicting evaluations for ${row.modelId}`)
    unique.set(row.modelId, value)
  }
  return { rows: [...unique.values()], dropped: payload.dropped }
}

function configuration(row: ARCRow) {
  const parameters = [...row.modelDisplayName.matchAll(/\(([^)]+)\)/g)].flatMap((match) =>
    match[1].split(/,\s*/).map((word) => word.trim().replace(/^Thinking\s+/i, "")),
  )
  const budget = parameters.find((word) => /^\d+k$/i.test(word))
  const effort =
    parameters.find((word) => /^(?:none|minimal|low|medium|high|xhigh|max)$/i.test(word)) ?? budget
  const mode = effort?.toLowerCase() === "none" || (!effort && !row.reasoning) ? "off" : "on"
  const level = effort && mode === "on" ? normalizeLevel(effort) : "unknown"
  // Keep snapshots and model qualifiers; modelGroup sometimes groups different models together.
  const sourceModelId = row.modelId
    .toLowerCase()
    .replaceAll(/[\s_.]+/g, "-")
    .replace(/^(?:openai|anthropic|moonshot|xai|zai)-/, "")
    .replace(/^thinky-/, "")
    .replace(/-thinking(?:-\d+k)?/g, "")
    .replace(/-(?:none|minimal|low|medium|high|xhigh|max)(?=-20\d{2}-\d{2}-\d{2}$|$)/, "")
    .replace(/-(?:bedrock|openrouter)$/, "")
    .replace(/-(?:none|minimal|low|medium|high|xhigh|max)$/, "")
    .replace(/^opus-/, "claude-opus-")
    .replace(/^claude-3-7$/, "claude-sonnet-3-7")
    .replace(/^r1$/, "deepseek-r1")
  return {
    sourceModelId,
    mode,
    level,
    configuration: `ARC Prize standard harness · ARC-AGI-2 semi-private${budget ? ` · ${budget.toUpperCase()} token budget` : parameters.includes("Thinking") ? " · thinking enabled (budget unspecified)" : ""}`,
    known: effort != null || !row.reasoning,
  } as const
}

export class ARCPrizeProvider
  extends MetricProvider<ARCRow>
  implements MetricSource<ARCPayload, ARCRow>
{
  readonly name = "arcPrize"
  readonly displayName = "ARC Prize · ARC-AGI-2"
  readonly href = "https://arcprize.org/leaderboard"
  readonly abbreviation = "ARC"
  readonly cacheKey = "llm-scores:source:arcPrize:arc-agi-2:semi-private:v2"
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<ARCRow> = {
    score: {
      read: (row) => row.score * 100,
      presentation: { label: "ARC-AGI-2 accuracy", unit: "%", format: "percent" },
      note: "ARC Prize ARC-AGI-2 semi-private evaluation; abstract puzzle reasoning",
      describe: (row) => this.describe(row),
    },
    costPerTask: {
      // The owner marks the historical Deep Think price as provisional with footnote ².
      read: (row) => (row.modelDisplayName.includes("²") ? null : row.costPerTask),
      note: "ARC-AGI-2 reported $/task, same evaluation and reasoning setting",
      describe: (row) => this.describe(row),
    },
  }
  private describe(row: ARCRow) {
    const run = configuration(row)
    return {
      label: this.displayName,
      updatedAt: row.updatedAt,
      detail: [
        run.configuration,
        !run.known ? "Reasoning level not reported" : null,
        row.modelDisplayName.includes("²") ? "Provisional pricing; task cost unavailable" : null,
        row.costPerTask == null ? "Task cost not reported" : null,
        row.resultsUrl.startsWith("/results/")
          ? `Run details: https://arcprize.org${row.resultsUrl}`
          : null,
      ]
        .filter(Boolean)
        .join("; "),
    }
  }
  toMetricRows(payload: ARCPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { known, ...run } = configuration(row)
      return {
        ...run,
        ...(!known ? { configurationKnown: false as const } : {}),
        rawId: row.modelId,
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: {
          name: row.modelDisplayName
            .replace(/\s*\(([^)]+)\)/g, (label, parameters: string) =>
              /^(?:Thinking\s*,?\s*)?(?:none|minimal|low|medium|high|xhigh|max|\d+k)(?:,\s*(?:none|minimal|low|medium|high|xhigh|max))?$/i.test(
                parameters,
              )
                ? ""
                : label,
            )
            .replace(/[¹²]/g, "")
            .trim(),
          creator: row.providerDisplayName,
          releaseDate: row.modelReleaseDate?.slice(0, 10) ?? null,
        },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<ARCPayload> {
    return parseARCPrizeFeed(
      await (await fetchOk(this.displayName, DATA_URL, { timeoutMs: 20_000 })).json(),
    )
  }
}
