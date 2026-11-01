import { Easing, interpolate } from "remotion"

/** docs/DESIGN.md: the Graph Pad in light (cream stock) and dark (black sheet). */
export type Theme = {
  dark: boolean
  paper: string
  sheet: string
  ink: string
  pen: string
  graphite: string
  wash: string
  washInk: string
  ruling: string
  /** Floating-layer shadow plus its 10% ink ring. */
  float: string
  /** Vendor marks: lightness and chroma from the theme (styles.css --vendor-*). */
  vendorL: number
  vendorC: number
  inkSteps: [number, number, number]
  tintC: number
  labelL: number
  /** TokenWordmark rules: primary/70, accent-foreground/60, muted-foreground/50, border. */
  wordRules: [string, string, string, string]
}

export const LIGHT: Theme = {
  dark: false,
  paper: "oklch(0.962 0.014 88)",
  sheet: "oklch(0.982 0.009 88)",
  ink: "oklch(0.23 0.022 262)",
  pen: "oklch(0.44 0.085 222)",
  graphite: "oklch(0.45 0.028 250)",
  wash: "oklch(0.905 0.038 195)",
  washInk: "oklch(0.3 0.06 228)",
  ruling: "oklch(0.8 0.04 188)",
  float:
    "0 4px 6px -1px oklch(0.23 0.022 262 / 0.08), 0 2px 4px -2px oklch(0.23 0.022 262 / 0.08), 0 0 0 1.5px oklch(0.23 0.022 262 / 0.1)",
  vendorL: 0.58,
  vendorC: 0.145,
  inkSteps: [0.22, 0.34, 0.44],
  tintC: 0.045,
  labelL: 0.42,
  wordRules: [
    "oklch(0.44 0.085 222 / 0.7)",
    "oklch(0.3 0.06 228 / 0.6)",
    "oklch(0.45 0.028 250 / 0.5)",
    "oklch(0.8 0.04 188)",
  ],
}

export const DARK: Theme = {
  dark: true,
  paper: "oklch(0.13 0 0)",
  sheet: "oklch(0.17 0 0)",
  ink: "oklch(0.92 0 0)",
  pen: "oklch(0.96 0 0)",
  graphite: "oklch(0.68 0 0)",
  wash: "oklch(0.24 0 0)",
  washInk: "oklch(0.96 0 0)",
  ruling: "oklch(0.32 0 0)",
  float: "0 4px 6px -1px oklch(0 0 0 / 0.4), 0 2px 4px -2px oklch(0 0 0 / 0.4), 0 0 0 1.5px oklch(0.92 0 0 / 0.1)",
  vendorL: 0.76,
  vendorC: 0.13,
  inkSteps: [0.95, 0.87, 0.79],
  tintC: 0.035,
  labelL: 0.84,
  wordRules: ["oklch(0.96 0 0 / 0.7)", "oklch(0.92 0 0 / 0.6)", "oklch(0.68 0 0 / 0.5)", "oklch(0.32 0 0)"],
}

/** Vendor colours: hue from the brand, lightness and chroma from the theme (styles.css). */
export function vendorColor(T: Theme, model: { hue: number | null; shade: number | null }) {
  if (model.shade != null) return `oklch(${T.inkSteps[model.shade]} ${T.tintC} ${model.hue ?? 0})`
  return model.hue == null ? T.graphite : `oklch(${T.vendorL} ${T.vendorC} ${model.hue})`
}
/** A model's name keeps its vendor's hue at one label lightness (plot-labels.ts). */
export function vendorLabelColor(T: Theme, model: { hue: number | null; shade: number | null }) {
  const chroma = model.shade != null ? T.tintC : T.vendorC
  return `oklch(${T.labelL} ${chroma} ${model.hue ?? 0})`
}

export const FONT = {
  sans: '"Instrument Sans Variable", ui-sans-serif, system-ui, sans-serif',
  mono: '"Martian Mono Variable", ui-monospace, monospace',
  brand: '"Space Mono", ui-monospace, monospace',
} as const

export const W = 1920
export const H = 1080
export const FPS = 30

/**
 * The music's bar grid, measured with librosa (scripts/audio/analyze.py): "Serene View" at
 * 118.0 BPM, 4/4, one bar = 2.03379 s. Video frame 0 sits on a downbeat of the track.
 */
export const BAR_SECONDS = 2.0337915
export const BAR = BAR_SECONDS * FPS
export const BARS = 22
export const DURATION = Math.round(BARS * BAR)
/** First frame of bar `bar`, plus `beats` quarter notes. */
export const at = (bar: number, beats = 0) => Math.round((bar + beats / 4) * BAR)

// Curves from Emil Kowalski's animation guidelines (skills/animate/SKILL.md).
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1)
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1)
/** Gentler on-screen move, for big camera and data moves that should read as calm. */
export const easeInOutSoft = Easing.bezier(0.65, 0, 0.35, 1)

export function progress(
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = easeOut,
) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  })
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
