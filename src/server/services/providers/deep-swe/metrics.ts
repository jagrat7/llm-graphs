import type { MetricReaders } from "../provider.types"
import type { DeepSWERow } from "./deep-swe.types"

export const deepsweMetrics: MetricReaders<DeepSWERow> = {
  score: {
    read: (row) =>
      Number.isFinite(row.pass_rate) && row.pass_rate >= 0 && row.pass_rate <= 1
        ? row.pass_rate * 100
        : null,
    note: "DeepSWE v1.1 pass rate",
  },
  costPerTask: {
    read: (row) =>
      row.mean_cost_usd != null && Number.isFinite(row.mean_cost_usd) && row.mean_cost_usd >= 0
        ? row.mean_cost_usd
        : null,
    note: "mean cost per evaluated task",
  },
  durationSeconds: {
    read: (row) =>
      row.mean_duration_seconds != null &&
      Number.isFinite(row.mean_duration_seconds) &&
      row.mean_duration_seconds > 0
        ? row.mean_duration_seconds
        : null,
    note: "mean wall time per evaluated task",
  },
}
