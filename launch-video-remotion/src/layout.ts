/**
 * The frame's grid. Safe margins at 1080p: 72 top, 56 right, 96 bottom, 84 left; the headline
 * sits in the top band and the plot fills the rest, the way the app gives the chart the page.
 */
export const MARGIN = { top: 72, right: 56, bottom: 96, left: 84 } as const

export const HEADLINE = { x: MARGIN.left, y: MARGIN.top, size: 64 } as const

export const PLOT = {
  left: 236,
  top: 214,
  width: 1600,
  height: 660,
} as const

export const PLOT_RIGHT = PLOT.left + PLOT.width
export const PLOT_BOTTOM = PLOT.top + PLOT.height
export const PLOT_CX = PLOT.left + PLOT.width / 2
export const PLOT_CY = PLOT.top + PLOT.height / 2
