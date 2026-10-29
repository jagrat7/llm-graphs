import { useEffect, useState } from "react"
import type { ChartTextMeasureOptions, ChartTextMeasurer, ChartTextMetrics } from "@tanstack/charts"

import { CHART_MONO_TICK_SIZE, CHART_MONO_WIDTH_RATIO } from "#/ui/lib/chart-styles"
import { LABEL_WIDTH_RATIO } from "#/ui/lib/plot-labels"

/**
 * Tick labels are drawn in the mono face (see `styles.css`), which the library cannot
 * see: its own measurer sizes them in the chart's sans face, so the axis title lands on
 * the widest one. This measures them in the face they are painted in. Tick labels are
 * the only chart text at `CHART_MONO_TICK_SIZE`, which is how they are told apart.
 */
function chartTextMeasurer(monoFamily: string): ChartTextMeasurer {
  const context = document.createElement("canvas").getContext("2d")
  const cache = new Map<string, ChartTextMetrics>()

  return (text, options) => {
    const mono = options.fontSize === CHART_MONO_TICK_SIZE
    const fontFamily = mono ? monoFamily : options.fontFamily
    const key = `${fontFamily}\0${options.fontSize}\0${options.fontWeight ?? ""}\0${options.anchor}\0${options.baseline}\0${text}`
    let metrics = cache.get(key)

    if (!metrics) {
      metrics = context
        ? paintedBounds(context, text, { ...options, fontFamily })
        : estimatedBounds(text, options, mono ? CHART_MONO_WIDTH_RATIO : LABEL_WIDTH_RATIO)
      cache.set(key, metrics)
    }

    return metrics
  }
}

/** The same painted box the library's own DOM measurer reports. */
function paintedBounds(
  context: CanvasRenderingContext2D,
  text: string,
  options: ChartTextMeasureOptions,
): ChartTextMetrics {
  const fontSize = options.fontSize * options.fontScale

  context.font = [
    options.fontStyle,
    options.fontWeight ?? 400,
    `${fontSize}px`,
    options.fontFamily,
  ].join(" ")
  context.letterSpacing = `${options.letterSpacing * options.fontScale}px`
  context.textAlign = options.anchor === "middle" ? "center" : options.anchor
  context.textBaseline = options.baseline === "auto" ? "alphabetic" : options.baseline
  context.direction = options.direction

  const measured = context.measureText(text)
  const left = measured.actualBoundingBoxLeft
  const ascent = measured.actualBoundingBoxAscent

  return {
    x: -left,
    y: -ascent,
    width: left + measured.actualBoundingBoxRight,
    height: ascent + measured.actualBoundingBoxDescent,
  }
}

function estimatedBounds(
  text: string,
  options: ChartTextMeasureOptions,
  widthRatio: number,
): ChartTextMetrics {
  const fontSize = options.fontSize * options.fontScale
  const width = text.length * fontSize * widthRatio
  const x = options.anchor === "middle" ? -width / 2 : options.anchor === "end" ? -width : 0
  const y =
    options.baseline === "middle"
      ? -fontSize / 2
      : options.baseline === "hanging"
        ? 0
        : -fontSize * 0.8

  return { x, y, width, height: fontSize }
}

/**
 * A measurer for the chart's `measureText`. Passing one turns off the library's relayout
 * when web fonts arrive, so a fresh measurer is made whenever they do: its new identity is
 * what makes the chart lay out again. Undefined on the server and before mount, where the
 * library's estimates stand in.
 */
export function useChartTextMeasurer() {
  const [measurer, setMeasurer] = useState<ChartTextMeasurer>()

  useEffect(() => {
    const fonts = document.fonts
    const monoFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() ||
      "monospace"
    const update = () => setMeasurer(() => chartTextMeasurer(monoFamily))

    update()
    fonts?.addEventListener("loadingdone", update)

    return () => fonts?.removeEventListener("loadingdone", update)
  }, [])

  return measurer
}
