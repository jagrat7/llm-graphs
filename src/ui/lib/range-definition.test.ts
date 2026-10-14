import { createChartRuntime, renderChartSvg } from "@tanstack/charts"
import type { ChartScene, SceneNode } from "@tanstack/charts"
import { describe, expect, it } from "vitest"

import type { PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { chartTooltip } from "#/ui/lib/chart-tooltip"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import { LABEL_EFFORT_SIZE } from "#/ui/lib/plot-labels"
import { rangeDefinition, rangeMinHeight } from "#/ui/lib/range-definition"

const info = ProvidersService.info()
const SIZE = { width: 1200, height: 640 }

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerMTokens = 4,
  configuration,
}: Partial<Model> & { model: string }): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName: model,
    vendor: model,
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: effort === "default" ? "unknown" : "on",
    level: effort === "default" ? "unknown" : effort,
    effort,
    effortOrder,
    score,
    costPerMTokens,
    ...(configuration ? { configuration } : {}),
    sources: {
      ...metricRecord<Model["sources"]["score"]>(() => null),
      score: "deepswe",
      costPerMTokens: "artificialAnalysis",
    },
  }
}

const models = [
  makeModel({ model: "astra", effort: "low", effortOrder: 1, score: 25, costPerMTokens: 20 }),
  makeModel({ model: "astra", effort: "high", effortOrder: 3, score: 41, costPerMTokens: 20 }),
  makeModel({ model: "sonnet", effort: "low", effortOrder: 1, score: 18 }),
  makeModel({ model: "sonnet", effort: "medium", effortOrder: 2, score: 29 }),
  makeModel({ model: "sonnet", effort: "high", effortOrder: 3, score: 45 }),
  makeModel({ model: "sonnet", effort: "high", score: 19, configuration: "between tools" }),
]

type Size = { width: number; height: number }

/** Lays the width-dependent definition out through the same runtime the adapter uses. */
function rangeScene(
  list: Array<Model>,
  {
    flat = "x",
    highlight = null,
    size = SIZE,
  }: { flat?: "x" | "y"; highlight?: string | null; size?: Size } = {},
) {
  const data = buildPlotData(
    list,
    flat === "x" ? { x: "price", y: "score" } : { x: "score", y: "price" },
  )
  const definition = rangeDefinition(data, {
    flat,
    highlight,
    info,
    logoClass: new Map(),
    sources:
      flat === "x"
        ? { x: "artificialAnalysis", y: "deepswe" }
        : { x: "deepswe", y: "artificialAnalysis" },
  })

  return createChartRuntime<PlotPoint>().render(definition, size)
}

function build(flat: "x" | "y", highlight: string | null = null) {
  return rangeScene(models, { flat, highlight })
}

function flatten(nodes: ReadonlyArray<SceneNode>): Array<SceneNode> {
  return nodes.flatMap((node) => (node.kind === "group" ? flatten(node.children) : [node]))
}

function find(chartScene: ChartScene, key: string) {
  return flatten(chartScene.nodes).find((node) => node.key === key)
}

function markerAt(chartScene: ChartScene, id: string) {
  const point = chartScene.points.find((candidate) => candidate.key.endsWith(`:${id}`))

  if (!point) throw new Error(`no point ${id}`)

  return point
}

describe("range definition", () => {
  it("keeps every effort an interactive point on its model's row", () => {
    const chartScene = build("x")
    const low = markerAt(chartScene, "sonnet-on-low")
    const high = markerAt(chartScene, "sonnet-on-high")

    expect(chartScene.points).toHaveLength(models.length)
    expect(low.y).toBe(high.y)
    // Efforts now spread along the score, left to right.
    expect(low.x).toBeLessThan(high.x)
  })

  it("orders rows by the shared metric, cheapest first", () => {
    const chartScene = build("x")
    const sonnet = markerAt(chartScene, "sonnet-on-low")
    const between = markerAt(chartScene, "sonnet-on-high-between tools")
    const astra = markerAt(chartScene, "astra-on-low")

    expect(sonnet.y).not.toBe(between.y)
    expect(Math.max(sonnet.y, between.y)).toBeLessThan(astra.y)
  })

  it("lays rows out the same way when the shared metric is on the vertical axis", () => {
    const chartScene = build("y")
    const low = markerAt(chartScene, "sonnet-on-low")
    const high = markerAt(chartScene, "sonnet-on-high")

    expect(low.y).toBe(high.y)
    expect(low.x).toBeLessThan(high.x)
  })

  it("draws each run as a span from its lowest to its highest effort", () => {
    const chartScene = build("x")
    const span = find(chartScene, "model-runs-0:line:sonnet")

    expect(span).toMatchObject({ kind: "polyline" })
    if (span?.kind !== "polyline") return

    const xs = span.points.map(([x]) => x)

    expect(xs).toHaveLength(2)
    expect(xs[0]).toBeCloseTo(markerAt(chartScene, "sonnet-on-low").x)
    expect(xs[1]).toBeCloseTo(markerAt(chartScene, "sonnet-on-high").x)
    expect(span.style?.strokeWidth).toBeGreaterThan(2)
  })

  it("names each effort under its marker and each row by model and fixed value", () => {
    const svg = renderChartSvg(build("x"), { ariaLabel: "Ranges" })

    for (const effort of ["low", "medium", "high"]) expect(svg).toContain(`>${effort}<`)
    expect(svg).toContain("sonnet (between tools)")
    expect(svg).toMatch(/astra · \$20/)
    expect(svg).toContain("Score (%)")
    // The rows are models, so the axis title says so rather than reading as a price scale.
    expect(svg).toContain("Models, sorted by token price ($/M)")
  })

  it("dims every other row while one model is highlighted", () => {
    const chartScene = build("x", "astra")

    expect(find(chartScene, "model-runs-0:sonnet-on-low")?.style?.opacity).toBeLessThan(1)
    expect(find(chartScene, "model-runs-0:astra-on-low")?.style?.opacity).toBe(1)
  })

  it("moves a crowded effort name above its marker instead of dropping it", () => {
    const close = [
      makeModel({ model: "gemini", effort: "medium", effortOrder: 2, score: 50 }),
      makeModel({ model: "gemini", effort: "high", effortOrder: 3, score: 50.6 }),
      makeModel({ model: "kimi", effort: "low", effortOrder: 1, score: 20, costPerMTokens: 6 }),
      makeModel({ model: "kimi", effort: "high", effortOrder: 3, score: 30, costPerMTokens: 6 }),
    ]
    const chartScene = rangeScene(close)
    const medium = find(chartScene, "effort-labels-1:gemini-on-medium")
    const high = find(chartScene, "effort-labels-1:gemini-on-high")
    const row = markerAt(chartScene, "gemini-on-high").y

    expect(medium).toMatchObject({ kind: "label", text: "medium" })
    expect(high).toMatchObject({ kind: "label", text: "high" })
    if (medium?.kind !== "label" || high?.kind !== "label") return
    expect(medium.y).toBeGreaterThan(row)
    expect(high.y).toBeLessThan(row)
  })

  it("captions a model whose efforts differ on the shared metric with its whole span", () => {
    const svg = renderChartSvg(
      rangeScene([
        ...models,
        makeModel({ model: "mixed", effort: "low", effortOrder: 1, score: 30, costPerMTokens: 2 }),
        makeModel({
          model: "mixed",
          effort: "high",
          effortOrder: 3,
          score: 40,
          costPerMTokens: 20,
        }),
      ]),
      { ariaLabel: "Ranges" },
    )

    expect(svg).toMatch(/mixed · \$2(\.00)?–\$20/)
  })

  it("shortens long model names on a narrow chart but keeps each row's value", () => {
    const long = [
      makeModel({ model: "a-very-long-model-name-from-a-vendor", effort: "low", score: 20 }),
      makeModel({ model: "a-very-long-model-name-from-a-vendor", effort: "high", score: 40 }),
    ]
    const narrow = rangeScene(long, { size: { width: 360, height: 400 } })
    const svg = renderChartSvg(narrow, { ariaLabel: "Ranges" })

    expect(svg).toMatch(/a-very-long-mo[^<]*… · \$4/)
    expect(narrow.chart.width).toBeGreaterThan(360 * 0.5)
    const xs = narrow.points.map((point) => point.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(narrow.chart.width * 0.8)
  })

  it("never lets an effort name leave its row or the plot", () => {
    const crowd = Array.from({ length: 20 }, (_, index) => [
      makeModel({ model: `m${index}`, effort: "low", score: 20 + index, costPerMTokens: index }),
      makeModel({ model: `m${index}`, effort: "high", score: 21 + index, costPerMTokens: index }),
    ]).flat()

    for (const height of [476, rangeMinHeight(20)]) {
      const chartScene = rangeScene(crowd, { size: { width: 1200, height } })
      const rows = [...new Set(chartScene.points.map((point) => point.y))].toSorted((a, b) => a - b)
      const half = (rows[1] - rows[0]) / 2
      const effortLabels = flatten(chartScene.nodes).filter(
        (node) => node.kind === "label" && node.key.startsWith("effort-labels"),
      )

      for (const label of effortLabels) {
        if (label.kind !== "label") continue
        const row = rows.reduce((best, y) =>
          Math.abs(y - label.y) < Math.abs(best - label.y) ? y : best,
        )

        // The baseline sits below the text; the cap height is about the font size.
        expect(label.y - LABEL_EFFORT_SIZE).toBeGreaterThanOrEqual(row - half)
        expect(label.y).toBeLessThanOrEqual(row + half)
        expect(label.y).toBeLessThanOrEqual(chartScene.chart.y + chartScene.chart.height)
      }

      // With room for every row, no effort loses its name.
      if (height === rangeMinHeight(20)) expect(effortLabels).toHaveLength(crowd.length)
    }
  })

  it("opens a phone's card beside the focused row, not at the top of a tall chart", () => {
    const crowd = Array.from({ length: 20 }, (_, index) => [
      makeModel({ model: `m${index}`, effort: "low", score: 20 + index, costPerMTokens: index }),
      makeModel({ model: `m${index}`, effort: "high", score: 21 + index, costPerMTokens: index }),
    ]).flat()
    const size = { width: 360, height: rangeMinHeight(20) }
    const chartScene = rangeScene(crowd, { size })
    const lowest = chartScene.points.reduce((last, point) => (point.y > last.y ? point : last))
    const data = buildPlotData(crowd, { x: "price", y: "score" })
    const sources = { x: "artificialAnalysis", y: "deepswe" } as const
    const context = {
      focus: { primary: lowest, group: [lowest], source: "pointer" as const, pinned: false },
      pointer: null,
      plot: chartScene.chart,
      surface: size,
      scales: {},
    }
    const anchorOf = (rows: boolean) => {
      const { anchor } = chartTooltip(data, sources, info, { rows })

      return typeof anchor === "function" ? anchor([lowest], context) : null
    }

    expect(lowest.y).toBeGreaterThan(size.height / 2)
    expect(anchorOf(true)).toEqual({ x: chartScene.chart.x + chartScene.chart.width, y: lowest.y })
    // The scatter keeps its fixed-height frame, so its card stays in the top corner.
    expect(anchorOf(false)?.y).toBe(chartScene.chart.y)
  })

  it("ticks a duration on whole minutes when it is the metric that varies", () => {
    const timed = models.map((model, index) => ({
      ...model,
      durationSeconds: [520, 1960, 310, 640, 1180, 900][index],
      sources: { ...model.sources, durationSeconds: "deepswe" as const },
    }))
    const data = buildPlotData(timed, { x: "duration", y: "price" })
    const svg = renderChartSvg(
      createChartRuntime<PlotPoint>().render(
        rangeDefinition(data, {
          flat: "y",
          highlight: null,
          info,
          logoClass: new Map(),
          sources: { x: "deepswe", y: "artificialAnalysis" },
        }),
        SIZE,
      ),
      { ariaLabel: "Ranges" },
    )

    expect(svg).toContain(">Task duration<")
    expect(svg).toMatch(/>\d+m</)
    expect(svg).not.toMatch(/>\d+m \d+s</)
  })
})
