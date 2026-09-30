import { afterEach, describe, expect, it, vi } from "vitest"

import { DeepSWEProvider } from "./deep-swe"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function row(model: string, effort: string | null) {
  return {
    model,
    provider: null,
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
  it("keeps only the fields the registry reads", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ rows: [row("kimi-k2-7-code", null)] }))

    const payload = await new DeepSWEProvider().fetchPayload()

    expect(payload.rows).toEqual([
      {
        model: "kimi-k2-7-code",
        provider: null,
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
