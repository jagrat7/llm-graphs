import { describe, expect, it } from "vitest"

import type { MetricBinding } from "#/ui/lib/model-view"

import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { fixtureInputs, fixtures } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import {
  DEFAULT_PICK_COUNT,
  DEFAULT_PICKS_PER_VENDOR,
  defaultPicks,
  offeredVariants,
  effortLabel,
} from "#/ui/lib/model-view"
import { buildPlotData } from "./comparison-plot-data"
import { metricRecord } from "./metrics"

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
  it("keeps each harness's measurements and effort curve separate", () => {
    const variant = snapshot.variants.deepswe[0]
    const input = {
      ...snapshot,
      variants: {
        ...snapshot.variants,
        deepswe: [
          { ...variant, configuration: "agent A", metrics: { score: 20, costPerTask: 1 } },
          { ...variant, configuration: "agent B", metrics: { score: 30, costPerTask: 2 } },
        ],
      },
    }
    const models = offeredVariants(input, COST_BY_SCORE)
    expect(models.map((model) => [model.configuration, model.score, model.costPerTask])).toEqual([
      ["agent A", 20, 1],
      ["agent B", 30, 2],
    ])
    const plot = buildPlotData(models, { x: "cost", y: "score" })
    expect(plot.pointById.size).toBe(2)
    expect(plot.series).toHaveLength(2)
    expect(offeredVariants(input, SPEED_BY_SCORE)).toEqual([])
  })

  it("requires unanimous prices and rejects speed joins for unspecified configurations", () => {
    const variant = snapshot.variants.deepswe[0]
    for (const { prices, refused, expected } of [
      { prices: [2, 2], refused: false, expected: 1 },
      { prices: [2, 3], refused: false, expected: 0 },
      { prices: [2, null], refused: false, expected: 0 },
      { prices: [2], refused: true, expected: 0 },
    ]) {
      const input = {
        ...snapshot,
        variants: {
          ...snapshot.variants,
          deepswe: [
            {
              ...variant,
              mode: "unknown" as const,
              level: "unknown",
              configurationKnown: false as const,
            },
          ],
          artificialAnalysis: prices.map((price, index) => ({
            ...variant,
            mode: index === 0 ? ("unknown" as const) : ("on" as const),
            level: index === 0 ? "unknown" : "high",
            ...(refused ? { refused: true as const } : {}),
            metrics: { costPerMTokens: price, tokensPerSecond: 120 },
          })),
        },
      }
      expect(
        offeredVariants(input, [
          { metric: "score", source: "deepswe" },
          { metric: "costPerMTokens", source: "artificialAnalysis", scope: "model" },
        ]),
      ).toHaveLength(expected)
      expect(
        offeredVariants(input, [
          { metric: "score", source: "deepswe" },
          { metric: "tokensPerSecond", source: "artificialAnalysis" },
        ]),
      ).toEqual([])
    }
  })

  it("excludes missing required measurements but leaves optional measurements unavailable", () => {
    const variant = snapshot.variants.deepswe[0]
    const missing = {
      ...snapshot,
      variants: {
        ...snapshot.variants,
        deepswe: [{ ...variant, metrics: { ...variant.metrics, costPerTask: null } }],
      },
    }
    expect(offeredVariants(missing, COST_BY_SCORE)).toEqual([])
    expect(
      offeredVariants(missing, [
        { metric: "score", source: "deepswe" },
        { metric: "costPerTask", source: "deepswe", required: false },
      ]),
    ).toHaveLength(1)
  })

  it("never lends a conflicting optional source's measurement to a benchmark result", () => {
    const variant = snapshot.variants.deepswe[0]
    const conflicting = {
      ...snapshot,
      variants: {
        ...snapshot.variants,
        deepswe: [variant],
        artificialAnalysis: [
          { ...variant, refused: true as const, metrics: { tokensPerSecond: 120 } },
        ],
      },
    }
    const [model] = offeredVariants(conflicting, [
      { metric: "score", source: "deepswe" },
      { metric: "tokensPerSecond", source: "artificialAnalysis", required: false },
    ])
    expect(model?.tokensPerSecond).toBeNull()
    expect(model?.sources.tokensPerSecond).toBeNull()
  })

  it("preserves the server's effort rank instead of recomputing it in the UI", () => {
    expect(effortLabel("unknown", "unknown")).toBe("reasoning unknown")
    expect(effortLabel("on", "unknown")).toBe("effort unknown")
    expect(effortLabel("off", "unknown")).toBe("non-reasoning")
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
    // AA lists the matching variant but has no speed measurement for it.
    const missingSpeed = {
      ...snapshot,
      variants: {
        ...snapshot.variants,
        artificialAnalysis: snapshot.variants.artificialAnalysis.map((variant) =>
          variant.entryId === "kimi-k2-7-code"
            ? { ...variant, metrics: { ...variant.metrics, tokensPerSecond: null } }
            : variant,
        ),
      },
    }
    expect(
      offeredVariants(missingSpeed, SPEED_BY_SCORE).filter(
        (model) => model.model === "kimi-k2-7-code",
      ),
    ).toEqual([])
  })

  it("reads each axis metric from that axis's source", () => {
    const fable = offeredVariants(snapshot, SPEED_BY_SCORE).find(
      (variant) => variant.model === "claude-fable-5",
    )

    expect(fable?.sources).toEqual({
      ...metricRecord(() => null),
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
  it("widens a flat default axis by trading the weakest pick for a real measurement", () => {
    const offered = offeredVariants(snapshot, COST_BY_SCORE)
    const original = defaultPicks(snapshot, offered, "deepswe", info)
    const kept = original.slice(0, -1)
    const vendorOf = new Map(offered.map((model) => [model.model, model.vendor]))
    const extra = offered.find(
      (model) =>
        !original.includes(model.model) &&
        kept.filter((id) => vendorOf.get(id) === model.vendor).length < DEFAULT_PICKS_PER_VENDOR,
    )!
    const flat = offered.map((model) => ({
      ...model,
      costPerTask: model.model === extra.model ? 2 : 1,
    }))
    const picks = defaultPicks(snapshot, flat, "deepswe", info, ["costPerTask", "score"])

    expect(picks).toEqual([...kept, extra.model])
    expect(
      new Set(flat.filter((model) => picks.includes(model.model)).map((model) => model.costPerTask))
        .size,
    ).toBe(2)
  })

  it("leaves a flat default axis alone when only a full vendor could widen it", () => {
    const offered = offeredVariants(snapshot, COST_BY_SCORE)
    const original = defaultPicks(snapshot, offered, "deepswe", info)
    const vendorOf = new Map(offered.map((model) => [model.model, model.vendor]))
    const full = [...new Set(original.map((id) => vendorOf.get(id)))].find(
      (vendor) =>
        vendor !== vendorOf.get(original.at(-1)!) &&
        original.filter((id) => vendorOf.get(id) === vendor).length === DEFAULT_PICKS_PER_VENDOR,
    )
    const extra = offered.find((model) => !original.includes(model.model) && model.vendor === full)!
    const flat = offered.map((model) => ({
      ...model,
      costPerTask: model.model === extra.model ? 2 : 1,
    }))

    expect(defaultPicks(snapshot, flat, "deepswe", info, ["costPerTask"])).toEqual(original)
  })

  it("opens Cost × Score on the strongest models, with a per-vendor cap", () => {
    const offered = offeredVariants(snapshot, COST_BY_SCORE)
    const picks = defaultPicks(snapshot, offered, "deepswe", info)
    const best = new Map<string, number>()
    for (const variant of snapshot.variants.deepswe) {
      const score = variant.metrics.score
      if (score != null) best.set(variant.entryId, Math.max(score, best.get(variant.entryId) ?? 0))
    }
    const vendorOf = new Map(offered.map((model) => [model.model, model.vendor]))
    const taken = (vendor: string | null | undefined) =>
      picks.filter((id) => vendorOf.get(id) === vendor).length

    expect(picks).toHaveLength(DEFAULT_PICK_COUNT)
    expect(picks.map((id) => best.get(id))).toEqual(
      picks.map((id) => best.get(id)).toSorted((left, right) => right! - left!),
    )
    for (const id of picks)
      expect(taken(vendorOf.get(id))).toBeLessThanOrEqual(DEFAULT_PICKS_PER_VENDOR)
    // A model left out despite outscoring a pick was only skipped because its vendor is full.
    const weakest = best.get(picks.at(-1)!)!
    for (const [id, vendor] of vendorOf) {
      if (picks.includes(id) || (best.get(id) ?? -Infinity) <= weakest) continue
      expect(taken(vendor)).toBe(DEFAULT_PICKS_PER_VENDOR)
    }
  })

  it("takes no more than the cap from one vendor", () => {
    const offered = offeredVariants(snapshot, COST_BY_SCORE).map((model) => ({
      ...model,
      vendor: "one-vendor",
    }))

    expect(defaultPicks(snapshot, offered, "deepswe", info)).toHaveLength(DEFAULT_PICKS_PER_VENDOR)
  })

  it("ranks by average percentile when Score is off the chart", () => {
    const offered = offeredVariants(snapshot, [
      { metric: "tokensPerSecond", source: "artificialAnalysis" },
      { metric: "durationSeconds", source: "deepswe" },
    ])
    const picks = defaultPicks(snapshot, offered, null, info)

    expect(picks.length).toBeGreaterThan(0)
    expect(picks.length).toBeLessThanOrEqual(DEFAULT_PICK_COUNT)
    const vendors = picks.map((id) => offered.find((model) => model.model === id)?.vendor)
    for (const vendor of new Set(vendors)) {
      expect(vendors.filter((each) => each === vendor).length).toBeLessThanOrEqual(
        DEFAULT_PICKS_PER_VENDOR,
      )
    }
  })

  it("picks nothing when no offered model has a score", () => {
    const offered = offeredVariants(snapshot, [
      { metric: "tokensPerSecond", source: "artificialAnalysis" },
    ]).filter(
      (model) => !snapshot.variants.deepswe.some((variant) => variant.entryId === model.model),
    )

    const unscored = {
      ...snapshot,
      variants: ProvidersService.record((source) =>
        snapshot.variants[source].map((variant) => ({
          ...variant,
          metrics: { ...variant.metrics, score: null },
        })),
      ),
    }
    expect(defaultPicks(unscored, offered, null, info)).toEqual([])
  })
})
