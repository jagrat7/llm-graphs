import { Composition } from "remotion"

import { Launch } from "./Launch"
import { DURATION, FPS, H, W } from "./theme"

export function Root() {
  return (
    <>
      <Composition id="Launch" component={Launch} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ theme: "light" as const }} />
      <Composition id="LaunchDark" component={Launch} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ theme: "dark" as const }} />
    </>
  )
}
