/** The metric sources. models.dev is the catalog, not a metric source. */
export type ProviderName = "deepswe" | "artificialAnalysis"
export type SourceName = ProviderName | "modelsDev"

export type SourceDefinition<TPayload> = {
  readonly name: SourceName
  readonly cacheKey: string
  readonly refreshWindowMs: number
  fetchPayload(): Promise<TPayload>
}

/** A source that publishes metrics, and says how each one is calculated from its rows. */
export type MetricSource<TPayload, TRow> = SourceDefinition<TPayload> & {
  readonly name: ProviderName
  readonly displayName: string
  readonly metrics: MetricReaders<TRow>
  readMetrics(row: TRow): MetricValues
  /** Splits each row's model id from its reasoning effort, for the aggregator to join. */
  toMetricRows(payload: TPayload): Array<MetricRow>
}

/** A row that failed to parse. It is dropped, and kept here so the aggregator can report it. */
export type DroppedRow = {
  id: string | null
  reason: string
}

export type SourcePayload<TRow> = {
  rows: Array<TRow>
  dropped: Array<DroppedRow>
}

export const METRIC_KEYS = [
  "score",
  "costPerMTokens",
  "tokensPerSecond",
  "durationSeconds",
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

/** A row's metric values. A metric the source doesn't publish is absent; one it lacks is null. */
export type MetricValues = Partial<Record<MetricKey, number | null>>

/** Whether a variant thinks at all. `unknown` means the source doesn't say, not a default. */
export type ReasoningMode = "on" | "off" | "unknown"

/**
 * One metric-source row after its adapter has split effort off the model id. `level` is one of
 * `minimal`…`max`, `unknown`, or a new level word kept as the source spelled it (lowercased).
 */
export type MetricRow = {
  /** The model id with effort split off, as the source spells it. */
  sourceModelId: string
  /** The row's id exactly as the source gave it. */
  rawId: string
  mode: ReasoningMode
  level: string
  metrics: MetricValues
  metadata: { name: string | null; creator: string | null; releaseDate: string | null } | null
  /** Set when the row's own labels contradict each other, which refuses its effort match. */
  effortConflict: string | null
}

export type MetricReader<TRow> = {
  read(row: TRow): number | null
  /** How the value is derived, shown beside the axis title when it isn't what the source states. */
  note?: string
}

/** The metrics a source publishes, and how each is read from one of its rows. */
export type MetricReaders<TRow> = Partial<Record<MetricKey, MetricReader<TRow>>>
