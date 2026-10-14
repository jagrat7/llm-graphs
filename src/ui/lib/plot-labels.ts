import type { PlotData, PlotPoint, PlotSeries } from "#/ui/lib/comparison-plot-data"

import { CHART_POINT_LABEL_SIZE } from "#/ui/lib/chart-styles"

/**
 * One annotation per model, pinned to the run's anchor effort: the model name over a
 * small effort tier. Both renderers build their labels from here so a model reads the
 * same whether it has one effort variant or five.
 */
export type SeriesLabel = {
  key: string
  /** Point the label hangs off — `PlotSeries.anchorId`. */
  pointId: string
  name: string
  /** Effort tier shown beneath the name; null when the model exposes no efforts. */
  effort: string | null
  color: string
  /** Every point of the run, so hovering any of them keeps the label lit. */
  ids: Set<string>
}

export const LABEL_NAME_SIZE = CHART_POINT_LABEL_SIZE + 0.5
export const LABEL_EFFORT_SIZE = CHART_POINT_LABEL_SIZE - 1.5
/** Baseline-to-baseline slack between the name and its effort line. */
export const LABEL_LINE_GAP = 1
/** Distance from the anchor marker's edge to the nearest edge of the label block. */
export const LABEL_PIN_GAP = 5
/** Breathing room enforced between two placed label boxes. */
export const LABEL_COLLISION_GAP = 4
/** Average glyph width as a share of the font size — enough to reserve label boxes. */
export const LABEL_WIDTH_RATIO = 0.56

function seriesLabelAt(series: PlotSeries, anchor: PlotPoint): SeriesLabel {
  return {
    key: series.key,
    pointId: anchor.id,
    name: series.label,
    effort: anchor.model.effort === "default" ? null : anchor.model.effort.toUpperCase(),
    color: series.color,
    ids: new Set(series.points.map((point) => point.id)),
  }
}

function anchorOf(series: PlotSeries) {
  return series.points.find((point) => point.id === series.anchorId) ?? series.points[0]
}

export function buildSeriesLabels(data: PlotData): Array<SeriesLabel> {
  return data.series.map((series) => seriesLabelAt(series, anchorOf(series)))
}

/**
 * Fallback anchors for one run: the shared effort tier first, then outwards one effort
 * level at a time, stepping up before down. A renderer walks these when the preferred
 * point has no free space, so a crowded corner labels the neighbouring effort of the
 * same model rather than stacking two names on one dot.
 */
export function seriesLabelCandidates(series: PlotSeries): Array<SeriesLabel> {
  const anchor = anchorOf(series)
  const rest = series.points
    .filter((point) => point.id !== anchor.id)
    .toSorted((left, right) => {
      const leftStep = left.model.effortOrder - anchor.model.effortOrder
      const rightStep = right.model.effortOrder - anchor.model.effortOrder

      return Math.abs(leftStep) - Math.abs(rightStep) || rightStep - leftStep
    })

  return [anchor, ...rest].map((point) => seriesLabelAt(series, point))
}

/** Estimated block size, glyph-ratio based so neither renderer has to measure text. */
export function labelBlockSize(label: SeriesLabel) {
  const nameWidth = label.name.length * LABEL_NAME_SIZE * LABEL_WIDTH_RATIO
  const effortWidth =
    label.effort == null ? 0 : label.effort.length * LABEL_EFFORT_SIZE * LABEL_WIDTH_RATIO

  return {
    width: Math.max(nameWidth, effortWidth),
    height:
      label.effort == null ? LABEL_NAME_SIZE : LABEL_NAME_SIZE + LABEL_LINE_GAP + LABEL_EFFORT_SIZE,
  }
}

export type LabelPosition = { x: number; y: number }

export type LabelBounds = { left: number; top: number; right: number; bottom: number }

type LabelSide = "right" | "left" | "top" | "bottom"

export type PlacedLabel = SeriesLabel & {
  x: number
  nameY: number
  effortY: number
  anchor: "start" | "middle" | "end"
}

/** Sides tried per label; the run's alternating placement picks which order it uses. */
const LABEL_SIDES_TOP: ReadonlyArray<LabelSide> = ["right", "left", "top", "bottom"]
const LABEL_SIDES_BOTTOM: ReadonlyArray<LabelSide> = ["left", "right", "bottom", "top"]
/** Tried in order; the wider gaps only matter once every effort of a run is boxed in. */
const LABEL_GAP_STEPS = [LABEL_PIN_GAP, LABEL_PIN_GAP + 12, LABEL_PIN_GAP + 26]

function overlaps(box: LabelBounds, taken: Array<LabelBounds>) {
  return taken.some(
    (other) =>
      box.left < other.right + LABEL_COLLISION_GAP &&
      box.right > other.left - LABEL_COLLISION_GAP &&
      box.top < other.bottom + LABEL_COLLISION_GAP &&
      box.bottom > other.top - LABEL_COLLISION_GAP,
  )
}

/** Block geometry for one candidate side at `gap` pixels out from the anchor marker. */
function labelBox(
  side: LabelSide,
  anchor: LabelPosition,
  size: { width: number; height: number },
  gap: number,
): LabelBounds {
  if (side === "right" || side === "left") {
    const left = side === "right" ? anchor.x + gap : anchor.x - gap - size.width

    return {
      left,
      right: left + size.width,
      top: anchor.y - size.height / 2,
      bottom: anchor.y + size.height / 2,
    }
  }

  const top = side === "top" ? anchor.y - gap - size.height : anchor.y + gap

  return {
    left: anchor.x - size.width / 2,
    right: anchor.x + size.width / 2,
    top,
    bottom: top + size.height,
  }
}

/**
 * One label per model, pinned beside a point of its run. Candidates are searched effort
 * first: all four sides of every effort at the tight pin gap, then the same sweep further
 * out. A model whose every candidate collides or leaves the plot goes unlabelled — its
 * marker still carries the name in the tooltip and the legend, whereas a name stacked on
 * another model's reads as the wrong model.
 *
 * `markerHalf` is half a marker's box, so labels and other markers keep clear of logos.
 */
export function placeSeriesLabels(
  data: PlotData,
  positions: Map<string, LabelPosition>,
  bounds: LabelBounds,
  markerHalf: (point: PlotPoint) => number,
) {
  const placed: Array<PlacedLabel> = []
  // Markers are seeded as occupied so a name never lands on another model's logo or dot.
  const taken: Array<LabelBounds> = data.points.flatMap((point) => {
    const position = positions.get(point.id)
    if (!position) return []

    const half = markerHalf(point)

    return [
      {
        left: position.x - half,
        right: position.x + half,
        top: position.y - half,
        bottom: position.y + half,
      },
    ]
  })
  const fits = (box: LabelBounds) =>
    box.left >= bounds.left &&
    box.right <= bounds.right &&
    box.top >= bounds.top &&
    box.bottom <= bounds.bottom

  for (const series of data.series) {
    const sides = series.labelPlacement === "top" ? LABEL_SIDES_TOP : LABEL_SIDES_BOTTOM
    const anchors = seriesLabelCandidates(series).flatMap((label) => {
      const anchor = positions.get(label.pointId)
      const point = data.pointById.get(label.pointId)

      return anchor && point
        ? [{ label, anchor, size: labelBlockSize(label), inset: markerHalf(point) }]
        : []
    })
    // Gap is the outer loop, so a label hops every effort level before it drifts outward.
    const chosen = LABEL_GAP_STEPS.flatMap((gap) =>
      anchors.flatMap(({ label, anchor, size, inset }) =>
        sides.map((side) => ({ label, side, box: labelBox(side, anchor, size, gap + inset) })),
      ),
    ).find(({ box }) => fits(box) && !overlaps(box, taken))

    if (!chosen) continue

    taken.push(chosen.box)
    const nameY = chosen.box.top + LABEL_NAME_SIZE

    placed.push({
      ...chosen.label,
      x:
        chosen.side === "right"
          ? chosen.box.left
          : chosen.side === "left"
            ? chosen.box.right
            : (chosen.box.left + chosen.box.right) / 2,
      nameY,
      effortY: nameY + LABEL_LINE_GAP + LABEL_EFFORT_SIZE,
      anchor: chosen.side === "right" ? "start" : chosen.side === "left" ? "end" : "middle",
    })
  }

  return placed
}
