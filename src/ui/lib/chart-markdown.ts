import type { ModelSnapshot, ProvidersInfo } from "#/server/api"
import type { GraphSearch } from "#/ui/lib/graph-state"

import { buildPlotData, plotQuality } from "#/ui/lib/comparison-plot-data"
import { comparisonModels } from "#/ui/lib/comparison-view"
import { AXIS_SOURCE_KEY, axisSettings } from "#/ui/lib/graph-state"
import { llmsTxt } from "#/ui/lib/llms-txt"
import { isMetric, metricAxisLabel } from "#/ui/lib/metrics"

const AXIS_NAMES = { x: "Horizontal axis", y: "Vertical axis", z: "Depth axis" } as const

/**
 * Whether a request would rather read markdown than HTML. Agents that want it list
 * `text/markdown` at least as high as HTML (Claude Code ties them); browsers never list it.
 * HTML takes its weight from a wildcard range when not named, as HTTP ranks them.
 */
export function prefersMarkdown(accept: string | null) {
  const weights = new Map<string, number>()
  for (const range of (accept ?? "").split(",")) {
    const [type = "", ...params] = range.split(";").map((part) => part.trim().toLowerCase())
    const quality = params.find((param) => param.startsWith("q="))
    weights.set(type, quality == null ? 1 : Number(quality.slice(2)))
  }
  const markdown = weights.get("text/markdown") ?? 0
  const html = weights.get("text/html") ?? weights.get("text/*") ?? weights.get("*/*") ?? 0

  return markdown > 0 && markdown >= html
}

/**
 * What a chart link shows, for an agent reading it in place of the page: each axis and its source,
 * the models drawn, whether there is anything to compare, and any part of the link the chart
 * ignored. The guide to changing it follows.
 */
export function chartMarkdown(
  info: ProvidersInfo,
  snapshot: ModelSnapshot,
  search: GraphSearch & { models?: Array<string> },
  params: URLSearchParams,
  origin: string,
) {
  const axes = axisSettings(search, info)
  const notes: Array<string> = []

  const axisLines = (["y", "x", "z"] as const).flatMap((axis) => {
    const { metric, source } = axes[axis]
    const raw = params.get(axis)
    if (raw != null && !isMetric(raw))
      notes.push(
        `\`${axis}=${raw}\` isn't a metric, so the chart ${metric == null ? "has no such axis" : `uses \`${metric}\``}.`,
      )
    if (metric == null || source == null) return []

    const sourceKey = AXIS_SOURCE_KEY[axis]
    const rawSource = params.get(sourceKey)
    const followsScore = metric === "cost" || metric === "duration"
    if (rawSource != null && (followsScore || rawSource !== source))
      notes.push(
        followsScore
          ? `\`${sourceKey}\` is ignored: ${metric} always reads the Score axis's benchmark.`
          : `\`${sourceKey}=${rawSource}\` isn't a source of \`${metric}\`, so the chart reads ${info.displayNames[source]} instead.`,
      )
    const from = followsScore
      ? `${info.displayNames[source]}, the Score axis's benchmark`
      : `${info.displayNames[source]} (\`${sourceKey}=${source}\`)`

    return [
      `- ${AXIS_NAMES[axis]}, \`${axis}=${metric}\`: ${metricAxisLabel(metric, source, info)} from ${from}`,
    ]
  })

  const { models, defaultModels } = comparisonModels(snapshot, info, search, {
    hiddenProviders: [],
  })
  const picked = search.models ?? defaultModels
  const names = new Map(snapshot.entries.map((entry) => [entry.id, entry.name]))
  const label = (id: string) => `${names.get(id)} (\`${id}\`)`
  const drawable = new Set(models.map((model) => model.model))
  const drawn = picked.filter((id) => drawable.has(id))
  const unknown = picked.filter((id) => !names.has(id))
  const missing = picked.filter((id) => names.has(id) && !drawable.has(id))

  if (unknown.length > 0)
    notes.push(`Not model ids, so left out: ${unknown.map((id) => `\`models=${id}\``).join(", ")}.`)
  if (missing.length > 0)
    notes.push(
      `Picked but not drawn, with no values on every axis here: ${missing.map(label).join(", ")}.`,
    )

  const quality = plotQuality(
    buildPlotData(
      models.filter((model) => drawn.includes(model.model)),
      search,
    ),
  )

  return llmsTxt(info, snapshot, origin, [
    "## This link",
    "",
    `A ${search.z == null ? "2D" : "3D"} chart:`,
    "",
    ...axisLines,
    search.models == null
      ? `- Models, the site's default picks since the link names none: ${drawn.map(label).join(", ") || "none"}. A reader with saved picks sees those instead, so add \`models\` to pin what the link shows.`
      : `- Models, picked by the link: ${drawn.map(label).join(", ") || "none"}`,
    "",
    quality.meaningful
      ? "The chart compares these models. To change it, edit the link as described below."
      : "The chart has nothing to compare. It needs at least two models with different values on every axis. Pick models that have data from these sources, or change the axes.",
    ...(notes.length > 0 ? ["", ...notes.map((note) => `- ${note}`)] : []),
    "",
  ])
}
