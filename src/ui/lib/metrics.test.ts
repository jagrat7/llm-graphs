import { describe, expect, it } from "vitest"

import { ProvidersService } from "#/server/services/providers"
import { formatMetric, metricAxisTitle, metricProviders, resolveSource } from "./metrics"
import { isSource, sourceLabel } from "./sources"

const info = ProvidersService.info()

describe("provider metadata", () => {
  it("resolves URL sources against the chosen metric after metadata loads", () => {
    expect(resolveSource("cost", "artificialAnalysis", info)).toBe("artificialAnalysis")
    expect(resolveSource("score", "artificialAnalysis", info)).toBe("deepswe")
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
    expect(metricProviders("cost", updated)).toEqual(["artificialAnalysis", "deepswe"])
    expect(resolveSource("cost", undefined, updated)).toBe("artificialAnalysis")
    expect(metricAxisTitle("cost", "artificialAnalysis", updated)).toBe(
      "Cost · $/M tokens (Updated calculation)",
    )
    expect(metricAxisTitle("speed", "artificialAnalysis", updated)).toBe("Speed · tokens/s")
    expect(metricAxisTitle("cost", null, updated)).toBe("Cost · $/M tokens")
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
