import { afterEach, describe, expect, it, vi } from "vitest"

import { ArtificialAnalysisProvider } from "./artificial-analysis"

const originalFetch = globalThis.fetch

vi.mock("#/env", () => ({ env: { AA_API_KEY: "test-api-key" } }))

afterEach(() => {
  globalThis.fetch = originalFetch
})

function row(slug: string) {
  return {
    id: `id-${slug}`,
    name: slug,
    slug,
    release_date: "2026-09-01",
    model_creator: { name: "OpenAI" },
    pricing: { price_1m_input_tokens: 0.2, price_1m_output_tokens: 0.8 },
    performance: { median_output_tokens_per_second: 120 },
  }
}

function page(data: Array<unknown>, hasMore = false) {
  return Response.json({ data, pagination: { has_more: hasMore } })
}

describe("ArtificialAnalysisProvider", () => {
  it("keeps missing index measurements null and rejects invalid prices and output speed", () => {
    const provider = new ArtificialAnalysisProvider()
    const measured = {
      id: "test",
      name: "test",
      slug: "test",
      release_date: null,
      model_creator: null,
      price_1m_input_tokens: 1,
      price_1m_output_tokens: 5,
      median_output_tokens_per_second: 120,
    }
    expect(provider.readMetrics(measured)).toEqual({
      score: null,
      costPerTask: null,
      costPerMTokens: 2,
      tokensPerSecond: 120,
    })
    for (const value of [null, -1, Infinity, NaN]) {
      expect(
        provider.readMetrics({ ...measured, price_1m_input_tokens: value }).costPerMTokens,
      ).toBeNull()
      expect(
        provider.readMetrics({ ...measured, price_1m_output_tokens: value }).costPerMTokens,
      ).toBeNull()
      expect(
        provider.readMetrics({ ...measured, median_output_tokens_per_second: value })
          .tokensPerSecond,
      ).toBeNull()
    }
    expect(
      provider.readMetrics({ ...measured, median_output_tokens_per_second: 0 }).tokensPerSecond,
    ).toBeNull()
  })

  it("keeps only the fields the aggregator reads, across every page", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(page([row("gpt-6-astra")], true))
      .mockResolvedValueOnce(page([row("gpt-6-astra-low")]))

    const payload = await new ArtificialAnalysisProvider().fetchPayload()

    expect(payload.rows).toEqual([
      {
        id: "id-gpt-6-astra",
        intelligence_index: null,
        cost_per_task: null,
        index_version: null,
        name: "gpt-6-astra",
        slug: "gpt-6-astra",
        release_date: "2026-09-01",
        model_creator: { name: "OpenAI" },
        median_output_tokens_per_second: 120,
        price_1m_input_tokens: 0.2,
        price_1m_output_tokens: 0.8,
      },
      expect.objectContaining({ slug: "gpt-6-astra-low" }),
    ])
    expect(payload.dropped).toEqual([])
  })

  it("fails on a non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("rate limited", { status: 429 }))

    await expect(new ArtificialAnalysisProvider().fetchPayload()).rejects.toThrow("429")
  })

  it("fails when pagination ends before the last page", async () => {
    globalThis.fetch = vi.fn(async () => page([row("gpt-6-astra")], true))

    await expect(new ArtificialAnalysisProvider().fetchPayload()).rejects.toThrow("more pages")
  })

  it("fails when no row parses", async () => {
    globalThis.fetch = vi.fn(async () => page([{ slug: 42 }]))

    await expect(new ArtificialAnalysisProvider().fetchPayload()).rejects.toThrow(
      "no parseable rows",
    )
  })

  it("drops and records a bad row without failing the fetch", async () => {
    globalThis.fetch = vi.fn(async () => page([row("gpt-6-astra"), { slug: "broken" }]))

    const payload = await new ArtificialAnalysisProvider().fetchPayload()

    expect(payload.rows.map((model) => model.slug)).toEqual(["gpt-6-astra"])
    expect(payload.dropped).toEqual([{ id: "broken", reason: expect.stringContaining("id") }])
  })

  it("keeps a row that has metrics but no name", async () => {
    const { name: _name, ...nameless } = row("gpt-6-astra")
    globalThis.fetch = vi.fn(async () => page([nameless]))

    const payload = await new ArtificialAnalysisProvider().fetchPayload()

    expect(payload.rows).toEqual([expect.objectContaining({ slug: "gpt-6-astra", name: null })])
    expect(payload.dropped).toEqual([])
  })
})

describe("AA benchmark coherence", () => {
  it("reads score and reported task cost from the same API row without blending token prices", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        intelligence_index_version: 4.3,
        data: [
          {
            ...row("gemini-3-5-flash"),
            evaluations: { artificial_analysis_intelligence_index: 32.6 },
            artificial_analysis_intelligence_index_cost: {
              total_cost: 2172.43,
              cost_per_task: { total_cost: 1.5625 },
            },
          },
        ],
        pagination: { has_more: false },
      }),
    )
    const provider = new ArtificialAnalysisProvider()
    const payload = await provider.fetchPayload()
    expect(provider.readMetrics(payload.rows[0])).toMatchObject({
      score: 32.6,
      costPerTask: 1.5625,
    })
    expect(provider.readMetrics(payload.rows[0]).costPerMTokens).toBeCloseTo(0.35)
    expect(provider.toMetricRows(payload)[0].measurements?.score?.label).toContain("v4.3")
    expect(() => provider.validatePayload(payload)).not.toThrow()
    expect(() =>
      provider.validatePayload({
        ...payload,
        rows: payload.rows.map((item) => ({ ...item, intelligence_index: null })),
      }),
    ).toThrow("score")
  })
  it("refuses pages from different index releases", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [row("first")],
          pagination: { has_more: true },
          intelligence_index_version: 4.2,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [row("second")],
          pagination: { has_more: false },
          intelligence_index_version: 4.3,
        }),
      )
    await expect(new ArtificialAnalysisProvider().fetchPayload()).rejects.toThrow("version changed")
  })
})
