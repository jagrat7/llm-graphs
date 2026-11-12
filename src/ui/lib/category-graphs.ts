import type { AxisState } from "#/ui/components/axis-controls"
import type { ProviderName, ProvidersInfo } from "#/server/api"
import type { GraphSearch } from "./graph-state"

import { metricProviders, type Metric } from "./metrics"

type SourceCategory = ProvidersInfo["sources"][ProviderName]["category"]

export type CategoryGraph = {
  key: string
  label: string
  /** The benchmarks the graph may read its Y axis from. */
  category: SourceCategory
  y: Metric
  x: Metric
}

/** One graph per subject a reader asks "which model is best at…" about, in tab order. */
export const CATEGORY_GRAPHS = [
  { key: "coding", label: "Coding", category: "coding", y: "score", x: "cost" },
  { key: "agents", label: "Automation", category: "agents", y: "score", x: "cost" },
  { key: "reasoning", label: "Puzzles", category: "reasoning", y: "score", x: "cost" },
  { key: "chat", label: "Writing", category: "preference", y: "score", x: "votes" },
  { key: "speed", label: "Speed", category: "market", y: "speed", x: "price" },
] as const satisfies ReadonlyArray<CategoryGraph>

/** Subjects with no benchmark registered yet, shown so a reader knows they are coming. */
export const UPCOMING_CATEGORIES = [
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "speech", label: "Speech to text" },
] as const

/** Every subject the row shows, so each can be given its own mark. */
export type CategoryKey = (typeof CATEGORY_GRAPHS | typeof UPCOMING_CATEGORIES)[number]["key"]

/** Task cost and duration follow the Score benchmark, so only the other axes name a source. */
const FOLLOWS_SCORE: ReadonlyArray<Metric> = ["cost", "duration"]

/**
 * The graph's axes, read from the category's most preferred benchmark that publishes both.
 * Null when none does, so a tab never links to an empty chart.
 */
export function categoryGraphSearch(graph: CategoryGraph, info: ProvidersInfo): GraphSearch | null {
  const source = metricProviders(graph.y, info).find(
    (candidate) =>
      info.sources[candidate].category === graph.category &&
      metricProviders(graph.x, info).includes(candidate),
  )
  if (source == null) return null

  return {
    x: graph.x,
    y: graph.y,
    xSource: FOLLOWS_SCORE.includes(graph.x) ? undefined : source,
    ySource: source,
  }
}

/**
 * The category the chart on screen belongs to: the one whose metric is on Y, read from one of
 * its benchmarks. It holds while the reader changes X or switches to another benchmark of the
 * same category, and is null for a chart no category describes.
 */
export function activeCategoryGraph(axes: AxisState, info: ProvidersInfo): CategoryKey | null {
  const { metric, source } = axes.y
  if (metric == null || source == null) return null

  return (
    CATEGORY_GRAPHS.find(
      (graph) => graph.y === metric && info.sources[source].category === graph.category,
    )?.key ?? null
  )
}
