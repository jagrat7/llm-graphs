/**
 * Visual constants shared by the TanStack Charts (SVG) and React Three Fiber (WebGL/DOM) charts.
 * The two renderers draw with different primitives, so without a single source here
 * their type sizes, grid weights and emphasis ratios drift apart on sight.
 */
export const CHART_AXIS_TITLE_SIZE = 12.5
export const CHART_TICK_SIZE = 12
/**
 * The 2D chart's tick labels, drawn in the mono face. Martian Mono runs wide, so they
 * step down from `CHART_TICK_SIZE`. No other chart text uses this size, which is how the
 * chart's text measurer finds them (see `chart-text.ts`).
 */
export const CHART_MONO_TICK_SIZE = 10.5
/** Martian Mono's advance as a share of the font size: every glyph is this wide. */
export const CHART_MONO_WIDTH_RATIO = 0.7
export const CHART_POINT_LABEL_SIZE = 10.5
/** Primary grid lines; the 2D chart's cross-axis lines step down to the minor value. */
export const CHART_GRID_OPACITY = 0.55
export const CHART_GRID_MINOR_OPACITY = 0.28
/** How much a point grows when it becomes the active one. */
export const CHART_ACTIVE_SCALE = 1.4
export const CHART_TOOLTIP_WIDTH = 200
export const CHART_TOOLTIP_GAP = 12
/** The floating point readout's card, shared by both chart renderers. */
export const CHART_TOOLTIP_CARD_CLASS =
  "rounded-md border border-border/40 bg-background/15 p-2.5 text-foreground shadow-sm backdrop-blur-sm"
/** The card plus the fade the 3D chart drives itself; the 2D chart's host owns visibility. */
export const CHART_TOOLTIP_CLASS = `pointer-events-none z-10 ${CHART_TOOLTIP_CARD_CLASS} transition-opacity duration-150 ease-out`
/** ease-out-quart, matching the transition curve in `styles.css`. */
export const CHART_EASE = [0.22, 1, 0.36, 1] as const
export const CHART_TRANSITION_MS = 200

/** SVG takes these as numbers; the DOM label layer needs them as CSS lengths. */
export function chartFontRem(size: number) {
  return `${size / 16}rem`
}
