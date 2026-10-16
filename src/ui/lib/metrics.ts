import type { AxisScale } from "#/ui/lib/comparison-plot-data"
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
    /**
     * Which end of the axis a reader wants, for metrics that trade off against Score.
     * Only metrics with a direction take part in the Pareto frontier.
     */
    better?: "higher" | "lower"
    /**
     * A ratio-scale quantity, where "5× cheaper" says more than "$0.40 cheaper". Only
     * these axes may switch to log; see `axisScale`. Scores and ratings stay linear.
     */
    ratio?: true
  }
> = {
  score: {
    label: "Score",
    shortLabel: "Score",
    unit: "%",
    dataKey: "score",
    better: "higher",
  },
  cost: {
    label: "Task cost",
    shortLabel: "Task cost $/task",
    unit: "$/task",
    dataKey: "costPerTask",
    better: "lower",
    ratio: true,
  },
  price: {
    label: "Token price",
    shortLabel: "Token price $/M",
    unit: "$/M tokens",
    dataKey: "costPerMTokens",
    ratio: true,
  },
  speed: {
    label: "Output speed",
    shortLabel: "Tokens/s",
    unit: "tokens/s",
    dataKey: "tokensPerSecond",
    better: "higher",
    ratio: true,
  },
  duration: {
    label: "Task duration",
    shortLabel: "Duration",
    unit: "s",
    dataKey: "durationSeconds",
    better: "lower",
    ratio: true,
  },
  inputPrice: {
    label: "Input token price",
    shortLabel: "Input price $/M",
    unit: "$/M tokens",
    dataKey: "inputPricePerMTokens",
    ratio: true,
    format: "currency",
  },
  outputPrice: {
    label: "Output token price",
    shortLabel: "Output price $/M",
    unit: "$/M tokens",
    dataKey: "outputPricePerMTokens",
    ratio: true,
    format: "currency",
  },
  context: {
    label: "Context length",
    shortLabel: "Context tokens",
    unit: "tokens",
    dataKey: "contextTokens",
    ratio: true,
    format: "tokens",
  },
  votes: {
    label: "Vote count",
    shortLabel: "Arena votes",
    unit: "votes",
    dataKey: "votes",
    ratio: true,
    format: "integer",
  },
  horizon80: {
    label: "Task horizon (80%)",
    shortLabel: "80% horizon h",
    unit: "h",
    dataKey: "horizon80Hours",
    ratio: true,
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

/**
 * Whether a metric, as this source reports it, is a ratio-scale quantity that may go
 * log. A source can turn a plain metric into one: METR's score is a task horizon in hours.
 */
export function isRatioMetric(metric: Metric, source: ProviderName | null, info: ProvidersInfo) {
  return (
    METRIC_CONFIG[metric].ratio === true ||
    metricPresentation(metric, source, info).format === "hours"
  )
}

/** Units as an axis has room for them; the full unit stays in `metricAxisTitle`. */
const AXIS_UNITS: Record<string, string> = {
  "$/M tokens": "$/M",
  "tokens/s": "tok/s",
}

/**
 * The short axis caption: the metric's name with a compact unit in parentheses —
 * "Token price ($/M)" rather than "Token price · $/M tokens". A unit the name already
 * says ("Vote count", votes) is dropped, and a name that already ends in a qualifier
 * shares its parentheses: "Task horizon (80%, h)". Durations get no unit at all. A log
 * axis says so in the same parentheses: "Token price ($/M, log scale)".
 */
export function metricAxisLabel(
  metric: Metric,
  source: ProviderName | null,
  info: ProvidersInfo,
  scale: AxisScale = "linear",
) {
  const { label, unit } = metricPresentation(metric, source, info)
  const compact = AXIS_UNITS[unit] ?? unit
  // Whole words only, singular or plural, so "h" or "s" never matches inside a name.
  const named =
    /^[a-z]{3,}$/i.test(unit) && new RegExp(`\\b${unit.replace(/s$/i, "")}s?\\b`, "i").test(label)
  const notes = [
    // Duration ticks carry their own units ("8m 20s"), so "(s)" would only contradict them.
    ...(metric === "duration" || !compact || named ? [] : [compact]),
    ...(scale === "log" ? ["log scale"] : []),
  ]

  if (notes.length === 0) return label

  const qualifier = /^(.*) \(([^()]*)\)$/.exec(label)

  return qualifier
    ? `${qualifier[1]} (${[qualifier[2], ...notes].join(", ")})`
    : `${label} (${notes.join(", ")})`
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
