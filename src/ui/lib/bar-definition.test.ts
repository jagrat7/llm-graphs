import { createChartRuntime, renderChartSvg } from "@tanstack/charts"
import type { ChartScene, SceneNode } from "@tanstack/charts"
import { describe, expect, it } from "vitest"

import type { PlotPoint } from "#/ui/lib/comparison-plot-data"
import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import {
  barDefinition,
  barsMinWidth,
  captionLines,
  effortLetter,
  layoutBars,
} from "#/ui/lib/bar-definition"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import { barGroups } from "#/ui/lib/stacking"

const info = ProvidersService.info()
const SIZE = { width: 1200, height: 640 }
const COLOR = "oklch(0.62 0.15 339)"

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
    chartColor: COLOR,
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

function plotData(list: Array<Model>, flat: "x" | "y" = "x") {
  return buildPlotData(list, flat === "x" ? { x: "price", y: "score" } : { x: "score", y: "price" })
}

/** Lays the width-dependent definition out through the same runtime the adapter uses. */
function barScene(
  list: Array<Model>,
  {
    flat = "x",
    highlight = null,
    size = SIZE,
  }: { flat?: "x" | "y"; highlight?: string | null; size?: Size } = {},
) {
  const definition = barDefinition(plotData(list, flat), {
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

function flatten(nodes: ReadonlyArray<SceneNode>): Array<SceneNode> {
  return nodes.flatMap((node) => (node.kind === "group" ? flatten(node.children) : [node]))
}

function find(chartScene: ChartScene, key: string) {
  return flatten(chartScene.nodes).find((node) => node.key === key)
}

function bar(chartScene: ChartScene, id: string) {
  const node = find(chartScene, `effort-bars-0:${id}`)

  if (node?.kind !== "rect") throw new Error(`no bar ${id}`)

  return node
}

function labels(chartScene: ChartScene, suffix: string) {
  return flatten(chartScene.nodes).filter(
    (node) => node.kind === "label" && node.key.endsWith(suffix),
  )
}

describe("bar definition", () => {
  it("draws one interactive bar per effort, as tall as the varying metric", () => {
    const chartScene = barScene(models)
    const low = bar(chartScene, "sonnet-on-low")
    const medium = bar(chartScene, "sonnet-on-medium")
    const high = bar(chartScene, "sonnet-on-high")

    expect(chartScene.points).toHaveLength(models.length)
    expect(low.height).toBeLessThan(medium.height)
    expect(medium.height).toBeLessThan(high.height)
    // A model's efforts stand side by side, lowest first.
    expect(low.x).toBeLessThan(medium.x)
    expect(medium.x).toBeLessThan(high.x)
  })

  it("stands every bar on zero", () => {
    const chartScene = barScene(models)
    const baseline = find(chartScene, "effort-bars-0:baseline")

    expect(baseline).toMatchObject({ kind: "rule" })
    if (baseline?.kind !== "rule") return
    for (const id of ["sonnet-on-low", "astra-on-high"]) {
      const node = bar(chartScene, id)

      expect(node.y + node.height).toBeCloseTo(baseline.y1)
    }
  })

  it("orders groups by the shared metric, cheapest first", () => {
    const chartScene = barScene(models)
    const sonnet = bar(chartScene, "sonnet-on-high")
    const between = bar(chartScene, "sonnet-on-high-between tools")
    const astra = bar(chartScene, "astra-on-low")

    expect(Math.max(sonnet.x, between.x)).toBeLessThan(astra.x)
  })

  it("lays groups out the same way when the shared metric is on the vertical axis", () => {
    const chartScene = barScene(models, { flat: "y" })
    const low = bar(chartScene, "sonnet-on-low")
    const high = bar(chartScene, "sonnet-on-high")

    expect(low.x).toBeLessThan(high.x)
    expect(low.height).toBeLessThan(high.height)
    expect(renderChartSvg(chartScene, { ariaLabel: "Bars" })).toContain("Score (%)")
  })

  it("fades lower efforts toward the sheet and keeps the top effort's own colour", () => {
    const chartScene = barScene(models)

    expect(bar(chartScene, "sonnet-on-high").style?.fill).toBe(COLOR)
    expect(bar(chartScene, "sonnet-on-low").style?.fill).toContain("var(--effort-fade)")
    // A single-effort model has nothing to fade from.
    expect(bar(chartScene, "sonnet-on-high-between tools").style?.fill).toBe(COLOR)
  })

  it("letters each effort under its bar and captions each group by model and fixed value", () => {
    const svg = renderChartSvg(barScene(models), { ariaLabel: "Bars" })

    for (const letter of ["L", "M", "H"]) expect(svg).toContain(`>${letter}<`)
    expect(svg).toContain(">sonnet (between tools)<")
    expect(svg).toContain(">astra<")
    expect(svg).toContain(">$20<")
    expect(svg).toContain("Score (%)")
    // The groups are models, so the axis title says so rather than reading as a price scale.
    expect(svg).toContain("Models, sorted by token price ($/M)")
  })

  it("puts each bar's value over it", () => {
    const svg = renderChartSvg(barScene(models), { ariaLabel: "Bars" })

    for (const value of ["18%", "29%", "45%", "41%"]) expect(svg).toContain(`>${value}<`)
  })

  it("leaves a configuration out of a group whose name no other group shares", () => {
    const harness = "Cursor agent · CursorBench 4.0"
    const svg = renderChartSvg(
      barScene([
        makeModel({ model: "astra", effort: "low", configuration: harness }),
        makeModel({ model: "sonnet", effort: "low", configuration: harness }),
      ]),
      { ariaLabel: "Bars" },
    )

    expect(svg).toContain(">astra<")
    expect(svg).not.toMatch(/>[^<]*Cursor agent[^<]*</)
  })

  it("captions a model whose efforts differ on the shared metric with its whole span", () => {
    const svg = renderChartSvg(
      barScene([
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
      { ariaLabel: "Bars" },
    )

    expect(svg).toMatch(/>\$2(\.00)?–\$20</)
  })

  it("dims every other group while one model is highlighted", () => {
    const chartScene = barScene(models, { highlight: "astra" })

    expect(bar(chartScene, "sonnet-on-low").style?.opacity).toBeLessThan(1)
    expect(bar(chartScene, "astra-on-low").style?.opacity).toBe(1)
  })

  it("drops a value label that would collide with its neighbour's, never overlapping two", () => {
    const even = Array.from({ length: 6 }, (_, index) =>
      makeModel({
        model: "even",
        effort: ["minimal", "low", "medium", "high", "xhigh", "max"][index],
        effortOrder: index,
        score: 44.4,
      }),
    )
    const chartScene = barScene(even, { size: { width: 240, height: 400 } })
    const values = labels(chartScene, ":value")

    expect(values.length).toBeGreaterThan(0)
    expect(values.length).toBeLessThan(even.length)
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
        barDefinition(data, {
          flat: "y",
          highlight: null,
          info,
          logoClass: new Map(),
          sources: { x: "deepswe", y: "artificialAnalysis" },
        }),
        SIZE,
      ),
      { ariaLabel: "Bars" },
    )

    expect(svg).toContain(">Task duration<")
    expect(svg).toMatch(/>\d+m</)
    expect(svg).not.toMatch(/tick-label[^>]*>\d+m \d+s</)
  })
})

describe("bar layout", () => {
  const data = plotData(models)
  const groups = barGroups(data, "x")

  it("gives a group with more efforts a wider cell, and keeps every bar inside the plot", () => {
    const layout = layoutBars(groups, 50, 600).cells
    const widths = layout.map((group) => group.right - group.left)

    expect(layout.map((group) => group.group.series.key)).toEqual([
      "sonnet",
      "sonnet/between tools",
      "astra",
    ])
    expect(widths[0]).toBeGreaterThan(widths[2])
    expect(layout[0].left).toBe(50)
    expect(layout.at(-1)!.right).toBeCloseTo(650)
    for (const slot of layout.flatMap((group) => group.bars)) {
      expect(slot.center - slot.width / 2).toBeGreaterThanOrEqual(50)
      expect(slot.center + slot.width / 2).toBeLessThanOrEqual(650)
    }
  })

  it("stops bars growing on a wide plot and spreads the groups out instead", () => {
    const wider = layoutBars(groups, 0, 4000).cells
    const wide = layoutBars(groups, 0, 3000).cells
    const narrow = layoutBars(groups, 0, 300).cells

    expect(wide[0].bars[0].width).toBeGreaterThan(narrow[0].bars[0].width)
    expect(wider[0].bars[0].width).toBe(wide[0].bars[0].width)
    expect(wider[1].center - wider[0].center).toBeGreaterThan(wide[1].center - wide[0].center)
  })

  it("keeps a caption's cell readable however many bars its neighbours have", () => {
    const crowd = [
      ...Array.from({ length: 6 }, (_, index) =>
        makeModel({ model: "wide", effort: `l${index}`, effortOrder: index, score: 20 + index }),
      ),
      makeModel({ model: "lone", score: 30, costPerMTokens: 8 }),
    ]
    const layout = layoutBars(barGroups(plotData(crowd), "x"), 0, 200).cells
    const lone = layout.find((group) => group.group.series.key === "lone")!

    expect(lone.right - lone.left).toBeGreaterThanOrEqual(64)
  })

  it("asks for more width as groups and efforts are added", () => {
    const more = plotData([
      ...models,
      makeModel({ model: "kimi", effort: "low", effortOrder: 1, score: 22, costPerMTokens: 6 }),
      makeModel({ model: "kimi", effort: "high", effortOrder: 3, score: 30, costPerMTokens: 6 }),
    ])

    expect(barsMinWidth(more)).toBeGreaterThan(barsMinWidth(data))
  })
})

describe("bar captions", () => {
  it("keeps a name that fits on one line", () => {
    expect(captionLines("Kimi K3", 200)).toEqual(["Kimi K3"])
  })

  it("splits a long name between words where the longer line is shortest", () => {
    expect(captionLines("Gemini 3.8 Flash", 70)).toEqual(["Gemini", "3.8 Flash"])
  })

  it("cuts a line short only when even its own words are too wide", () => {
    const [line] = captionLines("a-very-long-model-name-from-a-vendor", 60)

    expect(line.endsWith("…")).toBe(true)
    expect(line.length).toBeLessThan(12)
  })
})

describe("effort letters", () => {
  it("abbreviates the usual levels and keeps budgets as they are", () => {
    expect(["minimal", "low", "medium", "high", "xhigh", "max"].map(effortLetter)).toEqual([
      "Mn",
      "L",
      "M",
      "H",
      "X",
      "Mx",
    ])
    expect(effortLetter("16K")).toBe("16K")
    expect(effortLetter("non-reasoning")).toBe("Off")
    expect(effortLetter("effort unknown")).toBe("?")
    expect(effortLetter("default")).toBeNull()
  })
})
