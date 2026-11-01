import { useCurrentFrame } from "remotion"

import { END_START } from "./EndCard"
import { useTheme } from "./theme-context"
import { at, easeOut, progress } from "./theme"

/** Ruled in fours, as the app's plot is (paper-rulings.ts): 30 px squares, a major line every 120 px. */
const SQUARE = 30
const MAJOR = 4

/**
 * The pad itself. Its uniform rulings carry the opening and the close; while the chart is on,
 * the chart's own rulings are the graph paper, so the pad's step back.
 */
export function Pad() {
  const frame = useCurrentFrame()
  const T = useTheme()
  const away = progress(frame, at(4) + 30, 30, easeOut)
  const back = progress(frame, END_START - 10, 24, easeOut)
  const strength = 1 - away + back
  const [major, minor] = T.dark ? [0.75, 0.38] : [0.42, 0.2]
  const lines = []
  for (let i = 0, x = 0; x <= 1920; i += 1, x += SQUARE) {
    const isMajor = i % MAJOR === 0
    lines.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={1080} stroke={T.ruling} strokeOpacity={isMajor ? major : minor} strokeWidth={isMajor ? 1.25 : 1} />)
  }
  for (let i = 0, y = 0; y <= 1080; i += 1, y += SQUARE) {
    const isMajor = i % MAJOR === 0
    lines.push(<line key={`h${i}`} x1={0} y1={y} x2={1920} y2={y} stroke={T.ruling} strokeOpacity={isMajor ? major : minor} strokeWidth={isMajor ? 1.25 : 1} />)
  }
  return (
    <div style={{ position: "absolute", inset: 0, background: T.paper }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: strength }}>
        {lines}
      </svg>
    </div>
  )
}
