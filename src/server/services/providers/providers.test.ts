import { describe, expect, it } from "vitest"

import artificialAnalysisFixture from "../model-aggregator/fixtures/artificial-analysis.json"
import { allFixtureInputs } from "../model-aggregator/fixture-inputs"
import { ProvidersService } from "."
import { METRIC_KEYS } from "./provider.types"

const { artificialAnalysis } = ProvidersService.metricSources
const aaRow = artificialAnalysisFixture.payload.rows[0]

function aaPrices(input: number | null, output: number | null) {
  return artificialAnalysis.readMetrics({
    ...aaRow,
    price_1m_input_tokens: input,
    price_1m_output_tokens: output,
  })
}

describe("ProvidersService", () => {
  it("offers each metric from the sources that publish it, default first", () => {
    expect(ProvidersService.providersFor("score")[0]).toBe("deepswe")
    expect(ProvidersService.providersFor("costPerTask")[0]).toBe("deepswe")
    expect(ProvidersService.providersFor("costPerMTokens")[0]).toBe("artificialAnalysis")
  })

  it("discovers every source's capabilities from real rows without a provider allowlist", () => {
    const inputs = allFixtureInputs().metricSources
    expect(new Set(inputs.map((input) => input.name))).toEqual(new Set(ProvidersService.names))
    for (const metric of METRIC_KEYS) {
      expect(
        ProvidersService.providersFor(metric).length,
        `${metric} has no source`,
      ).toBeGreaterThan(0)
      const measured = inputs
        .filter((input) => input.rows.some((row) => row.metrics[metric] != null))
        .map((input) => input.name)
      expect(new Set(ProvidersService.providersFor(metric)), metric).toEqual(new Set(measured))
    }
  })

  it.each([
    [1, 5, 2],
    [0, 12, 3],
    [4, 0, 3],
  ])(
    "shares AA's hosted prices across all three price axes: %s in, %s out",
    (input, output, blend) => {
      expect(aaPrices(input, output)).toMatchObject({
        costPerMTokens: blend,
        inputPricePerMTokens: input,
        outputPricePerMTokens: output,
      })
    },
  )

  it.each([
    [0, 0],
    [null, 5],
    [1, null],
    [-1, 5],
    [1, -5],
    [Infinity, 5],
    [1, Infinity],
    [NaN, 5],
    [1, NaN],
  ])("rejects unlisted or invalid AA prices on all three axes: %s in, %s out", (input, output) => {
    expect(aaPrices(input, output)).toMatchObject({
      costPerMTokens: null,
      inputPricePerMTokens: null,
      outputPricePerMTokens: null,
    })
  })
})

describe("ProvidersService.info", () => {
  it("returns serializable provider metadata with native score units and no downloader code", () => {
    const info = ProvidersService.info()

    expect(JSON.parse(JSON.stringify(info))).toEqual(info)
    expect(info.metricProviders.score).toEqual(ProvidersService.providersFor("score"))
    expect(info.presentation.metr.score).toEqual({
      label: "Task horizon (50%)",
      unit: "h",
      format: "hours",
    })
    expect(info.presentation.artificialAnalysis.score?.unit).toBe("points")
    expect(info.presentation.arena.score?.unit).toBe("points")
    expect(info.scopes.artificialAnalysis.costPerMTokens).toBe("model")
    expect(info.scopes.artificialAnalysis.inputPricePerMTokens).toBe("model")
    expect(info.scopes.artificialAnalysis.outputPricePerMTokens).toBe("model")
  })
})
