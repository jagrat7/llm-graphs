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

const VERSION = "1.2"
const PAGE = "https://www.reactbench.com/"
const HARNESS = `ReactBench ${VERSION} · pass@1 over 5 trials per task`
/** Cursor-served runs carry a `cursor-` prefix the catalog doesn't use. */
const CURSOR_PREFIX = "cursor-"
/** Labs by the id's org prefix, or by its first word when it has none. */
const CREATORS: Record<string, string> = {
  claude: "Anthropic",
  gpt: "OpenAI",
  grok: "xAI",
  composer: "Cursor",
  alibaba: "Alibaba",
  callstack: "Callstack",
  deepseek: "DeepSeek",
  google: "Google",
  meta: "Meta",
  moonshotai: "Moonshot AI",
  "particle-ai": "Particle",
  recursive: "Recursive",
  thinkingmachines: "Thinking Machines",
  zai: "Z.AI",
}
const versionSchema = z.object({
  source: z.object({
    tasks: z.number().int().positive(),
    writeTasks: z.number().int().nonnegative(),
    fixTasks: z.number().int().nonnegative(),
    repositories: z.number().int().positive(),
  }),
  leaderboard: z.array(z.unknown()).min(1),
})
const fraction = z.number().min(0).max(1)
const rowSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  effort: z.string(),
  passRate: fraction,
  ciLo: fraction,
  ciHi: fraction,
  avgCost: z.number().nonnegative().nullable(),
  avgOutTokens: z.number().nonnegative().nullable(),
  trials: z.number().int().positive(),
  scored: z.number().int().nonnegative(),
  hasEstimatedUsage: z.boolean().optional(),
  testsOnly: z.object({ passRate: fraction }).optional(),
  tasks: z.number().int().positive(),
  writeTasks: z.number().int().nonnegative(),
  fixTasks: z.number().int().nonnegative(),
  repositories: z.number().int().positive(),
})
type ReactBenchRow = z.infer<typeof rowSchema>
type ReactBenchPayload = SourcePayload<ReactBenchRow>

/** The flight data's own object holding the pinned version, wherever the page nests it. */
function findVersion(node: unknown): unknown {
  if (node == null || typeof node !== "object") return undefined
  const version = Reflect.get(node, `v${VERSION}`)
  if (version != null && typeof version === "object" && "leaderboard" in version) return version
  for (const child of Object.values(node)) {
    const found = findVersion(child)
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * Read the leaderboard the page server-renders into its React flight data, without running the
 * site's JavaScript. Versions are keyed, so a new revision cannot replace the pinned one.
 */
export function parseReactBenchPage(html: string): ReactBenchPayload {
  const flight = [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)]
    .map((match): unknown => JSON.parse(match[1]))
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[1] === "string" ? chunk[1] : ""))
    .join("")
  let found: unknown
  for (const line of flight.split("\n")) {
    const json = /^[\da-f]+:(\[.*)$/.exec(line)?.[1]
    if (!json?.includes(`"v${VERSION}"`)) continue
    try {
      found = findVersion(JSON.parse(json))
    } catch {
      continue
    }
    if (found !== undefined) break
  }
  if (found === undefined) throw new Error(`ReactBench v${VERSION} leaderboard missing`)
  const { source, leaderboard } = versionSchema.parse(found)
  const ids = leaderboard.map((row) =>
    row != null && typeof row === "object" ? Reflect.get(row, "id") : null,
  )
  if (new Set(ids).size !== ids.length) throw new Error("ReactBench duplicate run identity")
  return parseRows(
    "ReactBench",
    leaderboard.map((row) =>
      row != null && typeof row === "object" ? { ...row, ...source } : row,
    ),
    rowSchema,
    "id",
  )
}

function percent(share: number) {
  return `${(share * 100).toFixed(1)}%`
}

function reasoning(effort: string): { mode: ReasoningMode; level: string } {
  if (!effort.trim()) return { mode: "unknown", level: "unknown" }
  const level = normalizeLevel(effort)
  return level === "none" ? { mode: "off", level: "unknown" } : { mode: "on", level }
}

function model(row: ReactBenchRow) {
  const viaCursor = row.model.startsWith(CURSOR_PREFIX) && !row.model.includes("/")
  const id = viaCursor ? row.model.slice(CURSOR_PREFIX.length) : row.model
  const org = id.includes("/") ? id.split("/")[0] : id.split(/[-.]/)[0]
  return { id, viaCursor, creator: CREATORS[org] ?? null }
}

export class ReactBenchProvider
  extends MetricProvider<ReactBenchRow>
  implements MetricSource<ReactBenchPayload, ReactBenchRow>
{
  readonly name = "reactBench"
  readonly displayName = `ReactBench ${VERSION}`
  readonly href = PAGE
  readonly abbreviation = "RB"
  readonly publisher = "Million"
  readonly category = "coding"
  readonly summary =
    "Real React work from open-source repos, passing only when hidden tests pass and React Doctor finds no new issues."
  readonly cacheKey = `llm-scores:source:reactBench:${VERSION}:v1`
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<ReactBenchRow> = {
    score: {
      read: (row) => row.passRate * 100,
      presentation: { label: "Pass@1", unit: "%", format: "percent" },
      note: `ReactBench ${VERSION}; share of trials passing hidden tests and React Doctor`,
      describe: (row) => ({
        ...this.describe(row),
        interval: { low: row.ciLo * 100, high: row.ciHi * 100 },
      }),
    },
    costPerTask: {
      // Estimated token usage makes an estimated cost; keep it unavailable.
      read: (row) => (row.hasEstimatedUsage ? null : row.avgCost),
      note: `ReactBench ${VERSION}; published mean $/rollout, same model and effort`,
      describe: (row) => this.describe(row),
    },
  }
  private describe(row: ReactBenchRow) {
    return {
      label: this.displayName,
      detail: [
        `${HARNESS}; ${row.tasks} tasks (${row.writeTasks} writing, ${row.fixTasks} fixing) across ${row.repositories} repositories`,
        `${row.scored}/${row.trials} trials scored; 95% run-to-run interval`,
        row.testsOnly ? `Tests-only pass rate: ${percent(row.testsOnly.passRate)}` : null,
        "Agent harness varies by model and is not published per run",
        model(row).viaCursor ? "Run through Cursor" : null,
        row.hasEstimatedUsage
          ? "Task cost unavailable: source estimated this run's token usage"
          : row.avgCost == null
            ? "Task cost not reported"
            : null,
        row.avgOutTokens != null
          ? `Mean output tokens/rollout: ${Math.round(row.avgOutTokens).toLocaleString("en-US")}`
          : null,
        row.effort.trim() ? null : "Reasoning effort not reported",
      ]
        .filter(Boolean)
        .join("; "),
    }
  }
  toMetricRows(payload: ReactBenchPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { mode, level } = reasoning(row.effort)
      const { id, creator } = model(row)
      return {
        sourceModelId: id,
        rawId: row.id,
        mode,
        level,
        harness: HARNESS,
        ...(mode === "unknown" || (mode === "on" && !isKnownLevel(level))
          ? { configurationKnown: false as const }
          : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name: null, creator, releaseDate: null },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<ReactBenchPayload> {
    return parseReactBenchPage(
      await (await fetchOk(this.displayName, PAGE, { timeoutMs: 20_000 })).text(),
    )
  }
}
