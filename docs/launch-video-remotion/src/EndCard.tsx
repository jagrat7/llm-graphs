import { Img, staticFile, useCurrentFrame } from "remotion"

import { useTheme } from "./theme-context"
import { at, easeInOutSoft, easeOut, FONT, lerp, progress } from "./theme"

/** brand-marks.tsx: the name as a tokenizer splits it, each token underlined in a theme ink. */
const TOKENS = ["LL", "M", " Graph", "s"]

/** The seal lands on the bar-20 downbeat (with its stamp), then the name is ruled in after it. */
export const END_START = at(20)

/**
 * The close: seal, wordmark and address. It is also the video's first frame, so the loop on
 * autoplay closes on itself: drawn from beat 3 of bar 19 to the last frame, and shown whole
 * for the first frames before the opening sheets land.
 */
export function EndCard() {
  const frame = useCurrentFrame()
  const T = useTheme()
  const head = 1 - progress(frame, 0, 10, easeInOutSoft)
  const tail = frame >= END_START ? 1 : 0
  if (head <= 0 && tail === 0) return null

  const t = (delay: number, duration = 16) => (frame < END_START ? 1 : progress(frame, END_START + delay, duration, easeOut))
  const opacity = frame < END_START ? head : 1

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 64, opacity }}>
      <Img
        src={staticFile("brand/logo512.png")}
        style={{ width: 236, height: 236, opacity: t(0, 10), transform: `scale(${lerp(0.96, 1, t(0, 10))})` }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <div
          style={{
            fontFamily: FONT.brand,
            fontWeight: 700,
            fontSize: 132,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: T.ink,
            whiteSpace: "pre",
            display: "flex",
            gap: 9,
          }}
        >
          {TOKENS.map((token, index) => {
            const drawn = t(8 + index * 4, 16)
            return (
              <span key={token} style={{ position: "relative", padding: "0 9px 34px", opacity: t(6, 12) }}>
                {token}
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 26,
                    background: T.wordRules[index],
                    clipPath: `inset(0 ${(1 - drawn) * 100}% 0 0)`,
                  }}
                />
              </span>
            )
          })}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 52,
            fontWeight: 500,
            color: T.pen,
            opacity: t(20),
            transform: `translateY(${lerp(10, 0, t(20))}px)`,
          }}
        >
          llm-graphs.jr7.dev
        </div>
      </div>
    </div>
  )
}
