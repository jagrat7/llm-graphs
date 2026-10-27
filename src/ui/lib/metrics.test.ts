import { describe, expect, it } from "vitest"

import { ProvidersService } from "#/server/services/providers"
import {
  formatMetric,
  isRatioMetric,
  metricAxisLabel,
  metricAxisTitle,
  metricProviders,
  resolveSource,
} from "./metrics"
import { isSource, sourceLabel } from "./sources"

const info = ProvidersService.info()

describe("provider metadata", () => {
  it("binds task cost to the score benchmark, including a benchmark with no task cost", () => {
    expect(resolveSource("cost", "artificialAnalysis", info)).toBe("deepswe")
    expect(resolveSource("cost", undefined, info, "artificialAnalysis")).toBe("artificialAnalysis")
    expect(metricProviders("cost", info)).toContain("artificialAnalysis")
    expect(resolveSource("cost", undefined, info, "metr")).toBe("metr")
    expect(metricProviders("cost", info)).not.toContain("metr")
    expect(metricProviders("price", info)).toEqual(["artificialAnalysis"])
    expect(metricAxisTitle("cost", "deepswe", info)).toContain("$/task")
    expect(formatMetric(0.003, "price")).toBe("$0.003")
  })

  it("resolves URL sources against the chosen metric after metadata loads", () => {
    expect(resolveSource("price", "artificialAnalysis", info)).toBe("artificialAnalysis")
    expect(resolveSource("score", "artificialAnalysis", info)).toBe("artificialAnalysis")
    expect(resolveSource("speed", "removed-provider", info)).toBe("artificialAnalysis")
    expect(resolveSource("duration", undefined, info)).toBe("deepswe")
    expect(resolveSource("cost", "toString", info)).toBe("deepswe")
    expect(isSource("toString", info)).toBe(false)
  })

  it("uses the response's names, default order, and notes", () => {
    const updated = {
      ...info,
      displayNames: { ...info.displayNames, artificialAnalysis: "Updated source name" },
      metricProviders: {
        ...info.metricProviders,
        score: info.metricProviders.score.toReversed(),
      },
      notes: { ...info.notes, artificialAnalysis: { costPerMTokens: "Updated calculation" } },
    }

    expect(sourceLabel("artificialAnalysis", updated)).toBe("Updated source name")
    expect(metricProviders("score", updated)).toEqual(info.metricProviders.score.toReversed())
    expect(resolveSource("score", undefined, updated)).toBe(info.metricProviders.score.at(-1))
    expect(metricAxisTitle("price", "artificialAnalysis", updated)).toBe(
      "Token price · $/M tokens (Updated calculation)",
    )
    expect(metricAxisTitle("speed", "artificialAnalysis", updated)).toBe("Output speed · tokens/s")
    expect(metricAxisTitle("price", null, updated)).toBe("Token price · $/M tokens")
  })
})

describe("axis captions", () => {
  it("pairs each metric with a compact unit", () => {
    expect(metricAxisLabel("price", "artificialAnalysis", info)).toBe("Token price ($/M)")
    expect(metricAxisLabel("cost", "deepswe", info)).toBe("Task cost ($/task)")
    expect(metricAxisLabel("speed", "artificialAnalysis", info)).toBe("Output speed (tok/s)")
    expect(metricAxisLabel("score", "automationBench", info)).toBe("Workflow completion (%)")
  })

  it("leaves the unit off a duration, whose ticks name their own", () => {
    expect(metricAxisLabel("duration", "deepswe", info)).toBe("Task duration")
  })

  it("drops a unit the name already says and shares an existing qualifier", () => {
    expect(metricAxisLabel("votes", "arena", info)).toBe("Vote count")
    expect(metricAxisLabel("score", "metr", info)).toBe("Task horizon (50%, h)")
    expect(metricAxisLabel("horizon80", "metr", info)).toBe("Task horizon (80%, h)")
  })

  it("says when an axis is on a log scale", () => {
    expect(metricAxisLabel("price", "artificialAnalysis", info, "log")).toBe(
      "Token price ($/M, log scale)",
    )
    expect(metricAxisLabel("horizon80", "metr", info, "log")).toBe(
      "Task horizon (80%, h, log scale)",
    )
    expect(metricAxisLabel("duration", "deepswe", info, "log")).toBe("Task duration (log scale)")
    expect(metricAxisLabel("votes", "arena", info, "log")).toBe("Vote count (log scale)")
  })
})

describe("ratio metrics", () => {
  it("lets prices, costs and horizons go log but never percentages or ratings", () => {
    expect(isRatioMetric("price", "artificialAnalysis", info)).toBe(true)
    expect(isRatioMetric("horizon80", "metr", info)).toBe(true)
    // METR reports its score as a task horizon in hours.
    expect(isRatioMetric("score", "metr", info)).toBe(true)
    expect(isRatioMetric("score", "deepswe", info)).toBe(false)
    expect(isRatioMetric("score", "arena", info)).toBe(false)
    expect(isRatioMetric("taskScore", "metr", info)).toBe(false)
  })
})

describe("formatMetric duration", () => {
  it("formats seconds as human-readable elapsed time", () => {
    expect(formatMetric(42, "duration")).toBe("42s")
    expect(formatMetric(594.2, "duration")).toBe("9m 54s")
    expect(formatMetric(800.5, "duration")).toBe("13m 21s")
    expect(formatMetric(4320, "duration")).toBe("1h 12m")
  })
})

describe("native benchmark units", () => {
  it("never calls an index, preference rating, or time horizon a percent pass rate", () => {
    expect(formatMetric(52.6, "score", "artificialAnalysis", info)).toBe("52.6")
    expect(formatMetric(1505.4, "score", "arena", info)).toBe("1,505.4")
    expect(formatMetric(5.7, "score", "metr", info)).toBe("5.7 h")
    expect(formatMetric(0.003, "score", "metr", info)).toBe("0.003 h")
    expect(formatMetric(82.1, "score", "deepswe", info)).toBe("82.1%")
    expect(formatMetric(2.25, "inputPrice", "artificialAnalysis", info)).toBe("$2.25")
    expect(formatMetric(12345, "votes", "arena", info)).toBe("12,345")
    expect(formatMetric(2.5, "horizon80", "metr", info)).toBe("2.5 h")
    expect(formatMetric(1.25, "horizon80", "metr", info)).toBe("1.25 h")
    expect(formatMetric(54.3, "taskScore", "metr", info)).toBe("54.3%")
    expect(resolveSource("price", undefined, info, "arena")).toBe("artificialAnalysis")
    expect(metricAxisTitle("score", "metr", info)).toContain("Task horizon (50%) · h")
  })
  it("ties task runtime to the selected benchmark just like task cost", () => {
    expect(resolveSource("duration", "deepswe", info, "arena")).toBe("arena")
    expect(metricProviders("duration", info)).not.toContain("arena")
  })
})
