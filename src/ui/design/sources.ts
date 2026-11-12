// The project's files as text, for the design page to read: Vite's version. (Where there is no
// Vite, read the same files on the server instead: the skill's adapting.md.)
//
// Every path here is relative to this file. Vite wants each glob's options written out in place.
// `app` paths are rewritten to start at the repo root.

import shadcn from "../../../components.json"
import stylesheet from "../styles.css?raw"
import preset from "./shadcn-preset.gen.json"
import type { Sources } from "./types"

/**
 * styles.css has a second `:root` block: the density steps (`--control-*`, `--header-height`),
 * which a coarse pointer raises in `@media (pointer: coarse)`. They are no theme's, and the page
 * would restate them on `html[data-design-theme]`, which outranks the media query's `:root` and
 * pins touch devices to the fine-pointer steps. So the page gets the stylesheet with only the
 * `:root` block that holds the theme (the one with `--background`).
 */
const css = stylesheet.replace(/^:root\s*\{[^}]*\}/gm, (block) =>
  block.includes("--background:") ? block : "",
)

export const sources: Sources = {
  css,
  cssFile: "src/ui/styles.css",
  shadcn,
  preset,
  components: Object.entries(
    import.meta.glob<string>("../components/ui/*.tsx", {
      eager: true,
      query: "?raw",
      import: "default",
    }),
  ).map(([path, code]) => ({ name: path.slice(path.lastIndexOf("/") + 1, -".tsx".length), code })),
  // Every source file that can import a component, but not this page, and nothing that can't
  // load in the browser (server-only and generated files).
  app: Object.entries(
    import.meta.glob<string>(
      ["../**/*.{ts,tsx}", "!./**", "!../**/*.server.*", "!../**/*.gen.*", "!../**/*.test.*"],
      {
        eager: true,
        query: "?raw",
        import: "default",
      },
    ),
  ).map(([path, code]) => ({ path: `src/ui/${path.slice("../".length)}`, code })),
}
