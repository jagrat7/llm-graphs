import type { MetricKey, ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

export const METRICS = ["score", "cost", "speed", "duration"] as const

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
    label: "Cost",
    shortLabel: "Cost $/M",
    unit: "$/M tokens",
    dataKey: "costPerMTokens",
  },
  speed: {
    label: "Speed",
    shortLabel: "Tokens/s",
    unit: "tokens/s",
    dataKey: "tokensPerSecond",
  },
  duration: {
    label: "Duration",
    shortLabel: "Duration",
    unit: "s",
    dataKey: "durationSeconds",
  },
}

export function metricAxisTitle(metric: Metric, source: ProviderName | null, info: ProvidersInfo) {
  const config = METRIC_CONFIG[metric]
  const sourceNote = source == null ? null : info.notes[source][config.dataKey]

  return `${config.label} · ${config.unit}${sourceNote == null ? "" : ` (${sourceNote})`}`
}

/** The providers the chart offers for a metric. The first one is the default. */
export function metricProviders(metric: Metric, info: ProvidersInfo) {
  return info.metricProviders[METRIC_CONFIG[metric].dataKey]
}

/** Falls back to the metric's default source, so a stale URL source never sticks. */
export function resolveSource(
  metric: Metric,
  source: string | undefined,
  info: ProvidersInfo,
): ProviderName {
  const sources = metricProviders(metric, info)

  return sources.find((candidate) => candidate === source) ?? sources[0]
}

export function formatMetric(value: number | null, metric: Metric) {
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
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
  }

  if (metric === "cost") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}k`
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
}
