import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import type {
  MetricReaders,
  MetricRow,
  MetricSource,
  ProviderName,
  SourcePayload,
} from "../provider.types"
import { describeMetrics, fetchOk, normalizeLevel, parseRows } from "../utils"

const optionalNumber = z
  .number()
  .finite()
  .nonnegative()
  .nullish()
  .transform((value) => value ?? null)
const label = z.object({ label: z.string().trim().min(1) })
const rowSchema = z.object({
  id: z.string().min(1),
  leaderboard_id: z.string().min(1),
  status: z.literal("display").transform((value): string => value),
  n_trials: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((value) => value ?? null),
  updated_at: z.string(),
  metadata: z.object({
    model_display: label,
    model_org: label,
    agent_display: label,
    agent_org: label,
    reasoning_effort: z
      .string()
      .nullish()
      .transform((value) => value?.trim() || null),
    date: z.iso
      .date()
      .nullish()
      .transform((value) => value ?? null),
    model_release_date: z.iso
      .date()
      .nullish()
      .transform((value) => value ?? null),
  }),
  metrics: z.object({
    accuracy: z.number().finite().min(0).max(100),
    n_trials: optionalNumber,
    tasks: optionalNumber,
    total_cost_usd: optionalNumber,
    avg_trial_duration_sec: optionalNumber,
    accuracy_ci95_half_width: optionalNumber,
    accuracy_stderr: optionalNumber,
    display_cost: z
      .string()
      .nullish()
      .transform((value) => value ?? ""),
    display_total_cost_usd: z
      .string()
      .nullish()
      .transform((value) => value ?? ""),
  }),
})
export type HarborRow = z.infer<typeof rowSchema>
export type HarborPayload = SourcePayload<HarborRow>

type Leaderboard = {
  name: ProviderName
  displayName: string
  href: string
  abbreviation: string
  package: string
  release: string
  dataset: string
  trialField: "n_trials" | "tasks"
  duration?: true
  /** Owner-confirmed incomplete runs; labels alone cannot establish repaired cost coverage. */
  incompleteCostRuns?: ReadonlyArray<string>
  url?: string
}
const readerUrl = "https://ofhuhcpkvzjlejydnvyd.supabase.co/functions/v1/leaderboard-read"

/** Shared first-party Harbor protocol; each provider pins its own benchmark/dataset. */
export class HarborProvider
  extends MetricProvider<HarborRow>
  implements MetricSource<HarborPayload, HarborRow>
{
  readonly name: ProviderName
  readonly displayName: string
  readonly href: string
  readonly abbreviation: string
  readonly cacheKey: string
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<HarborRow>

  constructor(private readonly leaderboard: Leaderboard) {
    super()
    this.name = leaderboard.name
    this.displayName = leaderboard.displayName
    this.href = leaderboard.href
    this.abbreviation = leaderboard.abbreviation
    this.cacheKey = `llm-scores:source:${this.name}:${leaderboard.release}:v2`
    this.metrics = {
      score: {
        read: (row) => row.metrics.accuracy,
        presentation: { label: "Task success", unit: "%", format: "percent" },
        note: `${this.displayName}; task success, native percent`,
        describe: (row) => {
          const half = row.metrics.accuracy_ci95_half_width
          const stderr = row.metrics.accuracy_stderr
          return {
            ...this.describe(row),
            ...(half != null
              ? {
                  interval: {
                    low: Math.max(0, row.metrics.accuracy - half),
                    high: Math.min(100, row.metrics.accuracy + half),
                  },
                  detail: `${this.detail(row)}; 95% confidence interval`,
                }
              : stderr != null
                ? {
                    detail: `${this.detail(row)}; standard error ${stderr.toFixed(2)} percentage points`,
                  }
                : {}),
          }
        },
      },
      costPerTask: {
        read: (row) => {
          const count = this.trials(row)
          return count != null && !this.partialCost(row) && row.metrics.total_cost_usd != null
            ? row.metrics.total_cost_usd / count
            : null
        },
        note: `${this.displayName}; total evaluation cost / trials, same model and agent`,
        describe: (row) => this.describe(row),
      },
      ...(leaderboard.duration
        ? {
            durationSeconds: {
              read: (row: HarborRow) => row.metrics.avg_trial_duration_sec,
              note: `${this.displayName}; mean wall-clock seconds / trial, same model and agent`,
              describe: (row: HarborRow) => this.describe(row),
            },
          }
        : {}),
    }
  }

  private trials(row: HarborRow) {
    const count = row.metrics[this.leaderboard.trialField]
    return count != null && Number.isInteger(count) && count > 0 && count === row.n_trials
      ? count
      : null
  }

  private partialCost(row: HarborRow) {
    const labels = `${row.metrics.display_cost} ${row.metrics.display_total_cost_usd}`
    return (
      this.leaderboard.incompleteCostRuns?.includes(row.id) === true ||
      /partial|incomplete|missing/i.test(labels) ||
      [...labels.matchAll(/(\d+)\s*\/\s*(\d+)/g)].some(
        (match) => Number(match[1]) !== Number(match[2]) || Number(match[2]) !== row.n_trials,
      )
    )
  }

  private detail(row: HarborRow) {
    const agent = `${row.metadata.agent_org.label} ${row.metadata.agent_display.label}`
    const count = this.trials(row)
    return `${agent}; ${count ?? "unconfirmed"} trials${this.partialCost(row) ? "; cost coverage incomplete" : ""}`
  }

  private describe(row: HarborRow) {
    return { label: this.displayName, detail: this.detail(row), updatedAt: row.updated_at }
  }

  toMetricRows(payload: HarborPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const creator = row.metadata.model_org.label
      const publishedName = row.metadata.model_display.label
      const name =
        creator === "Anthropic" && !/^Claude\b/i.test(publishedName)
          ? `Claude ${publishedName}`
          : publishedName
      const effort = row.metadata.reasoning_effort
      const off = effort != null && /^(none|off)$/i.test(effort)
      return {
        sourceModelId: name.toLowerCase().replaceAll(/[\s.]+/g, "-"),
        rawId: row.id,
        mode: effort == null ? "unknown" : off ? "off" : "on",
        level: effort == null || off ? "unknown" : normalizeLevel(effort),
        configuration: `${row.metadata.agent_org.label} ${row.metadata.agent_display.label}`,
        ...(effort == null ? { configurationKnown: false as const } : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: {
          name,
          creator,
          releaseDate: row.metadata.model_release_date ?? row.metadata.date,
        },
        effortConflict: null,
      }
    })
  }

  parsePayload(raw: unknown): HarborPayload {
    const root = z
      .object({
        leaderboard: z.object({
          id: z.string(),
          package: z.literal(this.leaderboard.package),
          name: z.literal(this.leaderboard.release),
          dataset_version_ids: z.array(z.string()),
        }),
        rows: z.array(z.unknown()),
      })
      .parse(raw)
    if (
      root.leaderboard.dataset_version_ids.length !== 1 ||
      root.leaderboard.dataset_version_ids[0] !== this.leaderboard.dataset
    )
      throw new Error(`${this.displayName} dataset changed; refusing to mix benchmark versions`)
    return parseRows(
      this.displayName,
      root.rows.filter(
        (row) => row != null && typeof row === "object" && Reflect.get(row, "status") === "display",
      ),
      rowSchema.refine(
        (row) => row.leaderboard_id === root.leaderboard.id,
        "Row belongs to another leaderboard",
      ),
      "id",
    )
  }

  async fetchPayload(): Promise<HarborPayload> {
    const response = await fetchOk(this.displayName, this.leaderboard.url ?? readerUrl, {
      timeoutMs: 20_000,
      ...(this.leaderboard.url
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              package: this.leaderboard.package,
              name: this.leaderboard.release,
            }),
          }),
    })
    return this.parsePayload(await response.json())
  }
}
