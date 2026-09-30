import { describe, expect, it } from "vitest"

import type { MetricBinding } from "#/ui/lib/model-view"

import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { fixtureInputs, fixtures } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { defaultPicks, offeredVariants } from "#/ui/lib/model-view"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(fixtureInputs())

const COST_BY_SCORE: Array<MetricBinding> = [
  { metric: "costPerTask", source: "deepswe" },
  { metric: "score", source: "deepswe" },
]
const SPEED_BY_SCORE: Array<MetricBinding> = [
  { metric: "tokensPerSecond", source: "artificialAnalysis" },
  { metric: "score", source: "deepswe" },
]

function variantsOf(bindings: Array<MetricBinding>, model: string) {
  return offeredVariants(snapshot, bindings)
    .filter((variant) => variant.model === model)
    .map((variant) => `${variant.mode}/${variant.level}`)
    .toSorted()
}

describe("offeredVariants", () => {
  it("preserves the server's effort rank instead of recomputing it in the UI", () => {
    const variant = snapshot.variants.deepswe[0]
    const ranked = {
      ...snapshot,
      variants: {
        ...snapshot.variants,
        deepswe: [{ ...variant, effortOrder: 123 }],
      },
    }

    expect(offeredVariants(ranked, COST_BY_SCORE)[0]?.effortOrder).toBe(123)
  })

  it("offers every variant of a single-source view", () => {
    expect(variantsOf(COST_BY_SCORE, "claude-fable-5")).toEqual([
      "on/high",
      "on/low",
      "on/max",
      "on/medium",
      "on/xhigh",
    ])
  })

  it("offers a variant only when every axis source lists the same mode and level", () => {
    expect(variantsOf(SPEED_BY_SCORE, "claude-fable-5")).toEqual(["on/max"])
    expect(variantsOf(SPEED_BY_SCORE, "claude-sonnet-4-6")).toEqual([])
    expect(variantsOf(SPEED_BY_SCORE, "kimi-k2-7-code")).toEqual(["unknown/unknown"])
  })

  it("reads each axis metric from that axis's source", () => {
    const fable = offeredVariants(snapshot, SPEED_BY_SCORE).find(
      (variant) => variant.model === "claude-fable-5",
    )

    expect(fable?.sources).toEqual({
      score: "deepswe",
      costPerTask: null,
      costPerMTokens: null,
      tokensPerSecond: "artificialAnalysis",
      durationSeconds: null,
    })
    expect(fable?.tokensPerSecond).toEqual(expect.any(Number))
  })

  it("lets an optional source fill values without narrowing the variants", () => {
    const models = offeredVariants(snapshot, [
      ...COST_BY_SCORE,
      { metric: "tokensPerSecond", source: "artificialAnalysis", required: false },
    ])
    const fableLow = models.find(
      (model) => model.model === "claude-fable-5" && model.level === "low",
    )

    expect(models).toHaveLength(fixtures.deepswe.payload.rows.length)
    expect(fableLow?.tokensPerSecond).toBeNull()
  })
})

describe("defaultPicks", () => {
  it("opens Cost × Score on each of the six strongest vendors' strongest model", () => {
    const offered = offeredVariants(snapshot, COST_BY_SCORE)

    expect(defaultPicks(snapshot, offered, "deepswe", info)).toEqual([
      "gpt-6-astra",
      "gemini-3-8-flash",
      "claude-opus-5",
      "glm-5-3",
      "kimi-k3",
      "grok-4-6",
    ])
  })

  it("ranks by average percentile when Score is off the chart", () => {
    const offered = offeredVariants(snapshot, [
      { metric: "tokensPerSecond", source: "artificialAnalysis" },
      { metric: "durationSeconds", source: "deepswe" },
    ])
    const picks = defaultPicks(snapshot, offered, null, info)

    expect(picks.length).toBeGreaterThan(0)
    expect(picks.length).toBeLessThanOrEqual(6)
    expect(
      new Set(picks.map((id) => offered.find((model) => model.model === id)?.vendor)).size,
    ).toBe(picks.length)
  })

  it("picks nothing when no offered model has a score", () => {
    const offered = offeredVariants(snapshot, [
      { metric: "tokensPerSecond", source: "artificialAnalysis" },
    ]).filter(
      (model) => !snapshot.variants.deepswe.some((variant) => variant.entryId === model.model),
    )

    expect(defaultPicks(snapshot, offered, null, info)).toEqual([])
  })
})
