/**
 * A chart takes whatever height its page leaves below the controls (see `PAGE_FILL_CLASS`), so
 * a tall screen gets a tall plot instead of a guessed height and a gap below it. The floor keeps
 * it a readable plot in a short window, where the page scrolls instead. A phone stacks the
 * controls under the chart, so there the chart takes most of a screen of its own above them.
 * Small-viewport units, so a mobile browser's toolbar showing or hiding never resizes the plot.
 * A frame whose plot needs more room (the range view's rows) grows past the floor with it.
 */
export const CHART_FRAME_CLASS = "min-h-[32rem] max-sm:min-h-[max(32rem,70svh)] flex-1"
/**
 * Every chart's toolbar, above the plot rather than over it, since the plot's corners are
 * where points land. From `sm` up it is one row: the chart's controls on the left, Import and
 * Share on the right. A phone has no room for both, so there each group takes a centered row.
 */
export const CHART_TOOLBAR_CLASS = "flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pb-2"
export const CHART_TOOLBAR_CONTROLS_CLASS =
  "flex flex-wrap items-center gap-2 max-sm:basis-full max-sm:justify-center"
export const CHART_TOOLBAR_ACTIONS_CLASS =
  "ml-auto flex items-center gap-2 max-sm:ml-0 max-sm:basis-full max-sm:justify-center"
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
