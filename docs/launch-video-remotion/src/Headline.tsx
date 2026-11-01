import type { ReactNode } from "react"

import { useCurrentFrame } from "remotion"

import { RolodexFlip } from "@/components/remocn/rolodex-flip"

import { HEADLINE } from "./layout"
import { useTheme } from "./theme-context"
import { at, BAR, easeInOutSoft, easeOut, FONT, lerp, progress } from "./theme"

/**
 * How a line arrives. "rise" is a short fade-up for the story's turns; "wipe" draws the line
 * left to right like the pen that rules the pad, for the lines that name what the chart does.
 */
type Line = { from: number; to: number; enter: "rise" | "wipe"; content: ReactNode }

const SWITCH_SOURCES = ["DeepSWE", "Terminal-Bench 4.0", "ARC-AGI-2", "DeepSWE"]

/** One line at a time, in the top band. Each lands on a downbeat. */
const LINES: Array<Line> = [
  { from: 6, to: at(2), enter: "rise", content: "Ten leaderboards. Ten tables. No common scale." },
  { from: at(2), to: at(4), enter: "rise", content: "Just to find out which model is good at what." },
  { from: at(4), to: at(6), enter: "rise", content: "So I put them all in one place." },
  {
    from: at(6),
    to: at(10),
    enter: "wipe",
    content: (
      <>
        Score against task cost on{" "}
        <RolodexFlip items={SWITCH_SOURCES} from={at(7)} interval={BAR} flipDuration={16} style={{ color: "var(--pen)", textDecoration: "underline", textDecorationThickness: 4, textUnderlineOffset: 10 }} />
      </>
    ),
  },
  { from: at(10), to: at(12), enter: "wipe", content: "Nothing here beats the dashed line on both cost and score." },
  { from: at(12), to: at(14), enter: "wipe", content: "Each reasoning level is its own point, with its source." },
  { from: at(14), to: at(16), enter: "wipe", content: "Add a third axis and the chart becomes a cube." },
  { from: at(16), to: at(19), enter: "rise", content: "Share it as a link, an image or the data." },
]


export function Headline() {
  const frame = useCurrentFrame()
  const T = useTheme()
  return (
    <>
      {LINES.map((line, index) => {
        if (frame < line.from - 1 || frame > line.to + 1) return null
        const leave = progress(frame, line.to - 8, 8, easeOut)
        const rise = progress(frame, line.from, 18, easeOut)
        const wipe = progress(frame, line.from, 22, easeInOutSoft)
        const opacity = (line.enter === "rise" ? rise : Math.min(1, wipe * 3)) * (1 - leave)
        if (opacity <= 0) return null
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: HEADLINE.x,
              top: HEADLINE.y - 10,
              fontFamily: FONT.sans,
              fontSize: HEADLINE.size,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
              color: T.ink,
              ["--pen" as string]: T.pen,
              whiteSpace: "nowrap",
              opacity,
              clipPath: line.enter === "wipe" ? `inset(-20% ${(1 - wipe) * 100}% -20% 0)` : undefined,
              transform: line.enter === "rise" ? `translateY(${lerp(14, 0, rise)}px)` : undefined,
            }}
          >
            {line.content}
          </div>
        )
      })}
    </>
  )
}

