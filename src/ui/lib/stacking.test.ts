import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import { rangeRows, stackedAxis } from "#/ui/lib/stacking"

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerMTokens = 4,
  costPerTask = 10,
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
    costPerTask,
    costPerMTokens,
    sources: metricRecord<Model["sources"]["score"]>(() => null),
  }
}

function run(model: string, price: number, scores: Array<number>, costs?: Array<number>) {
  return scores.map((score, index) =>
    makeModel({
      model,
      effort: ["low", "medium", "high", "xhigh"][index],
      effortOrder: index,
      score,
      costPerMTokens: price,
      costPerTask: costs?.[index] ?? 10,
    }),
  )
}

describe("stacked axis detection", () => {
  it("flags token price, which every effort of a model shares", () => {
    const data = buildPlotData(
      [
        ...run("sonnet", 4, [18, 29, 45]),
        ...run("astra", 20, [25, 34, 41]),
        ...run("kimi", 6, [22]),
      ],
      { x: "price", y: "score" },
    )

    expect(stackedAxis(data)).toBe("x")
  })

  it("flags the vertical axis when the shared metric is on y", () => {
    const data = buildPlotData([...run("sonnet", 4, [18, 29]), ...run("astra", 20, [25, 34])], {
      x: "score",
      y: "price",
    })

    expect(stackedAxis(data)).toBe("y")
  })

  it("leaves a scatter alone when efforts move along both axes", () => {
    const data = buildPlotData(
      [...run("sonnet", 4, [18, 29, 45], [2, 5, 9]), ...run("astra", 20, [25, 34], [3, 8])],
      { x: "cost", y: "score" },
    )

    expect(stackedAxis(data)).toBeNull()
  })

  it("ignores runs that sit on one spot when picking the stacked axis", () => {
    // Sonnet stacks on price; Astra is flat on both axes and stacks nowhere.
    const data = buildPlotData([...run("sonnet", 4, [18, 45]), ...run("astra", 20, [30, 30])], {
      x: "price",
      y: "score",
    })

    expect(stackedAxis(data)).toBe("x")
  })

  it("does not pick an axis when runs split evenly between them", () => {
    const data = buildPlotData(
      [...run("sonnet", 4, [18, 45], [5, 5]), ...run("astra", 20, [30, 30], [3, 8])],
      { x: "cost", y: "score" },
    )

    expect(stackedAxis(data)).toBeNull()
  })

  it("needs at least one model with several efforts", () => {
    const data = buildPlotData([...run("sonnet", 4, [18]), ...run("astra", 20, [25])], {
      x: "price",
      y: "score",
    })

    expect(stackedAxis(data)).toBeNull()
  })
})

describe("range rows", () => {
  it("orders models along the flat metric with each effort span", () => {
    const data = buildPlotData(
      [...run("astra", 20, [25, 41]), ...run("sonnet", 4, [18, 45]), ...run("kimi", 4, [22])],
      { x: "price", y: "score" },
    )

    expect(
      rangeRows(data, "x").map(({ series, fixed, spread }) => [series.key, fixed, spread]),
    ).toEqual([
      ["sonnet", { min: 4, max: 4 }, { min: 18, max: 45 }],
      ["kimi", { min: 4, max: 4 }, { min: 22, max: 22 }],
      ["astra", { min: 20, max: 20 }, { min: 25, max: 41 }],
    ])
  })

  it("keeps the full span of a model whose efforts differ on the flat metric", () => {
    const data = buildPlotData(
      [
        ...run("sonnet", 4, [18, 45]),
        ...run("astra", 20, [25, 41]),
        makeModel({ model: "mixed", effort: "low", score: 30, costPerMTokens: 2 }),
        makeModel({
          model: "mixed",
          effort: "high",
          effortOrder: 1,
          score: 40,
          costPerMTokens: 20,
        }),
      ],
      { x: "price", y: "score" },
    )
    const mixed = rangeRows(data, "x").find((row) => row.series.key === "mixed")

    expect(mixed?.fixed).toEqual({ min: 2, max: 20 })
  })
})
