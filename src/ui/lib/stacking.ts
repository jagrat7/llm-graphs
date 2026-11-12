import type { PlotData, PlotSeries } from "#/ui/lib/comparison-plot-data"

/**
 * A metric that is fixed per model — token price is the usual one — gives every effort
 * of a model the same position on that axis, so each run collapses into a vertical (or
 * horizontal) stack of unlabelled markers. A scatter has nothing to say along that axis
 * within a model, so the comparison reads better as one group of bars per model.
 *
 * Returns the axis most multi-effort runs stack on, otherwise null. A run flat on both
 * axes sits on one spot either way, so it counts towards neither.
 */
export function stackedAxis(data: PlotData): "x" | "y" | null {
  if (data.is3D) return null

  const runs = data.series.filter(
    (series) => series.points.length > 1 && !(isFlat(series, "x") && isFlat(series, "y")),
  )

  if (runs.length === 0) return null

  const stackShare = (axis: "x" | "y") =>
    runs.filter((series) => isFlat(series, axis)).length / runs.length

  const x = stackShare("x")
  const y = stackShare("y")

  // An even split has no dominant direction, and the scatter shows both halves honestly.
  if (x >= 0.5 && x > y) return "x"
  if (y >= 0.5 && y > x) return "y"

  return null
}

export function isFlat(series: PlotSeries, axis: "x" | "y") {
  const first = series.points[0].values[axis]

  return series.points.every((point) => point.values[axis] === first)
}

type Span = { min: number; max: number }

/** One group of bars per model, with its value on the flat axis. */
export type BarGroup = {
  series: PlotSeries
  /**
   * The model's value on the flat axis, e.g. its token price. Only most models need be
   * flat for the bar view, so a model whose efforts differ keeps its full span here.
   */
  fixed: Span
}

function spanOf(values: Array<number>): Span {
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * Groups ordered along the flat metric — the axis the reader picked — so reading left to
 * right still walks that axis, ties broken by the best result on the other one.
 */
export function barGroups(data: PlotData, flat: "x" | "y"): Array<BarGroup> {
  const spread = flat === "x" ? "y" : "x"

  return data.series
    .map((series) => ({
      series,
      fixed: spanOf(series.points.map((point) => point.values[flat])),
      best: Math.max(...series.points.map((point) => point.values[spread])),
    }))
    .toSorted(
      (left, right) =>
        left.fixed.min - right.fixed.min ||
        left.fixed.max - right.fixed.max ||
        right.best - left.best,
    )
    .map(({ series, fixed }) => ({ series, fixed }))
}
