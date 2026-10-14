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
  it("keeps task cost absent and rejects invalid prices and output speed", () => {
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
    expect(provider.readMetrics(measured)).toEqual({ costPerMTokens: 2, tokensPerSecond: 120 })
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
