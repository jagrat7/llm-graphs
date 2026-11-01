import { loadFont } from "@remotion/fonts"
import { staticFile } from "remotion"

// The app's own faces (docs/DESIGN.md), from the same @fontsource packages it ships.
export const fontsReady = Promise.all([
  loadFont({ family: "Instrument Sans Variable", url: staticFile("fonts/instrument-sans.woff2"), weight: "400 700" }),
  loadFont({ family: "Martian Mono Variable", url: staticFile("fonts/martian-mono.woff2"), weight: "100 800" }),
  loadFont({ family: "Space Mono", url: staticFile("fonts/space-mono-700.woff2"), weight: "700" }),
  loadFont({ family: "Space Mono", url: staticFile("fonts/space-mono-400.woff2"), weight: "400" }),
])
