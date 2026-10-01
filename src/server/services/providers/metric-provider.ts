import { METRIC_KEYS, type MetricReaders, type SourcePayload } from "./provider.types"
import { readMetrics } from "./utils"

/** Common metric validation: a new adapter only declares readers and its source-specific parser. */
export abstract class MetricProvider<TRow> {
  abstract readonly displayName: string
  abstract readonly metrics: MetricReaders<TRow>
  readMetrics(row: TRow) {
    return readMetrics(this.metrics, row)
  }
  validatePayload(payload: SourcePayload<TRow>) {
    const populated = new Set(
      payload.rows.flatMap((row) => {
        const values = this.readMetrics(row)
        return METRIC_KEYS.filter((key) => values[key] != null)
      }),
    )
    const empty = METRIC_KEYS.filter((key) => this.metrics[key] && !populated.has(key))
    if (empty.length > 0)
      throw new Error(`${this.displayName} has no valid measurements for: ${empty.join(", ")}`)
  }
}
