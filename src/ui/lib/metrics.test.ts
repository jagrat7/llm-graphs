import { describe, expect, it } from "vitest"

import { ProvidersService } from "#/server/services/providers"
import { formatMetric, metricAxisTitle, metricProviders, resolveSource } from "./metrics"
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
        costPerMTokens: info.metricProviders.costPerMTokens.toReversed(),
      },
      notes: { ...info.notes, artificialAnalysis: { costPerMTokens: "Updated calculation" } },
    }

    expect(sourceLabel("artificialAnalysis", updated)).toBe("Updated source name")
    expect(metricProviders("price", updated)).toEqual(["artificialAnalysis"])
    expect(resolveSource("price", undefined, updated)).toBe("artificialAnalysis")
    expect(metricAxisTitle("price", "artificialAnalysis", updated)).toBe(
      "Token price · $/M tokens (Updated calculation)",
    )
    expect(metricAxisTitle("speed", "artificialAnalysis", updated)).toBe("Output speed · tokens/s")
    expect(metricAxisTitle("price", null, updated)).toBe("Token price · $/M tokens")
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
    expect(metricAxisTitle("score", "metr", info)).toContain("Task horizon (50%) · h")
  })
  it("ties task runtime to the selected benchmark just like task cost", () => {
    expect(resolveSource("duration", "deepswe", info, "arena")).toBe("arena")
    expect(metricProviders("duration", info)).not.toContain("arena")
  })
})
