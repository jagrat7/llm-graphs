import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"
import { metricRecord } from "./metrics"

import {
  axisScale,
  logAllowed,
  axisTicks,
  buildPlotData,
  describePlot,
  logTicks,
  metricTicks,
  padDomain,
  plotQuality,
  timeTicks,
} from "#/ui/lib/comparison-plot-data"

type ModelOverrides = Partial<Model> & { model: string }

function makeModel({
  model,
  displayName = model,
  vendor = "openai",
  chartColor = "oklch(0.62 0.15 339)",
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerTask = 10,
  tokensPerSecond = 100,
  durationSeconds = 30,
  sources,
  ...rest
}: ModelOverrides): Model {
  return {
    ...metricRecord<number | null>(() => null),
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
    costPerTask,
    costPerMTokens: null,
    tokensPerSecond,
    durationSeconds,
    sources: sources ?? {
      ...metricRecord<Model["sources"]["score"]>(() => null),
      score: "deepswe",
      costPerTask: "deepswe",
      costPerMTokens: null,
      tokensPerSecond: "artificialAnalysis",
      durationSeconds: "deepswe",
    },
    ...rest,
  }
}

const XY = { x: "cost", y: "score" } as const
const XYZ = { x: "cost", y: "score", z: "speed" } as const

describe("buildPlotData", () => {
  it("reports a constant axis even when its display domain has padding", () => {
    const plot = buildPlotData(
      [
        makeModel({ model: "a", costPerTask: 1, score: 50 }),
        makeModel({ model: "b", costPerTask: 1, score: 80 }),
      ],
      XY,
    )
    expect(plotQuality(plot)).toMatchObject({ meaningful: false, flatAxes: ["x"] })
  })
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
        makeModel({ model: "a", score: 80, costPerTask: 4 }),
        makeModel({ model: "b", score: null }),
        makeModel({ model: "c", costPerTask: null }),
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
        makeModel({ model: "a", costPerTask: 2, score: 10 }),
        makeModel({ model: "b", costPerTask: 6, score: 50 }),
        makeModel({ model: "c", costPerTask: 10, score: 90 }),
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
        makeModel({ model: "a", costPerTask: 7, score: 10 }),
        makeModel({ model: "b", costPerTask: 7, score: 20 }),
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

describe("axisScale", () => {
  it("goes log when a wide ratio metric crowds the low end of the axis", () => {
    // Token prices: one $600 model would flatten the $1–$5 ones onto the baseline.
    expect(axisScale(true, [1, 2, 2.5, 3, 5, 600])).toBe("log")
    // Evenly spread across decades, as task horizons often are.
    expect(axisScale(true, [0.01, 0.1, 1, 10, 100])).toBe("log")
  })

  it("stays linear when values spread evenly, however wide their range", () => {
    expect(axisScale(true, [10, 50, 100, 150, 200])).toBe("linear")
  })

  it("stays linear under a decade of spread", () => {
    expect(axisScale(true, [1, 1.1, 1.2, 9])).toBe("linear")
  })

  it("stays linear for zero, negative, or too few values", () => {
    expect(axisScale(true, [0, 1, 2, 500])).toBe("linear")
    expect(axisScale(true, [-1, 1, 2, 500])).toBe("linear")
    // Repeated efforts at one price are one position, not three.
    expect(axisScale(true, [1, 1, 1, 500])).toBe("linear")
  })

  it("never puts a score or rating on a log axis", () => {
    expect(axisScale(false, [1, 2, 2.5, 3, 5, 600])).toBe("linear")
  })
})

describe("buildPlotData axis scales", () => {
  const spread = [0.1, 0.2, 0.3, 1, 100].map((costPerTask, index) =>
    makeModel({ model: `m${index}`, costPerTask, score: 10 + index * 10 }),
  )

  it("places points on a log axis by their decade", () => {
    const data = buildPlotData(spread, XY)

    expect(data.scales).toEqual({ x: "log", y: "linear", z: "linear" })
    // $1 is a third of the way from $0.10 to $100 in decades, not 1% of the dollars.
    expect(data.pointById.get("m3-unknown-unknown")?.unit.x).toBeCloseTo(1 / 3)
  })

  it("lets a source mark a plain metric as a ratio, like METR's horizon score", () => {
    const horizons = [0.01, 0.02, 0.05, 1, 40].map((score, index) =>
      makeModel({ model: `h${index}`, score }),
    )

    expect(buildPlotData(horizons, XY).scales.y).toBe("linear")
    expect(buildPlotData(horizons, XY, { y: true }).scales.y).toBe("log")
  })
  it("lets the reader's choice win over detection, where log is possible", () => {
    const even = [1, 25, 50, 75, 100].map((costPerTask, index) =>
      makeModel({ model: `e${index}`, costPerTask, score: 10 + index * 10 }),
    )
    const forced = buildPlotData(even, XY, {}, { x: "log", y: "log" })

    expect(forced.autoScales.x).toBe("linear")
    expect(forced.logAllowed).toEqual({ x: true, y: false, z: false })
    // Score is no ratio metric, so asking for log there changes nothing.
    expect(forced.scales).toEqual({ x: "log", y: "linear", z: "linear" })
    expect(buildPlotData(spread, XY, {}, { x: "linear" }).scales.x).toBe("linear")
  })
})

describe("logAllowed", () => {
  it("allows log for a ratio metric with two or more positive values", () => {
    expect(logAllowed(true, [2, 6])).toBe(true)
    expect(logAllowed(true, [0, 6, 12])).toBe(false)
    expect(logAllowed(true, [5, 5])).toBe(false)
    expect(logAllowed(false, [1, 100, 10_000])).toBe(false)
  })
})

describe("padDomain", () => {
  it("widens a domain by a share of its span", () => {
    expect(padDomain({ min: 0, max: 10 }, 0.1)).toEqual({ min: -1, max: 11 })
  })

  it("widens a log domain by a share of its decades, never reaching zero", () => {
    const padded = padDomain({ min: 0.1, max: 1000 }, 0.1, "log")

    expect(padded.min).toBeCloseTo(0.1 / 10 ** 0.4)
    expect(padded.max).toBeCloseTo(1000 * 10 ** 0.4)
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

describe("timeTicks", () => {
  it("steps by whole minutes where 1-2-5 seconds would read as 8m 20s", () => {
    // About 5 to 43 minutes, as in a task-duration axis.
    expect(timeTicks({ min: 300, max: 2600 }, 5)).toEqual([600, 1200, 1800, 2400])
    expect(axisTicks({ min: 300, max: 2600 }, 5)).toContain(500)
  })

  it("moves to hours for long spans and seconds for short ones", () => {
    expect(timeTicks({ min: 0, max: 5 * 3600 }, 5)).toEqual([0, 3600, 7200, 10_800, 14_400, 18_000])
    expect(timeTicks({ min: 0, max: 40 }, 4)).toEqual([0, 10, 20, 30, 40])
  })

  it("never puts a tick below zero seconds", () => {
    expect(timeTicks({ min: -120, max: 900 }, 5)[0]).toBe(0)
  })

  it("is the tick rule for durations only", () => {
    const domain = { min: 300, max: 2600 }

    expect(metricTicks("duration", domain, 5)).toEqual(timeTicks(domain, 5))
    expect(metricTicks("cost", domain, 5)).toEqual(axisTicks(domain, 5))
  })
})

describe("logTicks", () => {
  it("ticks powers of ten across several decades", () => {
    expect(logTicks("cost", { min: 0.01, max: 1000 }, 5)).toEqual([0.01, 0.1, 1, 10, 100, 1000])
    expect(logTicks("cost", { min: 0.001, max: 1e6 }, 4)).toEqual([0.001, 1, 1000, 1e6])
  })

  it("fills a short span with 2× and 5× steps", () => {
    expect(logTicks("cost", { min: 0.4, max: 22 }, 5)).toEqual([0.5, 1, 2, 5, 10, 20])
    expect(logTicks("cost", { min: 0.18, max: 3.2 }, 5)).toEqual([0.2, 0.5, 1, 2])
  })

  it("ticks a duration on clock decades: seconds, minutes, then hours", () => {
    expect(logTicks("duration", { min: 5, max: 20_000 }, 5)).toEqual([10, 60, 600, 3600])
    expect(logTicks("duration", { min: 150, max: 5700 }, 5)).toEqual([300, 600, 1800, 3600])
  })

  it("is the tick rule for log axes", () => {
    const domain = { min: 0.01, max: 1000 }

    expect(metricTicks("cost", domain, 5, "log")).toEqual(logTicks("cost", domain, 5))
  })
})

describe("describePlot", () => {
  it("names every active axis", () => {
    const models = [makeModel({ model: "a", effort: "high", effortOrder: 2 })]

    expect(describePlot(buildPlotData(models, XY))).toBe(
      "2D scatter plot of 1 model (1 effort variant) by X Task cost, Y Score. Use arrow keys to move between points.",
    )
    expect(describePlot(buildPlotData(models, XYZ))).toContain("3D scatter plot")
    expect(describePlot(buildPlotData(models, XYZ))).toContain("Z Output speed")
  })
})
