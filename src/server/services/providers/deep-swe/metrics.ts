import type { DeepSWERow, MetricReaders } from "../provider.types"

export const deepsweMetrics: MetricReaders<DeepSWERow> = {
  score: { read: (row) => row.pass_rate * 100 },
  costPerMTokens: {
    read: (row) => {
      const tokens = (row.mean_input_tokens ?? 0) + (row.mean_output_tokens ?? 0)
      return row.mean_cost_usd != null && tokens > 0
        ? (row.mean_cost_usd / tokens) * 1_000_000
        : null
    },
    note: "observed input/output mix",
  },
  durationSeconds: { read: (row) => row.mean_duration_seconds },
}
