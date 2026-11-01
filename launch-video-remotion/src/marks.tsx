import { Img, staticFile } from "remotion"

import type { Logo } from "./data"

import { DATA } from "./data"
import { useTheme } from "./theme-context"

/** A vendor logo in one colour, the way the chart masks it (comparison-chart.tsx). */
export function LogoGlyph({
  logo,
  size,
  color,
  x = 0,
  y = 0,
  opacity = 1,
}: {
  logo: Logo
  size: number
  color: string
  x?: number
  y?: number
  opacity?: number
}) {
  return (
    <svg
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      viewBox={logo.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ color, fill: color, overflow: "visible" }}
      opacity={opacity}
      // The logo markup comes from the app's own snapshot (models.dev / vendor marks).
      dangerouslySetInnerHTML={{ __html: logo.body }}
    />
  )
}

/** The benchmark's own mark, as source-logo.tsx draws it, in the theme's variant. */
export function SourceMark({ source, size }: { source: string; size: number }) {
  const T = useTheme()
  const mark = DATA.sourceMarks[source]
  if (!mark) return null
  if ("src" in mark) {
    return (
      <Img
        src={staticFile(mark.src.replace(/^\//, ""))}
        style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      />
    )
  }
  const color =
    typeof mark.brand === "string" ? mark.brand : mark.brand == null ? T.ink : T.dark ? mark.brand.dark : mark.brand.light
  return (
    <svg viewBox={mark.viewBox} width={size} height={size} style={{ flexShrink: 0 }}>
      {mark.paths.map((d) => (
        <path
          key={d.slice(0, 24)}
          d={d}
          fill={mark.stroke ? "none" : color}
          stroke={mark.stroke ? color : undefined}
          strokeWidth={mark.stroke ? 2 : undefined}
          strokeLinecap={mark.stroke ? "round" : undefined}
          strokeLinejoin={mark.stroke ? "round" : undefined}
        />
      ))}
    </svg>
  )
}
