import type { MetricKey, ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

export const METRICS = ["score", "cost", "price", "speed", "duration"] as const

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
  const fallback = { ...METRIC_CONFIG[metric], format: metric === "score" ? "percent" : "number" }
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

  return sources.find((candidate) => candidate === source) ?? sources[0]
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

  if (metric === "score") {
    const presentation = metricPresentation(metric, source, info)
    const number = value.toLocaleString("en-US", {
      maximumFractionDigits: presentation.format === "hours" && Math.abs(value) < 1 ? 3 : 1,
    })
    return `${number}${presentation.format === "percent" ? "%" : presentation.format === "hours" ? " h" : ""}`
  }

  if (metric === "cost" || metric === "price") {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? 4 : 2,
    })}`
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}k`
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}
