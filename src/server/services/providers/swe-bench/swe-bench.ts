import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, isKnownLevel, normalizeLevel, parseRows } from "../utils"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"

const AGENT_VERSION = "2.0.0"
const TASK_COUNT = 500
const DATA_URL =
  "https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json"
const HARNESS = `mini-SWE-agent ${AGENT_VERSION} · SWE-bench Verified`
const rowSchema = z.object({
  folder: z.string().min(1),
  name: z.string().min(1),
  model_display: z.string().min(1),
  model_org: z.string().min(1),
  date: z.iso.date(),
  agent: z.literal("mini-SWE-agent"),
  "mini-swe-agent_version": z.literal(AGENT_VERSION),
  tags: z.array(z.string()).refine((tags) => {
    const models = tags.filter((tag) => tag.startsWith("Model: "))
    return (
      models.length === 1 &&
      models[0].slice(7).trim().length > 0 &&
      tags.includes("System: Attempts - 1")
    )
  }),
  reasoning_effort: z.string().nullish(),
  resolved: z.number().min(0).max(100),
  instance_cost: z.number().nonnegative().nullish(),
  cost: z.number().nonnegative().nullish(),
  per_instance_details: z.record(z.string(), z.unknown()).optional(),
  warning: z.string().nullish(),
})
const storedRowSchema = rowSchema.omit({ per_instance_details: true }).extend({
  agent: z.string(),
  "mini-swe-agent_version": z.string(),
  taskCost: z.number().positive().nullable(),
})
type SWEBenchRow = z.infer<typeof storedRowSchema>
type SWEBenchPayload = SourcePayload<SWEBenchRow>

function agrees(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(1e-8, Math.abs(b) * 1e-6)
}

/** Require all 500 task costs and agreement with both published totals before showing cost. */
function coveredCost(row: z.infer<typeof rowSchema>) {
  if (row.warning || !row.instance_cost || row.cost == null) return null
  const details = Object.values(row.per_instance_details ?? {})
  if (details.length !== TASK_COUNT) return null
  let total = 0
  for (const detail of details) {
    const parsed = z.object({ cost: z.number().nonnegative() }).safeParse(detail)
    if (!parsed.success) return null
    total += parsed.data.cost
  }
  return agrees(total, row.cost) && agrees(total / TASK_COUNT, row.instance_cost)
    ? row.instance_cost
    : null
}

function runKey(run: Pick<MetricRow, "sourceModelId" | "mode" | "level">) {
  return `${run.sourceModelId}/${run.mode}/${run.level}`
}

export function parseSWEBenchFeed(raw: unknown): SWEBenchPayload {
  const feed = z
    .object({
      leaderboards: z.array(z.object({ name: z.string(), results: z.array(z.unknown()) })),
    })
    .parse(raw)
  const boards = feed.leaderboards.filter((board) => board.name === "Verified")
  if (boards.length !== 1) throw new Error("SWE-bench Verified board missing or duplicated")
  const rows = boards[0].results.filter(
    (row) =>
      row != null &&
      typeof row === "object" &&
      Reflect.get(row, "agent") === "mini-SWE-agent" &&
      Reflect.get(row, "mini-swe-agent_version") === AGENT_VERSION,
  )
  const ids = rows
    .map((row) => (row != null && typeof row === "object" ? Reflect.get(row, "folder") : null))
    .filter((id) => typeof id === "string")
  if (new Set(ids).size !== ids.length) throw new Error("SWE-bench duplicate run identity")
  const parsed = parseRows("SWE-bench Verified", rows, rowSchema, "folder")
  return {
    dropped: parsed.dropped,
    rows: parsed.rows.map((row) => storedRowSchema.parse({ ...row, taskCost: coveredCost(row) })),
  }
}

export class SWEBenchProvider
  extends MetricProvider<SWEBenchRow>
  implements MetricSource<SWEBenchPayload, SWEBenchRow>
{
  readonly name = "sweBench"
  readonly displayName = "SWE-bench Verified"
  readonly href = "https://www.swebench.com/"
  readonly abbreviation = "SWE"
  readonly cacheKey = `llm-scores:source:sweBench:verified:mini-${AGENT_VERSION}:v1`
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics: MetricReaders<SWEBenchRow> = {
    score: {
      read: (row) => row.resolved,
      presentation: { label: "Issues resolved", unit: "%", format: "percent" },
      note: `Verified, 500 issues; mini-SWE-agent ${AGENT_VERSION} only`,
      describe: (row) => this.describe(row),
    },
    costPerTask: {
      read: (row) => row.taskCost,
      note: "Published cost/issue; requires costs for all 500 tasks in the same run",
      describe: (row) => this.describe(row),
    },
  }
  private describe(row: SWEBenchRow) {
    return {
      label: this.displayName,
      updatedAt: row.date,
      detail: [
        HARNESS,
        `Run: ${row.folder}`,
        row.warning,
        row.reasoning_effort == null
          ? "Reasoning effort not reported"
          : `Reported effort: ${row.reasoning_effort}`,
        row.taskCost == null
          ? "Task cost unavailable: full spending coverage not verified"
          : "All 500 task costs agree with the reported total and average",
      ]
        .filter(Boolean)
        .join("; "),
    }
  }
  toMetricRows(payload: SWEBenchPayload): Array<MetricRow> {
    const runs = payload.rows.map((row) => {
      const effort = row.reasoning_effort == null ? null : normalizeLevel(row.reasoning_effort)
      const off = effort === "none"
      return {
        row,
        effort,
        off,
        sourceModelId: row.tags
          .find((tag) => tag.startsWith("Model: "))!
          .slice(7)
          .trim(),
        mode: effort == null ? "unknown" : off ? "off" : "on",
        level: effort == null || off ? "unknown" : effort,
      } as const
    })
    const keys = runs.map(runKey)
    // Only a rerun of one model and effort needs its folder to stay apart.
    const reruns = new Set(keys.filter((key, index) => keys.indexOf(key) !== index))

    return runs.map((run) => {
      const { row, effort, off, sourceModelId, mode, level } = run
      return {
        sourceModelId,
        rawId: row.folder,
        harness: HARNESS,
        mode,
        level,
        ...(reruns.has(runKey(run)) ? { configuration: row.folder } : {}),
        ...(effort == null || (!off && !isKnownLevel(effort))
          ? { configurationKnown: false as const }
          : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name: row.model_display, creator: row.model_org, releaseDate: null },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<SWEBenchPayload> {
    return parseSWEBenchFeed(
      await (await fetchOk(this.displayName, DATA_URL, { timeoutMs: 20_000 })).json(),
    )
  }
}
