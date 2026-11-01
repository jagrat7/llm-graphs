import type { CSSProperties } from "react"

import { interpolate, useCurrentFrame } from "remotion"

import type { Scrap } from "./data"

import { deepsweFlat, FOCUS_LABEL_DY } from "./Chart"
import { DATA, FOCUS, MODELS } from "./data"
import { PLOT } from "./layout"
import { SourceMark } from "./marks"
import { useTheme } from "./theme-context"
import type { Theme } from "./theme"
import { at, easeInOut, easeInOutSoft, easeOut, FONT, lerp, progress, vendorLabelColor } from "./theme"

/**
 * Ten leaderboards, as ten separate sheets dropped on the pad: each in its own layout, unit and
 * ink, the way the sites themselves differ. They sit inside the safe area (x 84–1864,
 * y 196–984), overlapping only at their edges, so every focus row stays uncovered.
 */
const PLACES: Record<string, { x: number; y: number; w: number; h: number; r: number; z: number }> = {
  deepswe: { x: 86, y: 198, w: 360, h: 368, r: -1.1, z: 5 },
  arcPrize: { x: 440, y: 212, w: 354, h: 352, r: 1.2, z: 4 },
  terminalBench: { x: 790, y: 196, w: 362, h: 368, r: -0.7, z: 3 },
  arena: { x: 1148, y: 214, w: 354, h: 356, r: 1.1, z: 2 },
  sweBench: { x: 1500, y: 200, w: 360, h: 362, r: -1.0, z: 1 },
  metr: { x: 88, y: 604, w: 356, h: 368, r: 0.9, z: 5 },
  frontierCode: { x: 438, y: 598, w: 362, h: 376, r: -1.2, z: 4 },
  cursorBench: { x: 796, y: 616, w: 352, h: 360, r: 1.0, z: 3 },
  automationBench: { x: 1144, y: 600, w: 364, h: 376, r: -0.8, z: 2 },
  liveCodeBench: { x: 1504, y: 612, w: 356, h: 362, r: 1.2, z: 1 },
}

/** Each site's own accent, from its mark (source-logo.tsx, public/benchmarks); grey on the dark pad. */
const ACCENT: Record<string, string> = {
  deepswe: "#0A0A0A",
  arcPrize: "#E030A0",
  terminalBench: "#1A1A1A",
  arena: "#242422",
  sweBench: "#C9787A",
  metr: "#6F9A64",
  frontierCode: "#000000",
  cursorBench: "#26251E",
  automationBench: "#FF4F00",
  liveCodeBench: "#338AF3",
}
const accent = (T: Theme, source: string) => (T.dark ? T.graphite : ACCENT[source])

/** When the focus model's row lights on each sheet: two beats apart, bars 1–3. */
export const HUNT: Array<[string, number]> = [
  ["deepswe", at(1)],
  ["arcPrize", at(1, 2)],
  ["terminalBench", at(2)],
  ["arena", at(2, 2)],
  ["frontierCode", at(3)],
  ["automationBench", at(3, 2)],
]

/** The collapse order: nearest the plot's centre first, so the stack builds from the middle. */
const COLLAPSE_ORDER = Object.entries(PLACES)
  .map(([key, p]) => {
    const dx = p.x + p.w / 2 - (PLOT.left + PLOT.width / 2)
    const dy = p.y + p.h / 2 - (PLOT.top + PLOT.height / 2)
    return { key, d: Math.hypot(dx, dy) }
  })
  .sort((a, b) => a.d - b.d)
  .map((entry) => entry.key)

export const COLLAPSE_START = at(4)
const COLLAPSE_STAGGER = 2
/** The last sheet squares up exactly on bar 5, where the chart takes over. */
const COLLAPSE_DURATION = at(5) - at(4) - 9 * COLLAPSE_STAGGER

export function Scraps() {
  const frame = useCurrentFrame()
  const stackFade = interpolate(frame, [at(5) - 12, at(5) + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  if (stackFade <= 0 && frame > at(5)) return null

  const scraps = [...DATA.scraps].sort((a, b) => PLACES[a.source].z - PLACES[b.source].z)

  return (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: stackFade }}>
        {scraps.map((scrap, index) => (
          <ScrapCard key={scrap.source} scrap={scrap} index={index} />
        ))}
      </div>
      <Carry />
    </>
  )
}

/**
 * The focus model's DeepSWE row lifts off its sheet as the sheets gather and lands as the
 * model's name on the chart, on the point its numbers describe.
 */
function Carry() {
  const frame = useCurrentFrame()
  const T = useTheme()
  if (frame < at(4) || frame >= at(5)) return null
  const t = progress(frame, at(4), at(5) - at(4), easeInOutSoft)
  const place = PLACES.deepswe
  const start = { x: place.x + 22 + 66, y: place.y + 136 }
  const point = DATA.sources.deepswe.points.find((p) => p.model === FOCUS && p.level === "xhigh")!
  const end = deepsweFlat(point.cost, point.score)
  const x = lerp(start.x, end.x, t)
  const y = lerp(start.y, end.y + FOCUS_LABEL_DY, t)
  const size = lerp(21, 42, t)
  const model = MODELS.get(FOCUS)!
  const color = `color-mix(in oklch, ${vendorLabelColor(T, model)} ${Math.round(t * 100)}%, ${T.washInk})`
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        style={{ fontFamily: FONT.sans, fontSize: size, fontWeight: lerp(500, 600, t), fill: color, paintOrder: "stroke", stroke: T.paper, strokeWidth: 9 * t, strokeLinejoin: "round" }}
      >
        {model.name}
      </text>
      <text
        x={x}
        y={y + 34 * t}
        textAnchor="middle"
        opacity={progress(t, 0.6, 0.4)}
        style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 500, fill: vendorLabelColor(T, model), paintOrder: "stroke", stroke: T.paper, strokeWidth: 8, strokeLinejoin: "round" }}
      >
        {point.level}
      </text>
    </svg>
  )
}

function ScrapCard({ scrap, index }: { scrap: Scrap; index: number }) {
  const frame = useCurrentFrame()
  const T = useTheme()
  const place = PLACES[scrap.source]
  // Arrival: each sheet slides a short way up and settles, a frame and a half apart.
  const arrive = progress(frame, 1 + index * 1.5, 16, easeOut)
  const order = COLLAPSE_ORDER.indexOf(scrap.source)
  const collapse = progress(frame, COLLAPSE_START + order * COLLAPSE_STAGGER, COLLAPSE_DURATION, easeInOut)
  // The content holds until the sheets are nearly stacked, so no blank sheet ever shows.
  const contentOpacity = interpolate(collapse, [0.5, 0.85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  const x = lerp(place.x, PLOT.left, collapse)
  const y = lerp(place.y, PLOT.top, collapse) + (1 - arrive) * 32
  const w = lerp(place.w, PLOT.width, collapse)
  const h = lerp(place.h, PLOT.height, collapse)
  const r = lerp(place.r, 0, collapse)

  const huntAt = HUNT.find(([source]) => source === scrap.source)?.[1]
  const lit = huntAt == null ? 0 : progress(frame, huntAt, 10, easeOut)
  const lifted = scrap.source === "deepswe" && frame >= at(4)

  const card: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: `rotate(${r}deg)`,
    background: T.sheet,
    border: `1.5px solid ${T.ruling}`,
    borderRadius: T.dark ? 8 : 6,
    opacity: arrive,
    overflow: "hidden",
    fontFamily: FONT.sans,
    color: T.ink,
  }

  return (
    <div style={card}>
      <div style={{ opacity: contentOpacity, padding: "20px 22px", width: place.w, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ filter: T.dark ? "grayscale(1) brightness(1.4)" : undefined, display: "flex" }}>
            <SourceMark source={scrap.source} size={28} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{scrap.name}</div>
        </div>
        <div style={{ fontSize: 21, color: T.graphite, marginTop: 6, marginBottom: 14 }}>{scrap.title}</div>
        <div style={{ height: 3, background: accent(T, scrap.source), opacity: 0.85, marginBottom: 10, width: 64 }} />
        {scrap.kind === "table" && <Table scrap={scrap} lit={lit} lifted={lifted} />}
        {scrap.kind === "bars" && <Bars scrap={scrap} />}
        {scrap.kind === "scatter" && <Scatter scrap={scrap} lit={lit} width={place.w - 44} />}
      </div>
    </div>
  )
}

/** The highlight the reader drags across a row: the pad's ruling wash, as the app's list rows. */
function useRowStyle() {
  const T = useTheme()
  return (isFocus: boolean, lit: number): CSSProperties => ({
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    padding: "7px 8px",
    margin: "0 -8px",
    borderRadius: 4,
    // The dark pad's wash is too close to its sheet, so the row there takes a lighter grey.
    background: isFocus ? `color-mix(in oklch, ${T.dark ? "oklch(0.34 0 0)" : T.wash} ${Math.round(lit * 100)}%, transparent)` : undefined,
    boxShadow: isFocus ? `inset 4px 0 0 color-mix(in oklch, ${T.pen} ${Math.round(lit * 100)}%, transparent)` : undefined,
    fontWeight: isFocus && lit > 0.5 ? 600 : undefined,
    color: isFocus && lit > 0 ? T.washInk : T.ink,
    borderTop: `1px solid color-mix(in oklch, ${T.ruling} 55%, transparent)`,
  })
}

function Table({ scrap, lit, lifted }: { scrap: Scrap; lit: number; lifted: boolean }) {
  const T = useTheme()
  const rowStyle = useRowStyle()
  return (
    <div style={{ fontSize: 21 }}>
      {scrap.rows!.map((row, index) => (
        <div key={row.model}>
          {/* A row from further down the board: the gap is marked, not hidden. */}
          {row.rank > index + 1 && (
            <div style={{ fontSize: 17, color: T.graphite, padding: "2px 0", borderTop: `1px solid color-mix(in oklch, ${T.ruling} 55%, transparent)` }}>
              ⋯ #{row.rank}
            </div>
          )}
          <div style={rowStyle(row.model === FOCUS, lit)}>
            <span
              style={{
                flex: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: 500,
                opacity: lifted && row.model === FOCUS ? 0 : 1,
              }}
            >
              {row.name}
            </span>
            {row.cells.map((cell, cellIndex) => (
              <span key={cellIndex} style={{ fontFamily: FONT.mono, fontSize: 16, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {cell}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Bars({ scrap }: { scrap: Scrap }) {
  const T = useTheme()
  const max = Math.max(...scrap.rows!.map((row) => row.value))
  return (
    <div style={{ fontSize: 20, display: "flex", flexDirection: "column", gap: 9 }}>
      {scrap.rows!.map((row) => (
        <div key={row.model}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500 }}>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "74%" }}>{row.name}</span>
            <span style={{ fontFamily: FONT.mono, fontSize: 16 }}>{row.cells[0]}</span>
          </div>
          <div style={{ height: 8, marginTop: 4, background: `color-mix(in oklch, ${T.ruling} 35%, transparent)`, borderRadius: 2 }}>
            <div style={{ height: 8, width: `${(row.value / max) * 100}%`, background: accent(T, scrap.source), opacity: 0.6, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** ARC Prize plots score against cost; the leaderboard's whole cloud, focus dot marked. */
function Scatter({ scrap, lit, width }: { scrap: Scrap; lit: number; width: number }) {
  const T = useTheme()
  const rowStyle = useRowStyle()
  const height = 186
  const dots = scrap.dots!
  const lx = (cost: number) => Math.log10(cost)
  const minX = Math.min(...dots.map((d) => lx(d.cost)))
  const maxX = Math.max(...dots.map((d) => lx(d.cost)))
  const sx = (cost: number) => 8 + ((lx(cost) - minX) / (maxX - minX)) * (width - 16)
  const sy = (score: number) => height - 8 - (score / 100) * (height - 16)
  const focus = scrap.focus!
  return (
    <div>
      <svg width={width} height={height} style={{ display: "block" }}>
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={T.ruling} />
        <line x1={1} y1={0} x2={1} y2={height} stroke={T.ruling} />
        {dots.map((dot, index) => (
          <circle key={index} cx={sx(dot.cost)} cy={sy(dot.score)} r={3.2} fill={accent(T, "arcPrize")} opacity={0.38} />
        ))}
        <circle cx={sx(focus.cost)} cy={sy(focus.score)} r={lerp(5, 11, lit)} fill="none" stroke={T.washInk} strokeWidth={2.5} opacity={lit} />
      </svg>
      <div style={{ ...rowStyle(true, lit), marginTop: 8, fontSize: 21 }}>
        <span style={{ flex: 1, fontWeight: 500 }}>{focus.name}</span>
        {focus.cells.map((cell) => (
          <span key={cell} style={{ fontFamily: FONT.mono, fontSize: 16 }}>
            {cell}
          </span>
        ))}
      </div>
    </div>
  )
}
