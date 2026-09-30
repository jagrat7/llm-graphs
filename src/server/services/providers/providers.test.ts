import { describe, expect, it } from "vitest"

import artificialAnalysisFixture from "../model-aggregator/fixtures/artificial-analysis.json"
import deepsweFixture from "../model-aggregator/fixtures/deepswe.json"
import { ProvidersService } from "."
import { METRIC_KEYS, type MetricSource } from "./provider.types"

const { deepswe, artificialAnalysis } = ProvidersService.metricSources
const aaRow = artificialAnalysisFixture.payload.rows[0]

/** The metrics a source lists that no row has a value for, which is how a misspelled field shows up. */
function neverRead<TRow>(source: MetricSource<unknown, TRow>, rows: ReadonlyArray<TRow>) {
  const read = rows.map((row) => source.readMetrics(row))

  return METRIC_KEYS.filter(
    (metric) => source.metrics[metric] != null && read.every((values) => values[metric] == null),
  )
}

function aaCost(input: number | null, output: number | null) {
  return artificialAnalysis.readMetrics({
    ...aaRow,
    price_1m_input_tokens: input,
    price_1m_output_tokens: output,
  }).costPerMTokens
}

describe("ProvidersService", () => {
  it("offers each metric from the sources that publish it, default first", () => {
    expect({
      score: ProvidersService.providersFor("score"),
      costPerTask: ProvidersService.providersFor("costPerTask"),
      costPerMTokens: ProvidersService.providersFor("costPerMTokens"),
      tokensPerSecond: ProvidersService.providersFor("tokensPerSecond"),
      durationSeconds: ProvidersService.providersFor("durationSeconds"),
    }).toEqual({
      score: ["deepswe"],
      costPerTask: ["deepswe"],
      costPerMTokens: ["artificialAnalysis"],
      tokensPerSecond: ["artificialAnalysis"],
      durationSeconds: ["deepswe"],
    })
  })

  it("reads a value for every metric a source lists from some real row", () => {
    expect(neverRead(deepswe, deepsweFixture.payload.rows)).toEqual([])
    expect(neverRead(artificialAnalysis, artificialAnalysisFixture.payload.rows)).toEqual([])
  })

  it("blends AA's prices three parts input to one part output", () => {
    expect(aaCost(1, 5)).toBe(2)
  })

  it("treats AA's $0 listing as no price", () => {
    expect(aaCost(0, 0)).toBeNull()
    expect(aaCost(null, 5)).toBeNull()
  })
})
