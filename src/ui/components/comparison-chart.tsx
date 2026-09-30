import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridColumns, GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { motion } from "motion/react"
import { useEffect, useId, useMemo, useState } from "react"

import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"
import type { Model } from "#/ui/lib/model-view"
import type { PlotData, PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { SeriesLabel } from "#/ui/lib/plot-labels"

import { DataState } from "#/ui/components/data-state"
import { PointDetails } from "#/ui/components/point-details"
import {
  CHART_ACTIVE_SCALE,
  CHART_AXIS_TITLE_SIZE,
  CHART_EASE,
  CHART_GRID_MINOR_OPACITY,
  CHART_GRID_OPACITY,
  CHART_TICK_SIZE,
  CHART_TOOLTIP_CLASS,
  CHART_TOOLTIP_GAP,
  CHART_TOOLTIP_WIDTH,
} from "#/ui/lib/chart-styles"
import { buildPlotData, describePlot, padDomain } from "#/ui/lib/comparison-plot-data"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { formatMetric, metricAxisTitle, METRIC_CONFIG } from "#/ui/lib/metrics"
import {
  labelBlockSize,
  LABEL_COLLISION_GAP,
  LABEL_EFFORT_SIZE,
  LABEL_LINE_GAP,
  LABEL_NAME_SIZE,
  LABEL_PIN_GAP,
  seriesLabelCandidates,
} from "#/ui/lib/plot-labels"
import { useReducedMotion } from "#/ui/lib/use-reduced-motion"

type Position = { x: number; y: number }

type LabelSide = "right" | "left" | "top" | "bottom"

type PlacedLabel = SeriesLabel & {
  x: number
  nameY: number
  effortY: number
  anchor: "start" | "middle" | "end"
}

const MARGIN = { top: 26, right: 30, bottom: 54, left: 74 }
const DOMAIN_PAD = 0.08
const POINT_RADIUS = 5
const ACTIVE_POINT_RADIUS = POINT_RADIUS * CHART_ACTIVE_SCALE
/** Logo markers are square boxes, sized so a vendor's mark stays legible. */
const LOGO_SIZE = 16
const ACTIVE_LOGO_SIZE = 22
/** Pointer distance at which the nearest point stops being considered hovered. */
const HOVER_RADIUS = 110
const LABEL_MIN_WIDTH = 720
/** Sides tried per label; the run's alternating placement picks which order it uses. */
const LABEL_SIDES_TOP: ReadonlyArray<LabelSide> = ["right", "left", "top", "bottom"]
const LABEL_SIDES_BOTTOM: ReadonlyArray<LabelSide> = ["left", "right", "bottom", "top"]
/** Tried in order; the wider gaps only matter once every effort of a run is boxed in. */
const LABEL_GAP_STEPS = [LABEL_PIN_GAP, LABEL_PIN_GAP + 12, LABEL_PIN_GAP + 26]
const AXIS_TICK_PROPS = {
  fill: "var(--muted-foreground)",
  fontSize: CHART_TICK_SIZE,
  fontFamily: "inherit",
} as const
const STAGGER_STEP = 0.012
const STAGGER_MAX = 0.28
const ENTRANCE_WINDOW = 900
/** Minimum pixels between ticks — larger spacing means fewer, calmer axis markers. */
const TICK_SPACING_X = 220
const TICK_SPACING_Y = 120

/** Half the marker's box: a logo's square, or a fallback circle's radius. */
function markerHalf(point: PlotPoint, active = false) {
  if (point.logoUrl == null) return active ? ACTIVE_POINT_RADIUS : POINT_RADIUS

  return (active ? ACTIVE_LOGO_SIZE : LOGO_SIZE) / 2
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function seriesPath(points: Array<PlotPoint>, positions: Map<string, Position>) {
  return points
    .map((point, index) => {
      const position = positions.get(point.id)

      if (!position) return ""

      return `${index === 0 ? "M" : "L"}${position.x.toFixed(2)} ${position.y.toFixed(2)}`
    })
    .join(" ")
}

type LabelBox = { left: number; right: number; top: number; bottom: number }

function overlaps(box: LabelBox, taken: Array<LabelBox>) {
  return taken.some(
    (other) =>
      box.left < other.right + LABEL_COLLISION_GAP &&
      box.right > other.left - LABEL_COLLISION_GAP &&
      box.top < other.bottom + LABEL_COLLISION_GAP &&
      box.bottom > other.top - LABEL_COLLISION_GAP,
  )
}

/** Block geometry for one candidate side at `gap` pixels out from the anchor dot. */
function labelBox(
  side: LabelSide,
  anchor: Position,
  size: { width: number; height: number },
  gap: number,
): LabelBox {
  const half = size.width / 2

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

  return { left: anchor.x - half, right: anchor.x + half, top, bottom: top + size.height }
}

/**
 * One label per model, pinned beside a point of its run. Candidates are searched effort
 * first: all four sides of every effort at the tight pin gap, then the same sweep further
 * out for models with only one effort to give. Every model keeps a label — the last resort
 * is the first candidate, overlap and all — since a nameless dot reads as a bug.
 */
function placeLabels(
  data: PlotData,
  positions: Map<string, Position>,
  innerWidth: number,
  innerHeight: number,
) {
  const placed: Array<PlacedLabel> = []

  if (innerWidth < LABEL_MIN_WIDTH) return placed

  // Markers are seeded as occupied so a name never lands on another model's logo or dot.
  const taken: Array<LabelBox> = data.points.flatMap((point) => {
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

  for (const series of data.series) {
    const sides = series.labelPlacement === "top" ? LABEL_SIDES_TOP : LABEL_SIDES_BOTTOM
    const anchors = seriesLabelCandidates(series).flatMap((label) => {
      const anchor = positions.get(label.pointId)
      const point = data.pointById.get(label.pointId)

      // The pin gap is measured from a dot's edge, so a wider logo pushes its label out too.
      return anchor && point
        ? [{ label, anchor, size: labelBlockSize(label), inset: markerHalf(point) - POINT_RADIUS }]
        : []
    })
    // Gap is the outer loop, so a label hops every effort level before it drifts outward.
    const candidates = LABEL_GAP_STEPS.flatMap((gap) =>
      anchors.flatMap(({ label, anchor, size, inset }) =>
        sides.map((side) => ({ label, side, box: labelBox(side, anchor, size, gap + inset) })),
      ),
    )
    const fits = ({ box }: { box: LabelBox }) =>
      box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
    const chosen =
      candidates.find((candidate) => fits(candidate) && !overlaps(candidate.box, taken)) ??
      candidates.find(fits) ??
      candidates[0]

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

export function ComparisonChart({
  models,
  sources,
  xMetric,
  yMetric,
}: {
  models: Array<Model>
  sources: Record<"x" | "y", ProviderName | null>
  xMetric: Metric
  yMetric: Metric
}) {
  const info = useProvidersInfo()
  const { parentRef, width, height } = useParentSize({
    debounceTime: 24,
    initialSize: { width: 1200, height: 640 },
  })
  const reduceMotion = useReducedMotion()
  const maskPrefix = `logo-${useId().replaceAll(/[^a-zA-Z0-9]/g, "")}`
  const [activeId, setActiveId] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  const data = useMemo(
    () => buildPlotData(models, { x: xMetric, y: yMetric }),
    [models, xMetric, yMetric],
  )

  // Held until the staggered entrance has played out, so later moves start immediately.
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntered(true), ENTRANCE_WINDOW)

    return () => window.clearTimeout(timeout)
  }, [])

  const layout = useMemo(() => {
    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
    const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
    const xDomain = padDomain(data.domains.x, DOMAIN_PAD)
    const yDomain = padDomain(data.domains.y, DOMAIN_PAD)
    const xScale = scaleLinear<number>({
      domain: [xDomain.min, xDomain.max],
      range: [0, innerWidth],
      nice: true,
    })
    const yScale = scaleLinear<number>({
      domain: [yDomain.min, yDomain.max],
      range: [innerHeight, 0],
      nice: true,
    })
    const positions = new Map<string, Position>()

    for (const point of data.points) {
      positions.set(point.id, { x: xScale(point.values.x), y: yScale(point.values.y) })
    }

    return {
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      xTicks: Math.max(2, Math.round(innerWidth / TICK_SPACING_X)),
      yTicks: Math.max(2, Math.round(innerHeight / TICK_SPACING_Y)),
      positions,
      paths: data.series.map((series) => ({
        key: series.key,
        color: series.color,
        ids: new Set(series.points.map((point) => point.id)),
        d: seriesPath(series.points, positions),
      })),
      labels: placeLabels(data, positions, innerWidth, innerHeight),
    }
  }, [data, height, width])

  // One mask per vendor logo, shared by every point of that vendor.
  const logoMasks = useMemo(() => {
    const urls = new Set(data.points.flatMap((point) => (point.logoUrl ? [point.logoUrl] : [])))

    return new Map(Array.from(urls, (url, index) => [url, `${maskPrefix}-${index}`]))
  }, [data, maskPrefix])
  const activePoint = activeId == null ? null : (data.pointById.get(activeId) ?? null)
  const activePosition = activeId == null ? null : (layout.positions.get(activeId) ?? null)
  const ready = layout.innerWidth > 0 && layout.innerHeight > 0
  const pinTooltip = width < 640
  const transition = { duration: reduceMotion ? 0 : 0.42, ease: CHART_EASE }

  function nearestPoint(event: React.PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - bounds.left
    const pointerY = event.clientY - bounds.top
    let closestId: string | null = null
    let closestDistance = HOVER_RADIUS * HOVER_RADIUS

    for (const point of data.points) {
      const position = layout.positions.get(point.id)

      if (!position) continue

      const half = markerHalf(point, point.id === activeId)
      const inside =
        Math.abs(position.x - pointerX) <= half && Math.abs(position.y - pointerY) <= half
      // A pointer inside a marker's box always picks that marker over a closer centre outside.
      const distance =
        (position.x - pointerX) ** 2 +
        (position.y - pointerY) ** 2 -
        (inside ? HOVER_RADIUS ** 2 : 0)

      if (distance < closestDistance) {
        closestDistance = distance
        closestId = point.id
      }
    }

    return closestId
  }

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const nextId = nearestPoint(event)

    if (nextId !== activeId) setActiveId(nextId)
  }

  function handlePointKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key)
        ? -1
        : 0

    if (direction === 0) return

    event.preventDefault()
    const nextIndex = (index + direction + data.points.length) % data.points.length

    document.querySelector<HTMLButtonElement>(`[data-chart-keyboard-point="${nextIndex}"]`)?.focus()
  }

  if (data.points.length === 0) {
    return <DataState className={CHART_HEIGHT_CLASS} title="No models have both selected metrics" />
  }

  return (
    <div
      ref={parentRef}
      className={`relative w-full ${CHART_HEIGHT_CLASS}`}
      data-chart-frame="loaded"
    >
      <span role="img" aria-label={describePlot(data)} className="sr-only" />

      {ready ? (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            {Array.from(logoMasks, ([url, id]) => (
              // Alpha, not luminance: the logo is a dark shape on a transparent field.
              <mask
                key={id}
                id={id}
                maskContentUnits="objectBoundingBox"
                style={{ maskType: "alpha" }}
              >
                <image href={url} width={1} height={1} preserveAspectRatio="xMidYMid meet" />
              </mask>
            ))}
          </defs>
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows
              scale={layout.yScale}
              width={layout.innerWidth}
              numTicks={layout.yTicks}
              stroke="var(--border)"
              strokeOpacity={CHART_GRID_OPACITY}
            />
            <GridColumns
              scale={layout.xScale}
              height={layout.innerHeight}
              numTicks={layout.xTicks}
              stroke="var(--border)"
              strokeOpacity={CHART_GRID_MINOR_OPACITY}
            />

            {activePosition ? (
              <g className="pointer-events-none" aria-hidden="true">
                <line
                  x1={0}
                  x2={activePosition.x}
                  y1={activePosition.y}
                  y2={activePosition.y}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.45}
                  strokeDasharray="3 4"
                />
                <line
                  x1={activePosition.x}
                  x2={activePosition.x}
                  y1={activePosition.y}
                  y2={layout.innerHeight}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.45}
                  strokeDasharray="3 4"
                />
              </g>
            ) : null}

            <g aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {layout.paths.map((path) => (
                <motion.path
                  key={path.key}
                  d={path.d}
                  stroke={path.color}
                  strokeWidth={2}
                  initial={reduceMotion ? false : { d: path.d, opacity: 0 }}
                  animate={{
                    d: path.d,
                    opacity: activeId == null || path.ids.has(activeId) ? 0.5 : 0.16,
                  }}
                  transition={transition}
                />
              ))}
            </g>

            <g aria-hidden="true">
              {data.points.map((point) => {
                const position = layout.positions.get(point.id)

                if (!position) return null

                const active = point.id === activeId
                const dimmed = activeId != null && !active
                const delay =
                  entered || reduceMotion ? 0 : Math.min(point.index * STAGGER_STEP, STAGGER_MAX)
                const mask = point.logoUrl == null ? undefined : logoMasks.get(point.logoUrl)

                if (mask) {
                  const size = active ? ACTIVE_LOGO_SIZE : LOGO_SIZE

                  return (
                    <motion.rect
                      key={point.id}
                      mask={`url(#${mask})`}
                      fill={point.color}
                      initial={
                        reduceMotion
                          ? false
                          : { x: position.x, y: position.y, width: 0, height: 0, opacity: 0 }
                      }
                      animate={{
                        x: position.x - size / 2,
                        y: position.y - size / 2,
                        width: size,
                        height: size,
                        opacity: dimmed ? 0.42 : 1,
                      }}
                      transition={{ ...transition, delay }}
                    />
                  )
                }

                return (
                  <motion.circle
                    key={point.id}
                    cx={position.x}
                    cy={position.y}
                    fill={point.color}
                    stroke="var(--background)"
                    strokeWidth={2}
                    initial={reduceMotion ? false : { r: 0, opacity: 0 }}
                    animate={{
                      cx: position.x,
                      cy: position.y,
                      r: active ? ACTIVE_POINT_RADIUS : POINT_RADIUS,
                      opacity: dimmed ? 0.42 : 1,
                    }}
                    transition={{ ...transition, delay }}
                  />
                )
              })}
            </g>

            {activePosition ? (
              <circle
                aria-hidden="true"
                className="pointer-events-none"
                cx={activePosition.x}
                cy={activePosition.y}
                r={(activePoint ? markerHalf(activePoint, true) : ACTIVE_POINT_RADIUS) + 6}
                fill="none"
                stroke="var(--ring)"
                strokeOpacity={0.5}
                strokeWidth={1.5}
              />
            ) : null}

            <g aria-hidden="true">
              {layout.labels.map((label) => (
                <g
                  key={label.key}
                  opacity={activeId == null || label.ids.has(activeId) ? 1 : 0.35}
                  stroke="var(--background)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  style={{ transition: reduceMotion ? undefined : "opacity 200ms ease-out" }}
                >
                  <text
                    x={label.x}
                    y={label.nameY}
                    textAnchor={label.anchor}
                    fontSize={LABEL_NAME_SIZE}
                    fontWeight={600}
                    fill={label.color}
                  >
                    {label.name}
                  </text>
                  {label.effort ? (
                    <text
                      x={label.x}
                      y={label.effortY}
                      textAnchor={label.anchor}
                      fontSize={LABEL_EFFORT_SIZE}
                      fontWeight={500}
                      letterSpacing={0.4}
                      fill="var(--muted-foreground)"
                    >
                      {label.effort}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>

            <AxisLeft
              scale={layout.yScale}
              numTicks={layout.yTicks}
              stroke="var(--border)"
              tickStroke="var(--border)"
              tickFormat={(value) => formatMetric(Number(value), yMetric)}
              tickLabelProps={() => ({ ...AXIS_TICK_PROPS, dx: -4, dy: 3, textAnchor: "end" })}
            />
            <AxisBottom
              top={layout.innerHeight}
              scale={layout.xScale}
              numTicks={layout.xTicks}
              stroke="var(--border)"
              tickStroke="var(--border)"
              tickFormat={(value) => formatMetric(Number(value), xMetric)}
              tickLabelProps={() => ({ ...AXIS_TICK_PROPS, dy: 2, textAnchor: "middle" })}
            />

            <rect
              x={0}
              y={0}
              width={layout.innerWidth}
              height={layout.innerHeight}
              fill="transparent"
              className="cursor-crosshair"
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              onPointerLeave={() => setActiveId(null)}
            />
          </Group>

          <text
            x={MARGIN.left + layout.innerWidth / 2}
            y={height - 10}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={CHART_AXIS_TITLE_SIZE}
            fontWeight={500}
          >
            {metricAxisTitle(xMetric, sources.x, info)}
          </text>
          <text
            transform={`translate(16 ${MARGIN.top + layout.innerHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={CHART_AXIS_TITLE_SIZE}
            fontWeight={500}
          >
            {metricAxisTitle(yMetric, sources.y, info)}
          </text>
        </svg>
      ) : null}

      <div
        aria-hidden={activePoint == null}
        className={`absolute ${CHART_TOOLTIP_CLASS} ${
          activePoint == null ? "opacity-0" : "opacity-100"
        }`}
        style={
          pinTooltip || !activePosition
            ? { top: 12, right: 12, width: CHART_TOOLTIP_WIDTH }
            : {
                width: CHART_TOOLTIP_WIDTH,
                // Flips to the inside edge so the card never leaves the plot frame.
                left: clamp(
                  MARGIN.left +
                    activePosition.x +
                    (activePosition.x > layout.innerWidth / 2
                      ? -(CHART_TOOLTIP_WIDTH + CHART_TOOLTIP_GAP)
                      : CHART_TOOLTIP_GAP),
                  8,
                  Math.max(8, width - CHART_TOOLTIP_WIDTH - 8),
                ),
                top: clamp(MARGIN.top + activePosition.y - 40, 8, Math.max(8, height - 120)),
              }
        }
      >
        {activePoint ? (
          <PointDetails axes={data.axes} metrics={data.metrics} point={activePoint} />
        ) : null}
      </div>

      <div className="sr-only" aria-label="Chart points" role="group">
        {data.points.map((point) => (
          <button
            key={point.id}
            type="button"
            tabIndex={point.index === 0 ? 0 : -1}
            data-chart-keyboard-point={point.index}
            aria-label={`${point.label}, ${METRIC_CONFIG[xMetric].label} ${formatMetric(point.values.x, xMetric)}, ${METRIC_CONFIG[yMetric].label} ${formatMetric(point.values.y, yMetric)}`}
            onFocus={() => setActiveId(point.id)}
            onBlur={() => setActiveId(null)}
            onClick={() => setActiveId(point.id)}
            onKeyDown={(event) => handlePointKeyDown(event, point.index)}
          >
            {point.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {activePoint ? `${activePoint.label} selected` : ""}
      </p>
    </div>
  )
}
