import type { PlotData, PlotPoint } from "#/ui/lib/comparison-plot-data"

import { METRIC_CONFIG } from "#/ui/lib/metrics"

/**
 * Whether the scatter draws a Pareto frontier: Score on one axis against a metric it
 * trades off with — task cost, task duration or output speed. Pairs without Score, such
 * as cost against duration, mostly rise together and leave a frontier of one or two
 * points, so they get none.
 */
export function hasParetoFrontier(data: PlotData) {
  const { x, y } = data.metrics

  if (data.is3D || x == null || y == null) return false

  return (
    (x === "score" || y === "score") &&
    METRIC_CONFIG[x].better != null &&
    METRIC_CONFIG[y].better != null
  )
}

/**
 * The effort variants no other variant beats on both axes, ordered from the best on x
 * to the best on y. It runs over single points rather than whole models, so a model's
 * low effort can sit on the frontier while its high effort does not. Points with the same
 * values on both axes keep only the first.
 */
export function paretoFrontier(data: PlotData): Array<PlotPoint> {
  if (!hasParetoFrontier(data)) return []

  const sign = (axis: "x" | "y") =>
    METRIC_CONFIG[data.metrics[axis]!].better === "higher" ? 1 : -1
  const sx = sign("x")
  const sy = sign("y")
  // With both axes turned into "higher is better", walk from the best x down and keep
  // every point that improves on the best y so far.
  const ordered = data.points.toSorted(
    (left, right) => sx * (right.values.x - left.values.x) || sy * (right.values.y - left.values.y),
  )
  const frontier: Array<PlotPoint> = []
  let bestY = -Infinity

  for (const point of ordered) {
    const y = sy * point.values.y

    if (y > bestY) {
      frontier.push(point)
      bestY = y
    }
  }

  return frontier
}
