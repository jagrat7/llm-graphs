import type { MetricKey, ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

export const METRICS = [
  "score",
  "cost",
  "price",
  "speed",
  "duration",
  "inputPrice",
  "outputPrice",
  "context",
  "votes",
  "horizon80",
  "taskScore",
] as const

export type Metric = (typeof METRICS)[number]

export function isMetric(value: string): value is Metric {
  return (METRICS as ReadonlyArray<string>).includes(value)
}

export const METRIC_CONFIG: Record<
  Metric,
  {
    label: string
    shortLabel: string
    unit: string
    dataKey: MetricKey
    format?: "percent" | "number" | "hours" | "currency" | "integer" | "tokens"
  }
> = {
  score: {
    label: "Score",
    shortLabel: "Score",
    unit: "%",
    dataKey: "score",
  },
  cost: {
    label: "Task cost",
    shortLabel: "Task cost $/task",
    unit: "$/task",
    dataKey: "costPerTask",
  },
  price: {
    label: "Token price",
    shortLabel: "Token price $/M",
    unit: "$/M tokens",
    dataKey: "costPerMTokens",
  },
  speed: {
    label: "Output speed",
    shortLabel: "Tokens/s",
    unit: "tokens/s",
    dataKey: "tokensPerSecond",
  },
  duration: {
    label: "Task duration",
    shortLabel: "Duration",
    unit: "s",
    dataKey: "durationSeconds",
  },
  inputPrice: {
    label: "Input token price",
    shortLabel: "Input price $/M",
    unit: "$/M tokens",
    dataKey: "inputPricePerMTokens",
    format: "currency",
  },
  outputPrice: {
    label: "Output token price",
    shortLabel: "Output price $/M",
    unit: "$/M tokens",
    dataKey: "outputPricePerMTokens",
    format: "currency",
  },
  context: {
    label: "Context length",
    shortLabel: "Context tokens",
    unit: "tokens",
    dataKey: "contextTokens",
    format: "tokens",
  },
  votes: {
    label: "Vote count",
    shortLabel: "Arena votes",
    unit: "votes",
    dataKey: "votes",
    format: "integer",
  },
  horizon80: {
    label: "Task horizon (80%)",
    shortLabel: "80% horizon h",
    unit: "h",
    dataKey: "horizon80Hours",
    format: "hours",
  },
  taskScore: {
    label: "Average task score",
    shortLabel: "METR task score",
    unit: "%",
    dataKey: "averageTaskScore",
    format: "percent",
  },
}

export function metricRecord<T>(make: (key: MetricKey) => T): Record<MetricKey, T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every metric key has a UI definition
  return Object.fromEntries(
    METRICS.map((metric) => [METRIC_CONFIG[metric].dataKey, make(METRIC_CONFIG[metric].dataKey)]),
  ) as Record<MetricKey, T>
}

export function metricAxisTitle(metric: Metric, source: ProviderName | null, info: ProvidersInfo) {
  const config = metricPresentation(metric, source, info)
  const sourceNote = source == null ? null : info.notes[source][METRIC_CONFIG[metric].dataKey]

  return `${config.label} · ${config.unit}${sourceNote == null ? "" : ` (${sourceNote})`}`
}

export function metricPresentation(
  metric: Metric,
  source: ProviderName | null,
  info?: ProvidersInfo,
) {
  const fallback = {
    ...METRIC_CONFIG[metric],
    format:
      METRIC_CONFIG[metric].format ??
      (metric === "score"
        ? "percent"
        : metric === "cost" || metric === "price"
          ? "currency"
          : "number"),
  }
  return source == null
    ? fallback
    : (info?.presentation[source]?.[METRIC_CONFIG[metric].dataKey] ?? fallback)
}

export function metricAxisLabel(metric: Metric, source: ProviderName | null, info: ProvidersInfo) {
  const config = metricPresentation(metric, source, info)
  return `${config.label} · ${config.unit}`
}

/** The providers the chart offers for a metric. The first one is the default. */
export function metricProviders(metric: Metric, info: ProvidersInfo) {
  return info.metricProviders[METRIC_CONFIG[metric].dataKey]
}

/** Task cost always describes the Score benchmark; other metrics choose their own source. */
export function resolveSource(
  metric: Metric,
  source: string | undefined,
  info: ProvidersInfo,
  scoreSource?: ProviderName | null,
): ProviderName {
  if (metric === "cost" || metric === "duration")
    return scoreSource ?? info.metricProviders.score[0]

  const sources = metricProviders(metric, info)

  return (
    sources.find((candidate) => candidate === source) ??
    (scoreSource != null && sources.includes(scoreSource) ? scoreSource : sources[0])
  )
}

export function formatMetric(
  value: number | null,
  metric: Metric,
  source: ProviderName | null = null,
  info?: ProvidersInfo,
) {
  if (value == null) return "—"
  if (!Number.isFinite(value)) return "—"

  if (metric === "duration") {
    const totalSeconds = Math.max(0, Math.round(value))

    if (totalSeconds < 60) return `${totalSeconds}s`

    const totalMinutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60

    if (totalSeconds < 3600) {
      return remainingSeconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m ${remainingSeconds}s`
    }

    const hours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60

    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`
  }

  const presentation = metricPresentation(metric, source, info)
  if (presentation.format === "percent" || presentation.format === "hours" || metric === "score") {
    const number = value.toLocaleString("en-US", {
      maximumFractionDigits: presentation.format === "hours" ? (Math.abs(value) < 1 ? 3 : 2) : 1,
    })
    return `${number}${presentation.format === "percent" ? "%" : presentation.format === "hours" ? " h" : ""}`
  }

  if (presentation.format === "currency") {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? 4 : 2,
    })}`
  }

  if (presentation.format === "integer")
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (presentation.format === "tokens")
    return value >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`
      : value >= 1000
        ? `${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
        : value.toLocaleString("en-US", { maximumFractionDigits: 0 })

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}k`
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}
