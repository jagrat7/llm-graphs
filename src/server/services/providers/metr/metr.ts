import { MetricProvider } from "../metric-provider"
import { parse } from "yaml"
import { z } from "zod"
import { fetchOk, parseRows, describeMetrics } from "../utils"
import type { MetricReaders, MetricSource, MetricRow } from "../provider.types"
import type { METRPayload, METRRow } from "./metr.types"

const resultSchema = z.object({
  benchmark_name: z.literal("METR-Horizon-v1.1"),
  results: z.record(z.string(), z.unknown()),
})
const rowSchema: z.ZodType<METRRow> = z
  .object({
    id: z.string().min(1),
    release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scaffolds: z
      .array(z.string().min(1).nullable())
      .min(1)
      .transform((items) => items.map((item) => item ?? "unspecified scaffold")),
    metrics: z.object({
      p50_horizon_length: z.object({
        estimate: z.number().nonnegative(),
        ci_low: z.number().nonnegative(),
        ci_high: z.number().nonnegative(),
      }),
    }),
  })
  .transform((row) => ({
    id: row.id,
    release_date: row.release_date,
    scaffolds: row.scaffolds,
    p50: row.metrics.p50_horizon_length,
  }))

/** METR IDs describe its eval harness, not effort. No reasoning settings are invented. */
export function metrModelId(id: string) {
  return id
    .replace(/_inspect$/, "")
    .replaceAll("_", "-")
    .replace(/^claude-(\d(?:-\d)?)-(sonnet|opus|haiku)/, "claude-$2-$1")
    .replace(/^gpt-4-1106$/, "gpt-4-1106-preview")
}

const metrics: MetricReaders<METRRow> = {
  score: {
    // Official dashboard: estimates beyond the 16-hour suite ceiling are unreliable.
    read: (row) =>
      row.p50.estimate <= 16 * 60 &&
      row.p50.ci_low <= row.p50.estimate &&
      row.p50.ci_high >= row.p50.estimate
        ? row.p50.estimate / 60
        : null,
    presentation: { label: "Task horizon (50%)", unit: "h", format: "hours" },
    note: "METR TH1.1; human-expert task difficulty at 50% success, not AI runtime",
    describe: (row) => ({
      label: "METR Time Horizon 1.1 · 50% success",
      detail: `Model + scaffold: ${row.scaffolds.join("; ")}. Reasoning effort not specified in the published data. Estimates above 16 h are unavailable.`,
      interval: { low: row.p50.ci_low / 60, high: row.p50.ci_high / 60 },
    }),
  },
}

export class METRProvider
  extends MetricProvider<METRRow>
  implements MetricSource<METRPayload, METRRow>
{
  readonly name = "metr"
  readonly displayName = "METR"
  readonly href = "https://metr.org/time-horizons/"
  readonly abbreviation = "METR"
  readonly cacheKey = "llm-scores:source:metr:th1.1:v2"
  readonly refreshWindowMs = 6 * 60 * 60 * 1000
  readonly metrics = metrics
  toMetricRows(payload: METRPayload): Array<MetricRow> {
    return payload.rows.map((row) => ({
      sourceModelId: metrModelId(row.id),
      rawId: row.id,
      mode: "unknown",
      level: "unknown",
      effortConflict: null,
      configurationKnown: false,
      metrics: this.readMetrics(row),
      measurements: describeMetrics(this.metrics, row),
      metadata: { name: null, creator: null, releaseDate: row.release_date },
    }))
  }
  async fetchPayload(): Promise<METRPayload> {
    const response = await fetchOk(
      this.displayName,
      "https://metr.org/assets/benchmark_results_1_1.yaml",
      { timeoutMs: 20_000 },
    )
    const data = resultSchema.parse(parse(await response.text(), { maxAliasCount: 0 }))
    return parseRows(
      this.displayName,
      Object.entries(data.results).map(([id, value]) => ({
        ...(value != null && typeof value === "object" ? value : {}),
        id,
      })),
      rowSchema,
      "id",
    )
  }
}
