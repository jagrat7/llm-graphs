import type { CSSProperties } from "react"

/**
 * A chart takes whatever height its page leaves below the controls (see `PAGE_FILL_CLASS`), so
 * a tall screen gets a tall plot instead of a guessed height and a gap below it. The floor keeps
 * it a readable plot in a short window, where the page scrolls instead. A phone's stacked
 * controls leave too little below them, so there the chart takes most of a screen of its own.
 * Small-viewport units, so a mobile browser's toolbar showing or hiding never resizes the plot.
 * A frame that needs more room raises the floor through `CHART_MIN_HEIGHT_VAR`, never past it.
 */
export const CHART_FRAME_CLASS =
  "min-h-[max(32rem,var(--chart-min-height,0px))] max-sm:min-h-[max(32rem,70svh,var(--chart-min-height,0px))] flex-1"
/** A frame whose content needs more than the floor (the range view's rows) asks through this. */
export const CHART_MIN_HEIGHT_VAR = "--chart-min-height"
export type ChartFrameStyle = CSSProperties & { [CHART_MIN_HEIGHT_VAR]?: string }
/** The 2D chart's toolbar row above its plot, which a frame's minimum has to make room for. */
export const CHART_TOOLBAR_HEIGHT_PX = 40
export const TABLE_WIDTH_CLASS = "w-full min-w-[52rem]"
/**
 * Every leaderboard cell, heading row included, shared with its skeleton so the loading
 * frame never jumps. A 44px row on both pointers, which also clears a heading's sort button
 * at its touch size.
 */
export const TABLE_CELL_CLASS = "h-11 px-3"

/**
 * The page's column: its width and its gutters. The app bar and every page share it, so
 * the wordmark's left edge lines up with the content below it at every width. It stops at
 * 1920px: past that a full-width plot turns into a strip (over 3:1 on an ultrawide), and the
 * chart's own text, drawn at a fixed size, gets lost in it.
 */
export const PAGE_COLUMN_CLASS = "mx-auto w-full max-w-[120rem] px-4 sm:px-6 2xl:px-10"

/** A page that fills the viewport below the app bar as a column, so its last block takes the rest. */
export const PAGE_FILL_CLASS = "flex min-h-[calc(100svh-var(--header-height))] flex-col"

/**
 * A checkable row in a list: the model checklist and the settings' provider list are the
 * same control, so they share one height and one text step.
 */
export const CHECK_ROW_CLASS =
  "hover:bg-muted min-h-control-md text-control flex cursor-pointer items-center gap-2 rounded-md px-1.5"
