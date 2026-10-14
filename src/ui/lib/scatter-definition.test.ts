import { createChartScene, findNearestPoint, renderChartSvg } from "@tanstack/charts"
import type { ChartScene, SceneNode } from "@tanstack/charts"
import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import {
  LABEL_NAME_SIZE,
  labelBlockSize,
  placeSeriesLabels,
  type PlacedLabel,
} from "#/ui/lib/plot-labels"
import { scatterDefinition } from "#/ui/lib/scatter-definition"

const info = ProvidersService.info()
const SIZE = { width: 1200, height: 640 }

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerTask = 10,
  logoUrl = null,
}: Partial<Model> & { model: string }): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName: model,
    vendor: model,
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl,
    mode: effort === "default" ? "unknown" : "on",
    level: effort === "default" ? "unknown" : effort,
    effort,
    effortOrder,
    score,
    costPerTask,
    sources: {
      ...metricRecord<Model["sources"]["score"]>(() => null),
      score: "deepswe",
      costPerTask: "deepswe",
    },
  }
}

const models = [
  makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40, costPerTask: 2 }),
  makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 60, costPerTask: 6 }),
  makeModel({ model: "beta", score: 52, costPerTask: 12, logoUrl: "data:image/svg+xml,beta" }),
]

function scene(highlight: string | null = null) {
  const data = buildPlotData(models, { x: "cost", y: "score" })
  const definition = scatterDefinition(data, {
    highlight,
    info,
    logoClass: new Map([["data:image/svg+xml,beta", "logo-beta"]]),
    sources: { x: "deepswe", y: "deepswe" },
  })

  return { data, scene: createChartScene(definition, SIZE) }
}

function flatten(nodes: ReadonlyArray<SceneNode>): Array<SceneNode> {
  return nodes.flatMap((node) => (node.kind === "group" ? flatten(node.children) : [node]))
}

function labels(chartScene: ChartScene) {
  return flatten(chartScene.nodes).flatMap((node) => (node.kind === "label" ? [node.text] : []))
}

describe("scatter definition", () => {
  it("makes every effort variant one interactive point", () => {
    const { scene: chartScene } = scene()

    expect(chartScene.points.map((point) => point.key).toSorted()).toEqual([
      "model-runs-1:alpha-on-high",
      "model-runs-1:alpha-on-low",
      "model-runs-1:beta-unknown-unknown",
    ])
    expect(new Set(chartScene.points.map((point) => point.group))).toEqual(
      new Set(["alpha", "beta"]),
    )
  })

  it("paints a logo as a masked rect and a logo-less model as a dot", () => {
    const nodes = flatten(scene().scene.nodes)
    const beta = nodes.find((node) => node.key === "model-runs-1:beta-unknown-unknown")
    const alpha = nodes.find((node) => node.key === "model-runs-1:alpha-on-high")

    expect(beta).toMatchObject({ kind: "rect", className: "logo-beta", width: 16, height: 16 })
    expect(alpha).toMatchObject({ kind: "dot" })
    expect(nodes.some((node) => node.kind === "polyline")).toBe(true)
  })

  it("names each model once, with its effort tier", () => {
    const text = labels(scene().scene)

    expect(text.filter((label) => label === "alpha")).toHaveLength(1)
    expect(text).toContain("HIGH")
    expect(text).toContain("beta")
  })

  it("dims every other model while one is highlighted", () => {
    const nodes = flatten(scene("beta").scene.nodes)
    const alphaDot = nodes.find((node) => node.key === "model-runs-1:alpha-on-high")
    const betaLogo = nodes.find((node) => node.key === "model-runs-1:beta-unknown-unknown")

    expect(alphaDot?.style?.opacity).toBeLessThan(1)
    expect(betaLogo?.style?.opacity).toBe(1)
  })

  it("serializes to SVG with axis titles and formatted ticks", () => {
    const svg = renderChartSvg(scene().scene, { ariaLabel: "Comparison" })

    expect(svg).toContain("Task cost ($/task)")
    expect(svg).toContain("Score (%)")
    expect(svg).not.toContain("Task cost · $/task")
    expect(svg).toMatch(/\$\d/)
    expect(svg).toContain('class="logo-beta"')
  })

  it("ticks a duration axis on whole minutes", () => {
    const timed = models.map((model, index) => ({
      ...model,
      durationSeconds: [310, 1180, 2560][index],
      sources: { ...model.sources, durationSeconds: "deepswe" as const },
    }))
    const data = buildPlotData(timed, { x: "duration", y: "score" })
    const svg = renderChartSvg(
      createChartScene(
        scatterDefinition(data, {
          highlight: null,
          info,
          logoClass: new Map(),
          sources: { x: "deepswe", y: "deepswe" },
        }),
        SIZE,
      ),
      { ariaLabel: "Comparison" },
    )

    expect(svg).toContain(">Task duration<")
    expect(svg).toMatch(/>\d+m</)
    expect(svg).not.toMatch(/>\d+m \d+s</)
  })

  it("finds the point under the pointer", () => {
    const { scene: chartScene } = scene()
    const beta = chartScene.points.find((point) => point.group === "beta")!

    expect(findNearestPoint(chartScene, beta.x, beta.y, 0)?.group).toBe("beta")
  })
})

const at = (entries: Array<[string, number, number]>) =>
  new Map(entries.map(([id, x, y]) => [id, { x, y }]))
const dotHalf = () => 5

function labelBox(label: PlacedLabel) {
  const { width, height } = labelBlockSize(label)
  const left =
    label.anchor === "start"
      ? label.x
      : label.anchor === "end"
        ? label.x - width
        : label.x - width / 2
  const top = label.nameY - LABEL_NAME_SIZE

  return { left, right: left + width, top, bottom: top + height }
}

describe("label placement", () => {
  const data = buildPlotData(models, { x: "cost", y: "score" })

  it("keeps two models' names apart when their markers crowd together", () => {
    const placed = placeSeriesLabels(
      data,
      at([
        ["alpha-on-low", 300, 300],
        ["alpha-on-high", 300, 300],
        ["beta-unknown-unknown", 304, 302],
      ]),
      { left: 0, top: 0, right: 800, bottom: 600 },
      dotHalf,
    )
    const [first, second] = placed.map(labelBox)

    expect(placed.map((label) => label.key).toSorted()).toEqual(["alpha", "beta"])
    expect(
      first.right <= second.left ||
        second.right <= first.left ||
        first.bottom <= second.top ||
        second.bottom <= first.top,
    ).toBe(true)
  })

  it("drops a name that cannot fit without leaving the plot", () => {
    const placed = placeSeriesLabels(
      data,
      at([
        ["alpha-on-low", 10, 10],
        ["alpha-on-high", 10, 10],
        ["beta-unknown-unknown", 30, 10],
      ]),
      { left: 0, top: 0, right: 40, bottom: 20 },
      dotHalf,
    )

    expect(placed).toEqual([])
  })
})
