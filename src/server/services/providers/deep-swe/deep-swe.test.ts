import { afterEach, describe, expect, it, vi } from "vitest"

import { DeepSWEProvider } from "./deep-swe"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function row(model: string, effort: string | null) {
  return {
    model,
    reasoning_effort: effort,
    config: `mini_swe_agent_${model}`,
    pass_rate: 0.5,
    mean_duration_seconds: 900,
    mean_input_tokens: 1_000_000,
    mean_output_tokens: 20_000,
    mean_cost_usd: 3,
  }
}

describe("DeepSWEProvider", () => {
  it("uses the published task cost without dividing it by token usage", () => {
    const provider = new DeepSWEProvider()
    const measured = row("gpt-6-astra", "high")
    expect(provider.readMetrics(measured)).toMatchObject({
      score: 50,
      costPerTask: 3,
      durationSeconds: 900,
    })
    expect(
      provider.readMetrics({ ...measured, mean_input_tokens: null, mean_output_tokens: null })
        .costPerTask,
    ).toBe(3)
    expect(provider.readMetrics(measured)).not.toHaveProperty("costPerMTokens")
    expect(provider.readMetrics({ ...measured, mean_cost_usd: 0 }).costPerTask).toBe(0)
  })

  it("keeps missing and invalid measurements unavailable without losing valid metrics", () => {
    const provider = new DeepSWEProvider()
    const measured = row("gpt-6-astra", "high")
    for (const value of [null, -1, Infinity, NaN]) {
      expect(provider.readMetrics({ ...measured, mean_cost_usd: value }).costPerTask).toBeNull()
      expect(
        provider.readMetrics({ ...measured, mean_duration_seconds: value }).durationSeconds,
      ).toBeNull()
    }
    expect(
      provider.readMetrics({ ...measured, mean_duration_seconds: 0 }).durationSeconds,
    ).toBeNull()
    for (const value of [-0.1, 1.1, Infinity, NaN]) {
      expect(provider.readMetrics({ ...measured, pass_rate: value }).score).toBeNull()
    }
    expect(provider.readMetrics({ ...measured, pass_rate: 0 }).score).toBe(0)
  })

  it("keeps only the fields the aggregator reads", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ rows: [row("kimi-k2-7-code", null)] }))

    const payload = await new DeepSWEProvider().fetchPayload()

    expect(payload.rows).toEqual([
      {
        model: "kimi-k2-7-code",
        reasoning_effort: null,
        pass_rate: 0.5,
        mean_duration_seconds: 900,
        mean_input_tokens: 1_000_000,
        mean_output_tokens: 20_000,
        mean_cost_usd: 3,
      },
    ])
  })

  it("fails on a non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 }))

    await expect(new DeepSWEProvider().fetchPayload()).rejects.toThrow("503")
  })

  it("fails when no row parses", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ rows: [] }))

    await expect(new DeepSWEProvider().fetchPayload()).rejects.toThrow("no parseable rows")
  })

  it("drops and records a bad row without failing the fetch", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ rows: [row("gpt-6-astra", "high"), { model: "broken", pass_rate: "n/a" }] }),
    )

    const payload = await new DeepSWEProvider().fetchPayload()

    expect(payload.rows.map((model) => model.model)).toEqual(["gpt-6-astra"])
    expect(payload.dropped).toEqual([
      { id: "broken", reason: expect.stringContaining("pass_rate") },
    ])
  })
})
