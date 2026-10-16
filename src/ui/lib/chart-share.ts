import type { PlotAxis, PlotData } from "#/ui/lib/comparison-plot-data"
import type { ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

import { APP_NAME } from "#/ui/lib/app-meta"
import { METRIC_CONFIG, metricPresentation } from "#/ui/lib/metrics"
import { vendorLabel } from "#/ui/lib/model-view"

export type PlotSources = Partial<Record<PlotAxis, ProviderName | null>>

/** The vertical metric reads first, as people say it: "Score vs Task cost". */
function titleAxes(data: PlotData) {
  return (["y", "x", "z"] as const).filter((axis) => data.axes.includes(axis))
}

export function shareTitle(data: PlotData) {
  return titleAxes(data)
    .map((axis) => METRIC_CONFIG[data.metrics[axis]!].label)
    .join(" vs ")
}

/** Model count and every source the axes read, so a shared image still says where it came from. */
export function shareSubtitle(data: PlotData, sources: PlotSources, info: ProvidersInfo) {
  const names = [
    ...new Set(
      titleAxes(data).flatMap((axis) => {
        const source = sources[axis]

        return source == null ? [] : [info.displayNames[source]]
      }),
    ),
  ]
  const models = `${data.modelCount} ${data.modelCount === 1 ? "model" : "models"}`

  return names.length > 0 ? `${models} · Sources: ${names.join(", ")}` : models
}

/** `llm-graphs-score-vs-cost.png`: names the comparison, not the moment it was saved. */
export function shareFilename(data: PlotData, extension: "csv" | "png") {
  const slug = APP_NAME.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")
  const metrics = titleAxes(data).map((axis) =>
    data.metrics[axis]!.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
  )

  return `${slug}-${metrics.join("-vs-")}.${extension}`
}

/** Spreadsheets run cells that open with these as formulas. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function textCell(value: string) {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value

  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function columnTitle(axis: PlotAxis, data: PlotData, sources: PlotSources, info: ProvidersInfo) {
  const metric = data.metrics[axis]!
  const source = sources[axis] ?? null
  const { label, unit } = metricPresentation(metric, source, info)
  const title = unit ? `${label} (${unit})` : label

  return source == null ? title : `${title} [${info.displayNames[source]}]`
}

/**
 * The plotted values as CSV: one row per point, grouped by model and ordered by
 * effort. Values stay raw, in the units the headers name, so the file is for
 * analysis rather than a copy of the chart's rounded labels.
 */
export function plotCsv(data: PlotData, sources: PlotSources, info: ProvidersInfo) {
  const configured = data.points.some((point) => point.model.configuration)
  const header = [
    "Model",
    "Vendor",
    "Effort",
    ...(configured ? ["Configuration"] : []),
    ...data.axes.map((axis) => columnTitle(axis, data, sources, info)),
  ]
  const rows = data.series.flatMap((series) =>
    series.points.map((point) => {
      const { model } = point

      return [
        textCell(model.displayName),
        textCell(model.vendor == null ? "" : vendorLabel(model.vendor)),
        textCell(model.effort),
        ...(configured ? [textCell(model.configuration ?? "")] : []),
        ...data.axes.map((axis) => String(point.values[axis])),
      ]
    }),
  )

  return [header.map(textCell), ...rows].map((row) => row.join(",")).join("\r\n")
}
