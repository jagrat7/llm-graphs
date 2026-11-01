import { AbsoluteFill } from "remotion"

import "./fonts"
import { Chart } from "./Chart"
import { EndCard } from "./EndCard"
import { Headline } from "./Headline"
import { Pad } from "./Pad"
import { Scraps } from "./Scraps"
import { ShareMenu } from "./ShareMenu"
import { ThemeContext } from "./theme-context"
import { DARK, LIGHT } from "./theme"

export type LaunchProps = { theme: "light" | "dark" }

/**
 * One sheet of graph paper for the whole film: ten leaderboards land on it, fold into one
 * chart, the chart shows what it can do, and the sheet closes on the wordmark. The same
 * timeline renders on the light pad or the dark one.
 */
export function Launch({ theme }: LaunchProps) {
  const T = theme === "dark" ? DARK : LIGHT
  return (
    <ThemeContext.Provider value={T}>
      <AbsoluteFill style={{ background: T.paper }}>
        <Pad />
        <Scraps />
        <Chart />
        <Headline />
        <ShareMenu />
        <EndCard />
      </AbsoluteFill>
    </ThemeContext.Provider>
  )
}
