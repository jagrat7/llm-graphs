import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, normalizeLevel } from "../utils"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"

const DATA_URL = "https://livecodebench.github.io/performances_generation.json"
// The official leaderboard's default window, pinned so refreshes cannot change the evaluation.
const START = Date.parse("2024-08-01T00:00:00Z")
const END = Date.parse("2025-05-01T00:00:00Z")
const QUESTION_COUNT = 454
const WINDOW = "2024-08-01–2025-05-01"
const HARNESS = `LiveCodeBench code generation · ${WINDOW} · pass@1`
const modelSchema = z.object({ model_name: z.string().min(1), model_repr: z.string().min(1) })
const problemSchema = z.object({
  model: z.string().min(1),
  question_id: z.string().min(1),
  platform: z.enum(["leetcode", "atcoder", "codeforces"]),
  date: z.number().int().nonnegative(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  "pass@1": z.number().min(0).max(100),
})
type LiveCodeBenchRow = z.infer<typeof modelSchema> & { score: number; questions: number }
type LiveCodeBenchPayload = SourcePayload<LiveCodeBenchRow>

/** Each model must cover the identical complete question set; missing results never become zero. */
export function parseLiveCodeBenchFeed(raw: unknown): LiveCodeBenchPayload {
  const feed = z
    .object({
      models: z.array(modelSchema),
      performances: z.array(z.unknown()),
      date_marks: z.array(z.number().int()),
    })
    .parse(raw)
  if (!feed.date_marks.includes(START) || !feed.date_marks.includes(END))
    throw new Error("LiveCodeBench pinned window missing")
  const names = feed.models.map((model) => model.model_repr)
  if (
    new Set(names).size !== names.length ||
    new Set(feed.models.map((model) => model.model_name)).size !== names.length
  )
    throw new Error("LiveCodeBench duplicate model identity")
  const records = new Map<string, Map<string, z.infer<typeof problemSchema>>>()
  const invalid = new Set<string>()
  const identities = new Set<string>()
  const questions = new Map<string, { date: number; difficulty: string }>()
  for (const rawProblem of feed.performances) {
    if (rawProblem == null || typeof rawProblem !== "object")
      throw new Error("LiveCodeBench unidentifiable problem")
    const date = Reflect.get(rawProblem, "date")
    if (typeof date === "number" && (date < START || date > END)) continue
    const model = Reflect.get(rawProblem, "model")
    if (typeof model !== "string" || !names.includes(model))
      throw new Error("LiveCodeBench undeclared model")
    const key = `${Reflect.get(rawProblem, "platform")}/${Reflect.get(rawProblem, "question_id")}`
    const id = `${model}/${key}`
    if (identities.has(id)) throw new Error("LiveCodeBench duplicate problem identity")
    identities.add(id)
    const parsed = problemSchema.safeParse(rawProblem)
    if (!parsed.success) {
      invalid.add(model)
      continue
    }
    const problem = parsed.data
    const previous = questions.get(key)
    if (previous && (previous.date !== problem.date || previous.difficulty !== problem.difficulty))
      throw new Error("LiveCodeBench conflicting question definition")
    questions.set(key, { date: problem.date, difficulty: problem.difficulty })
    const group = records.get(model) ?? new Map()
    group.set(key, problem)
    records.set(model, group)
  }
  if (questions.size !== QUESTION_COUNT)
    throw new Error("LiveCodeBench pinned question set changed")
  const payload: LiveCodeBenchPayload = { rows: [], dropped: [] }
  for (const model of feed.models) {
    const problems = records.get(model.model_repr)
    if (invalid.has(model.model_repr) || problems?.size !== QUESTION_COUNT) {
      payload.dropped.push({
        id: model.model_repr,
        reason: "Incomplete or invalid results for the pinned 454-question window",
      })
      continue
    }
    const total = [...problems.values()].reduce((sum, problem) => sum + problem["pass@1"], 0)
    // Match the official table's one-decimal percentage, retaining all question weights.
    payload.rows.push({
      ...model,
      score: Number((total / QUESTION_COUNT).toFixed(1)),
      questions: QUESTION_COUNT,
    })
  }
  if (payload.rows.length === 0) throw new Error("LiveCodeBench returned no complete model results")
  return payload
}

function modelConfiguration(row: LiveCodeBenchRow) {
  const suffix = /__(low|medium|high)$/.exec(row.model_name)
  const labelEffort = /\s*\((Low|Med|Medium|High)\)$/i.exec(row.model_repr)
  const labelLevel = labelEffort
    ? normalizeLevel(/^med$/i.test(labelEffort[1]) ? "medium" : labelEffort[1])
    : null
  const effort = suffix?.[1] ?? labelLevel
  const thinking = /\(Thinking\)$/i.test(row.model_repr)
  const off = row.model_name.endsWith("_nothink")
  const effortConflict =
    (off && (thinking || effort != null)) || (suffix && labelLevel && suffix[1] !== labelLevel)
      ? "LiveCodeBench model id and display label disagree about reasoning effort"
      : null
  // Endpoint aliases are resolved by the benchmark's explicit versioned display identity.
  const alias = ["deepseek-chat", "deepseek-reasoner"].includes(row.model_name)
  const name = row.model_repr.replace(/\s*\((?:Low|Med|Medium|High|Thinking)\)$/i, "")
  return {
    name,
    sourceModelId: alias
      ? name
      : row.model_name.replace(/__(?:low|medium|high)$|_nothink$|_high$/g, ""),
    mode: off ? "off" : effort || thinking ? "on" : "unknown",
    level: effort ?? "unknown",
    effortConflict,
  } as const
}

export class LiveCodeBenchProvider
  extends MetricProvider<LiveCodeBenchRow>
  implements MetricSource<LiveCodeBenchPayload, LiveCodeBenchRow>
{
  readonly name = "liveCodeBench"
  readonly displayName = "LiveCodeBench"
  readonly href = "https://livecodebench.github.io/leaderboard.html"
  readonly abbreviation = "LCB"
  readonly cacheKey = "llm-scores:source:liveCodeBench:codegen:2024-08_2025-05:v1"
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics: MetricReaders<LiveCodeBenchRow> = {
    score: {
      read: (row) => row.score,
      presentation: { label: "Code generation pass@1", unit: "%", format: "percent" },
      note: `${WINDOW}; 454 shared problems; published code-generation pass@1`,
      describe: (row) => ({
        label: this.displayName,
        detail: `${HARNESS}; ${row.questions} identical problems per model; task cost not published; reasoning level ${modelConfiguration(row).level === "unknown" ? "not reported" : modelConfiguration(row).level}`,
      }),
    },
  }
  toMetricRows(payload: LiveCodeBenchPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { name, effortConflict, ...run } = modelConfiguration(row)
      return {
        ...run,
        rawId: row.model_name,
        harness: HARNESS,
        ...(run.mode === "unknown" || run.level === "unknown" || effortConflict != null
          ? { configurationKnown: false as const }
          : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name, creator: null, releaseDate: null },
        effortConflict,
      }
    })
  }
  async fetchPayload(): Promise<LiveCodeBenchPayload> {
    return parseLiveCodeBenchFeed(
      await (await fetchOk(this.displayName, DATA_URL, { timeoutMs: 20_000 })).json(),
    )
  }
}
