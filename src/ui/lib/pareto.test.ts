import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { buildPlotData, type PlotMetrics } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import { hasParetoFrontier, paretoFrontier } from "#/ui/lib/pareto"

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  ...values
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
    sources: metricRecord<Model["sources"]["score"]>(() => null),
    ...values,
  }
}

const models = [
  makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40, costPerTask: 2 }),
  makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 60, costPerTask: 6 }),
  // Dearer and worse than alpha high, so it is beaten on both axes.
  makeModel({ model: "beta", score: 52, costPerTask: 12 }),
  makeModel({ model: "gamma", score: 70, costPerTask: 20 }),
]

function frontierIds(metrics: PlotMetrics, input = models) {
  return paretoFrontier(buildPlotData(input, metrics)).map((point) => point.id)
}

describe("pareto frontier", () => {
  it("keeps the variants nothing beats, from the cheapest to the best score", () => {
    expect(frontierIds({ x: "cost", y: "score" })).toEqual([
      "alpha-on-low",
      "alpha-on-high",
      "gamma-unknown-unknown",
    ])
  })

  it("reads the same with the axes swapped", () => {
    expect(frontierIds({ x: "score", y: "cost" })).toEqual([
      "gamma-unknown-unknown",
      "alpha-on-high",
      "alpha-on-low",
    ])
  })

  it("can keep one effort of a model and drop another", () => {
    const input = [
      makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40, costPerTask: 2 }),
      makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 55, costPerTask: 15 }),
      makeModel({ model: "beta", score: 60, costPerTask: 8 }),
    ]

    expect(frontierIds({ x: "cost", y: "score" }, input)).toEqual([
      "alpha-on-low",
      "beta-unknown-unknown",
    ])
  })

  it("treats higher output speed as better", () => {
    const input = [
      makeModel({ model: "fast", score: 40, tokensPerSecond: 200 }),
      makeModel({ model: "slow", score: 70, tokensPerSecond: 50 }),
      makeModel({ model: "worse", score: 35, tokensPerSecond: 100 }),
    ]

    expect(frontierIds({ x: "speed", y: "score" }, input)).toEqual([
      "fast-unknown-unknown",
      "slow-unknown-unknown",
    ])
  })

  it("keeps one of two variants with identical values", () => {
    const input = [
      makeModel({ model: "alpha", score: 50, costPerTask: 5 }),
      makeModel({ model: "beta", score: 50, costPerTask: 5 }),
    ]

    expect(frontierIds({ x: "cost", y: "score" }, input)).toEqual(["alpha-unknown-unknown"])
  })

  it("only draws for Score against cost, duration or speed", () => {
    const plot = (metrics: PlotMetrics) => hasParetoFrontier(buildPlotData(models, metrics))

    expect(plot({ x: "cost", y: "score" })).toBe(true)
    expect(plot({ x: "duration", y: "score" })).toBe(true)
    expect(plot({ x: "score", y: "speed" })).toBe(true)
    expect(plot({ x: "price", y: "score" })).toBe(false)
    expect(plot({ x: "cost", y: "duration" })).toBe(false)
    expect(plot({ x: "cost", y: "score", z: "duration" })).toBe(false)
    expect(frontierIds({ x: "price", y: "score" })).toEqual([])
  })
})
