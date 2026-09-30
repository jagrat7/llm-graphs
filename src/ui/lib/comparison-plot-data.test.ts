import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { axisTicks, buildPlotData, describePlot, padDomain } from "#/ui/lib/comparison-plot-data"

type ModelOverrides = Partial<Model> & { model: string }

function makeModel({
  model,
  displayName = model,
  vendor = "openai",
  chartColor = "oklch(0.62 0.15 339)",
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerMTokens = 10,
  tokensPerSecond = 100,
  durationSeconds = 30,
  sources,
  ...rest
}: ModelOverrides): Model {
  return {
    model,
    displayName,
    vendor,
    releaseDate: null,
    chartColor,
    logoUrl: null,
    mode: effort === "default" ? "unknown" : "on",
    level: effort === "default" ? "unknown" : effort,
    effort,
    effortOrder,
    score,
    costPerMTokens,
    tokensPerSecond,
    durationSeconds,
    sources: sources ?? {
      score: "deepswe",
      costPerMTokens: "deepswe",
      tokensPerSecond: "artificialAnalysis",
      durationSeconds: "deepswe",
    },
    ...rest,
  }
}

const XY = { x: "cost", y: "score" } as const
const XYZ = { x: "cost", y: "score", z: "speed" } as const

describe("buildPlotData", () => {
  it("gives each point its vendor logo, or none for a circle marker", () => {
    const logoUrl = "data:image/svg+xml,%3Csvg%2F%3E"
    const data = buildPlotData(
      [makeModel({ model: "a", logoUrl }), makeModel({ model: "b", vendor: null })],
      XY,
    )

    expect(data.points.map((point) => point.logoUrl)).toEqual([logoUrl, null])
  })

  it("drops models missing a selected metric and counts them", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", score: 80, costPerMTokens: 4 }),
        makeModel({ model: "b", score: null }),
        makeModel({ model: "c", costPerMTokens: null }),
      ],
      XY,
    )

    expect(data.points.map((point) => point.model.model)).toEqual(["a"])
    expect(data.excludedCount).toBe(2)
    expect(data.modelCount).toBe(1)
  })

  it("only requires the third metric when a Z axis is selected", () => {
    const models = [makeModel({ model: "a", tokensPerSecond: null })]

    expect(buildPlotData(models, XY).points).toHaveLength(1)
    expect(buildPlotData(models, XYZ).points).toHaveLength(0)
  })

  it("normalizes each axis into 0–1 over its own domain", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", costPerMTokens: 2, score: 10 }),
        makeModel({ model: "b", costPerMTokens: 6, score: 50 }),
        makeModel({ model: "c", costPerMTokens: 10, score: 90 }),
      ],
      XY,
    )

    expect(data.domains.x).toEqual({ min: 2, max: 10 })
    expect(data.domains.y).toEqual({ min: 10, max: 90 })
    expect(data.points.map((point) => point.unit.x)).toEqual([0, 0.5, 1])
    expect(data.points.map((point) => point.unit.y)).toEqual([0, 0.5, 1])
  })

  it("centres an axis whose values are all equal instead of dividing by zero", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", costPerMTokens: 7, score: 10 }),
        makeModel({ model: "b", costPerMTokens: 7, score: 20 }),
      ],
      XY,
    )

    expect(data.points.every((point) => point.unit.x === 0.5)).toBe(true)
    expect(data.points.map((point) => point.unit.y)).toEqual([0, 1])
  })

  it("leaves the Z axis collapsed while the plot is two-dimensional", () => {
    const data = buildPlotData([makeModel({ model: "a" })], XY)

    expect(data.is3D).toBe(false)
    expect(data.axes).toEqual(["x", "y"])
    expect(data.points[0].values.z).toBe(0)
    expect(data.points[0].unit.z).toBe(0)
    expect(data.domains.z).toEqual({ min: 0, max: 1 })
  })

  it("groups effort variants into one series ordered by effort", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", effort: "high", effortOrder: 2, score: 90 }),
        makeModel({ model: "a", effort: "default", effortOrder: 0, score: 70 }),
        makeModel({ model: "b", effort: "default", effortOrder: 0, score: 60 }),
      ],
      XY,
    )

    expect(data.series).toHaveLength(2)
    expect(data.series[0].points.map((point) => point.model.effort)).toEqual(["default", "high"])
    expect(data.series[0].points.map((point) => point.label)).toEqual(["a", "a [high]"])
  })

  it("anchors the label at high when offered, otherwise at the top effort", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", effort: "low", effortOrder: 1 }),
        makeModel({ model: "a", effort: "high", effortOrder: 3 }),
        makeModel({ model: "a", effort: "max", effortOrder: 5 }),
        makeModel({ model: "b", effort: "medium", effortOrder: 2 }),
        makeModel({ model: "b", effort: "xhigh", effortOrder: 4 }),
        makeModel({ model: "c" }),
      ],
      XY,
    )

    expect(data.series.map((series) => series.anchorId)).toEqual([
      "a-on-high",
      "b-on-xhigh",
      "c-unknown-unknown",
    ])
  })

  it("alternates label placement between series of the same vendor", () => {
    const data = buildPlotData(
      [
        makeModel({ model: "a", vendor: "openai" }),
        makeModel({ model: "b", vendor: "openai" }),
        makeModel({ model: "c", vendor: "anthropic" }),
      ],
      XY,
    )

    expect(data.series.map((series) => series.labelPlacement)).toEqual(["top", "bottom", "top"])
  })

  it("keeps input order stable and exposes O(1) lookup by id", () => {
    const data = buildPlotData(
      [makeModel({ model: "a", effort: "high", effortOrder: 2 }), makeModel({ model: "b" })],
      XY,
    )

    expect(data.points.map((point) => point.index)).toEqual([0, 1])
    expect(data.pointById.get("a-on-high")?.label).toBe("a [high]")
    expect(data.pointById.size).toBe(data.points.length)
  })

  it("returns usable domains for an empty selection", () => {
    const data = buildPlotData([], XYZ)

    expect(data.points).toHaveLength(0)
    expect(data.series).toHaveLength(0)
    expect(data.domains.x).toEqual({ min: 0, max: 1 })
    expect(data.excludedCount).toBe(0)
  })
})

describe("padDomain", () => {
  it("widens a domain by a share of its span", () => {
    expect(padDomain({ min: 0, max: 10 }, 0.1)).toEqual({ min: -1, max: 11 })
  })

  it("falls back to a proportional pad when the span is zero", () => {
    expect(padDomain({ min: 10, max: 10 }, 0.1)).toEqual({ min: 9, max: 11 })
    expect(padDomain({ min: 0, max: 0 }, 0.1)).toEqual({ min: -1, max: 1 })
  })
})

describe("axisTicks", () => {
  it("steps by round values inside the domain", () => {
    expect(axisTicks({ min: 0, max: 100 }, 5)).toEqual([0, 20, 40, 60, 80, 100])
    expect(axisTicks({ min: 0, max: 1 }, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
  })

  it("never steps outside the domain", () => {
    const ticks = axisTicks({ min: 3.4, max: 21.7 }, 6)

    expect(ticks[0]).toBeGreaterThanOrEqual(3.4)
    expect(ticks.at(-1)).toBeLessThanOrEqual(21.7)
  })

  it("collapses to a single value for a flat domain", () => {
    expect(axisTicks({ min: 7, max: 7 }, 5)).toEqual([7])
  })
})

describe("describePlot", () => {
  it("names every active axis", () => {
    const models = [makeModel({ model: "a", effort: "high", effortOrder: 2 })]

    expect(describePlot(buildPlotData(models, XY))).toBe(
      "2D scatter plot of 1 model (1 effort variant) by X Cost, Y Score. Use arrow keys to move between points.",
    )
    expect(describePlot(buildPlotData(models, XYZ))).toContain("3D scatter plot")
    expect(describePlot(buildPlotData(models, XYZ))).toContain("Z Speed")
  })
})
