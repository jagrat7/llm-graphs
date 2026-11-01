import type React from "react"
import { useCurrentFrame } from "remotion"

import type { Point, SourceKey } from "./data"

import { DATA, FOCUS, MODELS } from "./data"
import { PLOT, PLOT_CX, PLOT_CY } from "./layout"
import { LogoGlyph } from "./marks"
import { END_START } from "./EndCard"
import { SHARE_DOMAIN, SHARE_PLOT, shareCover } from "./ShareMenu"
import { useTheme } from "./theme-context"
import { Tooltip } from "./Tooltip"
import { at, BAR, easeInOutSoft, easeOut, FONT, lerp, progress, vendorColor, vendorLabelColor } from "./theme"

// ---------------------------------------------------------------------------------------------
// Scales. Each benchmark gets its own domain; a switch animates the domain, so the gridlines
// slide to their new values instead of jumping.

type Domain = { x: [number, number]; y: [number, number]; xTicks: Array<number>; yTicks: Array<number> }

const DOMAINS: Record<SourceKey, Domain> = {
  deepswe: { x: [0.35, 28], y: [14, 86], xTicks: [0.5, 1, 2, 5, 10, 20], yTicks: [20, 40, 60, 80] },
  terminalBench: { x: [3.6, 29], y: [0, 70], xTicks: [5, 10, 20], yTicks: [0, 20, 40, 60] },
  arcPrize: { x: [0.12, 7], y: [0, 115], xTicks: [0.2, 0.5, 1, 2, 5], yTicks: [0, 20, 40, 60, 80, 100] },
}
/** Task duration, DeepSWE's third metric, on a log scale as the app draws it. */
const Z_DOMAIN: [number, number] = [220, 5600]
const Z_TICKS: Array<[number, string]> = [
  [300, "5m"],
  [600, "10m"],
  [1200, "20m"],
  [3600, "1h"],
]

const money = (value: number) => `$${value}`
const pct = (value: number) => `${value}%`

/** Where a DeepSWE value sits on the flat chart before any camera move. */
export function deepsweFlat(cost: number, score: number) {
  const d = DOMAINS.deepswe
  const u = (Math.log(cost) - Math.log(d.x[0])) / (Math.log(d.x[1]) - Math.log(d.x[0]))
  const v = (score - d.y[0]) / (d.y[1] - d.y[0])
  return { x: PLOT.left + u * PLOT.width, y: PLOT.top + (1 - v) * PLOT.height }
}

/** Each switch lasts two beats, starting on the downbeat and settling on beat 3. */
const SWITCH = Math.round(BAR / 2)

function sourceBlend(frame: number): { from: SourceKey; to: SourceKey; t: number } {
  const steps: Array<[number, SourceKey, SourceKey]> = [
    [at(7), "deepswe", "terminalBench"],
    [at(8), "terminalBench", "arcPrize"],
    [at(9), "arcPrize", "deepswe"],
  ]
  let state = { from: "deepswe" as SourceKey, to: "deepswe" as SourceKey, t: 1 }
  for (const [start, from, to] of steps) {
    if (frame >= start) state = { from, to, t: progress(frame, start, SWITCH, easeInOutSoft) }
  }
  return state
}

function blendDomain(a: Pick<Domain, "x" | "y">, b: Pick<Domain, "x" | "y">, t: number) {
  const lx = (d: Pick<Domain, "x">, i: 0 | 1) => Math.log(d.x[i])
  return {
    x: [Math.exp(lerp(lx(a, 0), lx(b, 0), t)), Math.exp(lerp(lx(a, 1), lx(b, 1), t))] as [number, number],
    y: [lerp(a.y[0], b.y[0], t), lerp(a.y[1], b.y[1], t)] as [number, number],
  }
}

// ---------------------------------------------------------------------------------------------
// The 3D view. A point's normalised (u, v, w) lives in a box; at cube = 0 the box has no depth
// and no rotation, which is exactly the 2D chart, so the plot turns into the cube in one move.

type View = { cube: number; yaw: number; pitch: number; fit: number; zoom: number; fx: number; fy: number; tx: number; ty: number; sw: number; sh: number; share: number }

function project(u: number, v: number, w: number, view: View) {
  const width = lerp(PLOT.width * view.sw, 980, view.cube)
  const height = lerp(PLOT.height * view.sh, 640, view.cube)
  const depth = 980 * view.cube
  const X = (u - 0.5) * width
  const Y = (0.5 - v) * height
  const Z = (0.5 - w) * depth
  const cy = Math.cos(view.yaw)
  const sy = Math.sin(view.yaw)
  const x1 = X * cy + Z * sy
  const z1 = -X * sy + Z * cy
  const cp = Math.cos(view.pitch)
  const sp = Math.sin(view.pitch)
  const y2 = Y * cp - z1 * sp
  const z2 = Y * sp + z1 * cp
  const focal = 3200
  const s = focal / (focal - z2 * view.cube)
  // Chart space (plot centre at PLOT_CX/CY), then the camera: zoom around a focus point.
  const cx = PLOT_CX + view.cube * 110 + x1 * s * view.fit
  const cyy = PLOT_CY - view.cube * 34 + y2 * s * view.fit
  return { x: view.tx + (cx - view.fx) * view.zoom, y: view.ty + (cyy - view.fy) * view.zoom, depth: z2 }
}

/** Chart-space centre of the focus model's curve on DeepSWE, which the punch-in frames. */
const PUNCH_FOCUS = { x: 1072, y: 355 }
const PUNCH_TARGET = { x: 930, y: 440 }

function viewAt(frame: number): View {
  // Bar 12: punch in on the focus model's curve over two beats. Bar 14: pull back into the
  // rectangle the exported image's plot will occupy (ShareMenu.tsx), so the saved image lands
  // on the chart it was taken from. Bar 17: one camera move turns that plot into the cube, a
  // full bar, then a slow eased orbit until the end card.
  const punchIn = progress(frame, at(12), Math.round(BAR / 2), easeInOutSoft)
  const pull = progress(frame, at(14) - 6, 24, easeInOutSoft)
  const turn = progress(frame, at(17), Math.round(BAR), easeInOutSoft)
  const punch = punchIn * (1 - pull)
  const share = pull * (1 - turn)
  const orbit = progress(frame, at(18), at(21) - at(18), easeInOutSoft)
  return {
    cube: turn,
    yaw: -(0.6 * turn + 0.4 * orbit),
    pitch: -0.3 * turn,
    fit: lerp(1, 0.68, turn),
    zoom: lerp(1, 2.3, punch),
    fx: lerp(PLOT_CX, PUNCH_FOCUS.x, punch),
    fy: lerp(PLOT_CY, PUNCH_FOCUS.y, punch),
    tx: lerp(lerp(PLOT_CX, PUNCH_TARGET.x, punch), SHARE_PLOT.x + SHARE_PLOT.width / 2, share),
    ty: lerp(lerp(PLOT_CY, PUNCH_TARGET.y, punch), SHARE_PLOT.y + SHARE_PLOT.height / 2, share),
    sw: lerp(1, SHARE_PLOT.width / PLOT.width, share),
    sh: lerp(1, SHARE_PLOT.height / PLOT.height, share),
    share,
  }
}

// ---------------------------------------------------------------------------------------------

/** Points match across benchmarks by model, mode and reasoning level. */
const keyOf = (point: Point) => `${point.model}|${point.mode}|${point.level}`

/** The opening labels on DeepSWE: the frontier's ends, its knee, and the dearest strong model. */
const LABELS: Array<{ model: string; level: string; dx: number; dy: number; anchor: "start" | "middle" | "end" }> = [
  { model: "gemini-3-8-flash", level: "high", dx: -30, dy: -30, anchor: "end" },
  { model: "claude-opus-5", level: "max", dx: 0, dy: -70, anchor: "middle" },
  { model: "gpt-5-6-terra", level: "high", dx: -30, dy: -30, anchor: "end" },
]

/** The focus model's best point on each benchmark carries its name through the switches. */
function focusBest(source: SourceKey) {
  return DATA.sources[source].points
    .filter((point) => point.model === FOCUS && point.mode === "on")
    .reduce((best, point) => (point.score > best.score ? point : best))
}

/** Where the focus label sits relative to its point: above, name then level. */
export const FOCUS_LABEL_DY = -70

/** Level labels under the focus model's points in the punch-in (screen px). */
const LEVEL_OFFSETS: Record<string, { dx: number; dy: number }> = {
  low: { dx: 0, dy: 62 },
  medium: { dx: 0, dy: 62 },
  high: { dx: -6, dy: 62 },
  max: { dx: 0, dy: 62 },
}

const NAME_SIZE = 42
const LEVEL_SIZE = 34
const TICK_SIZE = 32
const TITLE_SIZE = 36

export function Chart() {
  const frame = useCurrentFrame()
  const T = useTheme()
  if (frame < at(4) + 20 || frame > END_START) return null

  const blend = sourceBlend(frame)
  const A = DATA.sources[blend.from]
  const B = DATA.sources[blend.to]
  const view = viewAt(frame)
  // While it is shared, the plot takes the exported image's domain as well as its rectangle.
  const domain = blendDomain(blendDomain(DOMAINS[blend.from], DOMAINS[blend.to], blend.t), SHARE_DOMAIN, view.share)
  // Type, marks and spacing ease toward the image's smaller scale too.
  const ink = lerp(1, 0.75, view.share)
  // The chart clears for the end card.
  const exit = progress(frame, END_START - 10, 16, easeInOutSoft)
  // Under the saved image only its axis titles would show past the image's edges, so it steps
  // out; cubed, so it stays solid while the image is still faint and the two don't wash out.
  const chartOpacity = (1 - exit) * (1 - shareCover(frame) ** 3)

  const u = (cost: number) => (Math.log(cost) - Math.log(domain.x[0])) / (Math.log(domain.x[1]) - Math.log(domain.x[0]))
  const v = (score: number) => (score - domain.y[0]) / (domain.y[1] - domain.y[0])
  const wz = (seconds: number) => (Math.log(seconds) - Math.log(Z_DOMAIN[0])) / (Math.log(Z_DOMAIN[1]) - Math.log(Z_DOMAIN[0]))
  const P = (uu: number, vv: number, ww: number) => project(uu, vv, ww, view)

  // Reveal: rulings come in under the stacking sheets (bar 4), axes and points on bar 5.
  const grid = progress(frame, at(4) + 40, 24, easeOut)
  const axes = progress(frame, at(5), 18, easeOut)

  // Emphasis.
  const frontierDraw = progress(frame, at(10), 46, easeInOutSoft)
  const frontierOn = progress(frame, at(10), 20, easeOut) * (1 - progress(frame, at(14), 20, easeOut))
  const focus = progress(frame, at(12), 16, easeOut) * (1 - progress(frame, at(14), 24, easeOut))
  const dimmed = 0.28

  // ---- points, matched across the switch
  const aPoints = new Map(A.points.map((point) => [keyOf(point), point]))
  const bPoints = new Map(B.points.map((point) => [keyOf(point), point]))
  const keys = [...new Set([...aPoints.keys(), ...bPoints.keys()])]
  const order = [...DATA.sources.deepswe.points].sort((a, b) => a.cost - b.cost).map(keyOf)

  type Placed = { key: string; point: Point; x: number; baseY: number; y: number; depth: number; opacity: number; reveal: number; frontier: boolean }
  const placed = new Map<string, Placed>()
  const frontier = new Set(DATA.sources.deepswe.frontier)
  const onDeepswe = blend.to === "deepswe" && blend.t === 1

  for (const key of keys) {
    const a = aPoints.get(key)
    const b = bPoints.get(key)
    const t = blend.t
    const score = a && b ? lerp(a.score, b.score, t) : (b ?? a)!.score
    const cost = a && b ? Math.exp(lerp(Math.log(a.cost), Math.log(b.cost), t)) : (b ?? a)!.cost
    const point = (t < 0.5 ? (a ?? b) : (b ?? a))!
    // A point only one benchmark has leaves in the first third of the move or arrives in the
    // last third, so it never travels far outside its own domain.
    const presence = a && b ? 1 : a ? 1 - progress(t, 0, 0.3) : progress(t, 0.7, 0.3)
    const deep = DATA.sources.deepswe.points.find((p) => keyOf(p) === key)
    const duration = deep?.duration ?? Z_DOMAIN[0]
    const p = P(u(cost), v(score), onDeepswe ? wz(duration) : 0.5)
    const index = Math.max(0, order.indexOf(key))
    const reveal = progress(frame, at(5) + 2 + index, 14, easeOut)
    const isFrontier = onDeepswe && frontier.has(point.id)
    const emphasis =
      point.model === FOCUS
        ? lerp(isFrontier ? 1 : lerp(1, dimmed, frontierOn), 1, focus)
        : lerp(isFrontier ? 1 : lerp(1, dimmed, frontierOn), dimmed, focus)
    placed.set(key, {
      key,
      point,
      x: p.x,
      baseY: p.y,
      y: p.y - (1 - reveal) * 18,
      depth: p.depth,
      opacity: presence * reveal * emphasis,
      reveal,
      frontier: isFrontier,
    })
  }

  // ---- run lines: one per evaluation configuration, joining its reasoning levels. During a
  // switch the outgoing lines clear in the first third and the incoming ones draw in the last,
  // so only the points carry the morph.
  const runs: Array<{ id: string; color: string; d: string; opacity: number }> = []
  for (const [source, weight] of [
    [A, blend.from === blend.to ? 0 : 1 - progress(blend.t, 0, 0.3, easeOut)],
    [B, blend.from === blend.to ? 1 : progress(blend.t, 0.7, 0.3, easeOut)],
  ] as const) {
    if (weight <= 0.001) continue
    const bySeries = new Map<string, Array<Point>>()
    for (const point of source.points) bySeries.set(point.series, [...(bySeries.get(point.series) ?? []), point])
    for (const [series, members] of bySeries) {
      if (members.length < 2) continue
      const model = MODELS.get(members[0].model)!
      // A run draws only through points that have landed, so lines follow the cascade.
      const coords = members
        .sort((a, b) => a.effortOrder - b.effortOrder)
        .map((point) => placed.get(keyOf(point)))
        .filter((p): p is Placed => p != null && p.reveal > 0.6)
      if (coords.length < 2) continue
      const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      const isFocus = model.id === FOCUS
      const base = 0.45
      const emphasis = isFocus ? lerp(lerp(1, dimmed, frontierOn), 0.85 / base, focus) : lerp(lerp(1, dimmed, frontierOn), dimmed, focus)
      runs.push({ id: `${source.key}-${series}`, color: vendorColor(T, model), d, opacity: base * emphasis * weight })
    }
  }

  // ---- frontier, DeepSWE only, drawn left to right like a pen
  const frontierPoints = DATA.sources.deepswe.frontier
    .map((id) => [...placed.values()].find((p) => p.point.id === id))
    .filter((p): p is Placed => p != null)
  const frontierD = frontierPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  let frontierLength = 0
  for (let i = 1; i < frontierPoints.length; i += 1) {
    frontierLength += Math.hypot(frontierPoints[i].x - frontierPoints[i - 1].x, frontierPoints[i].y - frontierPoints[i - 1].y)
  }

  // ---- grid: the walls of the box. At cube = 0 only the back wall shows, as the 2D plot.
  const ticksA = DOMAINS[blend.from]
  const ticksB = DOMAINS[blend.to]
  const tickSet = (pick: (d: Domain) => Array<number>) => {
    const all = [...new Set([...pick(ticksA), ...pick(ticksB)])]
    return all.map((value) => {
      const inA = pick(ticksA).includes(value)
      const inB = pick(ticksB).includes(value)
      const opacity = inA && inB ? 1 : inA ? 1 - blend.t : blend.t
      return { value, opacity }
    })
  }
  // A tick fades as the moving domain carries it to the plot's edge, rather than popping.
  const edge = (at: number) => Math.max(0, Math.min(1, 1 - Math.max(0, -at, at - 1) * 25))
  const xTicks = tickSet((d) => d.xTicks)
    .map((tick) => ({ ...tick, at: u(tick.value) }))
    .map((tick) => ({ ...tick, opacity: tick.opacity * edge(tick.at) }))
    .filter((tick) => tick.opacity > 0.001)
  const yTicks = tickSet((d) => d.yTicks)
    .map((tick) => ({ ...tick, at: v(tick.value) }))
    .map((tick) => ({ ...tick, opacity: tick.opacity * edge(tick.at) }))
    .filter((tick) => tick.opacity > 0.001)
  const zTicks = Z_TICKS.map(([value, label]) => ({ value, label, at: wz(value) }))

  // Minor rulings, four squares per major interval as in paper-rulings.ts.
  const minors = (ticks: Array<{ at: number; opacity: number }>) => {
    const out: Array<{ at: number; opacity: number }> = []
    const sorted = [...ticks].sort((a, b) => a.at - b.at)
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const step = (sorted[i + 1].at - sorted[i].at) / 4
      const opacity = Math.min(sorted[i].opacity, sorted[i + 1].opacity)
      for (let k = 1; k < 4; k += 1) out.push({ at: sorted[i].at + k * step, opacity })
    }
    if (sorted.length > 1) {
      const first = (sorted[1].at - sorted[0].at) / 4
      for (let p = sorted[0].at - first; p > 0.001; p -= first) out.push({ at: p, opacity: sorted[0].opacity })
      const n = sorted.length
      const last = (sorted[n - 1].at - sorted[n - 2].at) / 4
      for (let p = sorted[n - 1].at + last; p < 0.999; p += last) out.push({ at: p, opacity: sorted[n - 1].opacity })
    }
    return out
  }
  const zMinor = minors(zTicks.map((tick) => ({ at: tick.at, opacity: 1 })))

  // Larger depth is nearer the viewer; the wall of each pair that sits farther is drawn.
  const far = (a: [number, number, number], b: [number, number, number]) => (P(...a).depth < P(...b).depth ? 0 : 1)
  const backU = far([0, 0.5, 0.5], [1, 0.5, 0.5])
  const backV = far([0.5, 0, 0.5], [0.5, 1, 0.5])
  const backW = view.cube < 0.01 ? 1 : far([0.5, 0.5, 0], [0.5, 0.5, 1])
  const wall = view.cube

  const line = (a: { x: number; y: number }, b: { x: number; y: number }, opacity: number, width = 1.5, key?: string) => (
    <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={T.ruling} strokeOpacity={opacity} strokeWidth={width} />
  )

  const gridLines: Array<React.ReactElement> = []
  for (const tick of xTicks) gridLines.push(line(P(tick.at, 0, backW), P(tick.at, 1, backW), 0.75 * tick.opacity, 1.5, `bx${tick.value}`))
  for (const tick of yTicks) gridLines.push(line(P(0, tick.at, backW), P(1, tick.at, backW), 0.85 * tick.opacity, 1.5, `by${tick.value}`))
  for (const [i, tick] of minors(xTicks).entries()) gridLines.push(line(P(tick.at, 0, backW), P(tick.at, 1, backW), 0.32 * tick.opacity, 1, `mx${i}`))
  for (const [i, tick] of minors(yTicks).entries()) gridLines.push(line(P(0, tick.at, backW), P(1, tick.at, backW), 0.32 * tick.opacity, 1, `my${i}`))
  if (wall > 0.01) {
    for (const tick of xTicks) gridLines.push(line(P(tick.at, backV, 0), P(tick.at, backV, 1), 0.7 * wall * tick.opacity, 1.5, `fx${tick.value}`))
    for (const tick of zTicks) gridLines.push(line(P(0, backV, tick.at), P(1, backV, tick.at), 0.7 * wall, 1.5, `fz${tick.value}`))
    for (const [i, tick] of zMinor.entries()) gridLines.push(line(P(0, backV, tick.at), P(1, backV, tick.at), 0.28 * wall, 1, `fzm${i}`))
    for (const tick of yTicks) gridLines.push(line(P(backU, tick.at, 0), P(backU, tick.at, 1), 0.7 * wall * tick.opacity, 1.5, `sy${tick.value}`))
    for (const tick of zTicks) gridLines.push(line(P(backU, 0, tick.at), P(backU, 1, tick.at), 0.7 * wall, 1.5, `sz${tick.value}`))
  }
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as const
  for (let i = 0; i < 4; i += 1) {
    const [u0, v0] = corners[i]
    const [u1, v1] = corners[(i + 1) % 4]
    gridLines.push(line(P(u0, v0, backW), P(u1, v1, backW), 1, 1.75, `e${i}`))
    if (wall > 0.01) {
      gridLines.push(line(P(u0, v0, 0), P(u1, v1, 0), wall * 0.9, 1.5, `ef${i}`))
      gridLines.push(line(P(u0, v0, 0), P(u0, v0, 1), wall * 0.9, 1.5, `ed${i}`))
    }
  }

  // ---- axis labels: y on the left edge, x along the bottom, z along the floor's side
  const front = 0
  const yLabelAt = (value: number) => P(0, v(value), wall > 0 ? front : backW)
  const xLabelAt = (value: number) => P(u(value), 0, wall > 0 ? front : backW)
  const tickStyle = { fontFamily: FONT.mono, fontSize: TICK_SIZE * ink, fill: T.graphite, fontVariantNumeric: "tabular-nums" as const }
  const titleStyle = { fontFamily: FONT.sans, fontSize: TITLE_SIZE * ink, fontWeight: 500, fill: T.graphite }
  const xEdgeA = P(0, 0, front)
  const xEdgeB = P(1, 0, front)
  const xAngle = (Math.atan2(xEdgeB.y - xEdgeA.y, xEdgeB.x - xEdgeA.x) * 180) / Math.PI
  const xMid0 = P(0.5, 0, front)
  const xNormal = { x: -Math.sin((xAngle * Math.PI) / 180), y: Math.cos((xAngle * Math.PI) / 180) }
  const xTitleOffset = lerp(96, 118, wall) * ink
  const xMid = { x: xMid0.x + xNormal.x * xTitleOffset, y: xMid0.y + xNormal.y * xTitleOffset - xTitleOffset }
  const zSide = backU === 0 ? 1 : 0
  const zA = P(zSide, 0, 0)
  const zB = P(zSide, 0, 1)
  const zAngle = (Math.atan2(zB.y - zA.y, zB.x - zA.x) * 180) / Math.PI
  const zMid = P(zSide, 0, 0.5)
  const yMid = P(0, 0.5, wall > 0 ? front : backW)
  const yLabelGap = lerp(18, 48, wall)

  // ---- labels
  const labelsOn = progress(frame, at(5) + 24, 16, easeOut)
  const switching = progress(frame, at(7), 10, easeOut) * (1 - progress(frame, at(9) + SWITCH, 16, easeOut))
  const cubeLabels = progress(frame, at(17) + 36, 20, easeOut)
  const levelLabels = (index: number) => progress(frame, at(12) + 16 + index * 3, 14, easeOut) * (1 - progress(frame, at(14), 16, easeOut))
  const labelScale = (1 + (view.zoom - 1) * 0.12) * ink

  const focusA = focusBest(blend.from)
  const focusB = focusBest(blend.to)
  const focusPlacedA = placed.get(keyOf(focusA))
  const focusPlacedB = placed.get(keyOf(focusB))
  const levelMix = progress(blend.t, 0.4, 0.2)

  type Label = {
    id: string
    x: number
    y: number
    name: string
    levels: Array<[string, number]>
    color: string
    levelColor: string
    anchor: "start" | "middle" | "end"
    opacity: number
  }
  const labels: Array<Label> = []
  // Near the plot's top edge the name hangs below its point, clear of the frame and headline.
  const labelDy = (point: Point, source: SourceKey) => {
    const d = DOMAINS[source]
    const top = (point.score - d.y[0]) / (d.y[1] - d.y[0]) > 0.86
    return top && view.cube < 0.01 ? 62 * labelScale : FOCUS_LABEL_DY * labelScale
  }
  const astra = MODELS.get(FOCUS)!
  if (focusPlacedA && focusPlacedB) {
    labels.push({
      id: "focus",
      x: lerp(focusPlacedA.x, focusPlacedB.x, blend.t),
      y: lerp(focusPlacedA.baseY + labelDy(focusA, blend.from), focusPlacedB.baseY + labelDy(focusB, blend.to), blend.t),
      name: astra.name,
      levels: [
        [focusA.level, focusA.level === focusB.level ? 1 : 1 - levelMix],
        [focusB.level, focusA.level === focusB.level ? 0 : levelMix],
      ],
      color: vendorLabelColor(T, astra),
      levelColor: vendorLabelColor(T, astra),
      anchor: "middle",
      // The name arrives with the row it was lifted from (Scraps.tsx), so it is on from bar 5.
      opacity: frame >= at(5) ? 1 : 0,
    })
  }
  for (const spec of LABELS) {
    const point = DATA.sources.deepswe.points.find((p) => p.model === spec.model && p.level === spec.level)!
    const p = placed.get(keyOf(point))
    if (!p) continue
    const model = MODELS.get(spec.model)!
    // A label belongs to its point: it stays lit only if that point is on the frontier.
    const lit = frontier.has(point.id)
    const emphasis = lerp(lit ? 1 : lerp(1, dimmed, frontierOn), 0, focus)
    labels.push({
      id: spec.model,
      x: p.x + spec.dx,
      y: p.y + spec.dy,
      name: model.name,
      levels: [[spec.level, 1]],
      color: vendorLabelColor(T, model),
      levelColor: T.graphite,
      anchor: spec.anchor,
      opacity: labelsOn * (1 - switching) * emphasis * (1 - progress(frame, at(17) - 4, 8, easeOut)),
    })
  }
  // In the cube, the names that sit apart from the cluster, as the app's 3D view shows them.
  for (const [id, level, dx, dy] of [
    ["kimi-k3", "max", 30, 12],
    ["claude-fable-5", "max", 0, 56],
    ["gemini-3-8-flash", "high", -26, -26],
  ] as const) {
    const point = DATA.sources.deepswe.points.find((p) => p.model === id && p.level === level)!
    const p = placed.get(keyOf(point))
    if (!p) continue
    const model = MODELS.get(id)!
    labels.push({
      id: `cube-${id}`,
      x: p.x + dx,
      y: p.y + dy,
      name: model.name,
      levels: [[level, 1]],
      color: vendorLabelColor(T, model),
      levelColor: T.graphite,
      anchor: dx < 0 ? "end" : dx > 0 ? "start" : "middle",
      opacity: cubeLabels * (1 - exit),
    })
  }

  const astraLevels = DATA.sources.deepswe.points.filter((p) => p.model === FOCUS && p.level !== "xhigh")
  const tooltipPoint = DATA.sources.deepswe.points.find((p) => p.model === FOCUS && p.level === "xhigh")!
  const tooltipPlaced = placed.get(keyOf(tooltipPoint))
  const tooltipOn = progress(frame, at(12, 2), 12, easeOut) * (1 - progress(frame, at(14), 10, easeOut))

  const markerSize = 32 * (1 + (view.zoom - 1) * 0.3) * ink
  const clipA = P(0, 1, backW)
  const clipB = P(1, 0, backW)
  const sortedPoints = [...placed.values()].sort((a, b) => a.depth - b.depth)
  const halo = { paintOrder: "stroke" as const, stroke: T.paper, strokeLinejoin: "round" as const }

  return (
    <div style={{ position: "absolute", inset: 0, opacity: chartOpacity }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id="frontier-reveal" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
            <path
              d={frontierD}
              fill="none"
              stroke="white"
              strokeWidth={14}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${frontierLength + 2} ${frontierLength + 2}`}
              strokeDashoffset={(frontierLength + 2) * (1 - frontierDraw)}
            />
          </mask>
          <clipPath id="line-clip">
            {view.cube < 0.01 ? (
              <rect x={clipA.x} y={clipA.y} width={clipB.x - clipA.x} height={clipB.y - clipA.y} />
            ) : (
              <rect x={-2000} y={-2000} width={6000} height={6000} />
            )}
          </clipPath>
          <clipPath id="point-clip">
            {view.cube < 0.01 ? (
              <rect x={clipA.x - 20} y={clipA.y - 20} width={clipB.x - clipA.x + 40} height={clipB.y - clipA.y + 40} />
            ) : (
              <rect x={-2000} y={-2000} width={6000} height={6000} />
            )}
          </clipPath>
        </defs>
        <clipPath id="below-headline">
          <rect x={0} y={150} width={1920} height={930} />
        </clipPath>
        <g opacity={grid} clipPath="url(#below-headline)">{gridLines}</g>

        <g opacity={axes}>
          {yTicks.map((tick) => {
            const p = yLabelAt(tick.value)
            return (
              <text key={`yt${tick.value}`} x={p.x - yLabelGap} y={p.y + 11 * ink} textAnchor="end" style={tickStyle} opacity={tick.opacity}>
                {pct(tick.value)}
              </text>
            )
          })}
          {xTicks.map((tick) => {
            const p = xLabelAt(tick.value)
            return (
              <text key={`xt${tick.value}`} x={p.x} y={p.y + 48 * ink} textAnchor="middle" style={tickStyle} opacity={tick.opacity}>
                {money(tick.value)}
              </text>
            )
          })}
          {wall > 0.01 &&
            zTicks.map((tick) => {
              const p = P(zSide, 0, tick.at)
              return (
                <text key={`zt${tick.value}`} x={p.x + 24} y={p.y + 36} textAnchor="start" style={tickStyle} opacity={wall}>
                  {tick.label}
                </text>
              )
            })}
          <text x={xMid.x} y={xMid.y + 96} textAnchor="middle" transform={`rotate(${xAngle} ${xMid.x} ${xMid.y + 96})`} style={titleStyle}>
            Task cost ($/task, log scale)
          </text>
          <text x={yMid.x - 128 * ink} y={yMid.y} textAnchor="middle" transform={`rotate(-90 ${yMid.x - 128 * ink} ${yMid.y})`} style={titleStyle}>
            Score (%)
          </text>
          {wall > 0.01 && (
            <text
              x={zMid.x + 96}
              y={zMid.y + 96}
              textAnchor="middle"
              transform={`rotate(${zAngle} ${zMid.x + 96} ${zMid.y + 96})`}
              style={titleStyle}
              opacity={wall}
            >
              Task duration (log scale)
            </text>
          )}
        </g>

        <g clipPath="url(#line-clip)">
          {runs.map((run) => (
            <path key={run.id} d={run.d} fill="none" stroke={run.color} strokeOpacity={run.opacity} strokeWidth={2.5} strokeLinejoin="round" />
          ))}
        </g>

        {frontierOn > 0 && (
          <path
            d={frontierD}
            fill="none"
            stroke={T.graphite}
            strokeOpacity={0.75 * frontierOn * lerp(1, dimmed, focus)}
            strokeWidth={3}
            strokeDasharray="10 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            mask="url(#frontier-reveal)"
          />
        )}

        <g clipPath="url(#point-clip)">
          {sortedPoints.map((p) => {
            const model = MODELS.get(p.point.model)!
            const active = p.point.id === tooltipPoint.id ? 1 + 0.4 * tooltipOn : 1
            return model.logo ? (
              <LogoGlyph key={p.key} logo={model.logo} size={markerSize * active} color={vendorColor(T, model)} x={p.x} y={p.y} opacity={p.opacity} />
            ) : (
              <circle key={p.key} cx={p.x} cy={p.y} r={8} fill={vendorColor(T, model)} opacity={p.opacity} />
            )
          })}
        </g>

        {labels.map((label) => (
          <g key={label.id} opacity={label.opacity}>
            <text x={label.x} y={label.y} textAnchor={label.anchor} style={{ fontFamily: FONT.sans, fontSize: NAME_SIZE * labelScale, fontWeight: 600, fill: label.color, strokeWidth: 9, ...halo }}>
              {label.name}
            </text>
            {label.levels.map(([level, opacity]) =>
              opacity > 0.001 ? (
                <text
                  key={level}
                  x={label.x}
                  y={label.y + 34 * labelScale}
                  textAnchor={label.anchor}
                  opacity={opacity}
                  style={{ fontFamily: FONT.sans, fontSize: LEVEL_SIZE * labelScale, fontWeight: 500, fill: label.levelColor, strokeWidth: 8, ...halo }}
                >
                  {level}
                </text>
              ) : null,
            )}
          </g>
        ))}

        {astraLevels.map((point, index) => {
          const p = placed.get(keyOf(point))
          if (!p) return null
          const offset = LEVEL_OFFSETS[point.level] ?? { dx: 0, dy: 62 }
          return (
            <text
              key={`lvl-${point.level}`}
              x={p.x + offset.dx}
              y={p.y + offset.dy}
              textAnchor="middle"
              opacity={levelLabels(index)}
              style={{ fontFamily: FONT.sans, fontSize: 36, fontWeight: 500, fill: vendorLabelColor(T, astra), strokeWidth: 8, ...halo }}
            >
              {point.level}
            </text>
          )
        })}
      </svg>
      {tooltipPlaced && tooltipOn > 0 && <Tooltip point={tooltipPoint} x={tooltipPlaced.x} y={tooltipPlaced.y} t={tooltipOn} />}
    </div>
  )
}
