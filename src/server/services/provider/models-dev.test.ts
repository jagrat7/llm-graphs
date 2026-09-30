import { afterEach, describe, expect, it, vi } from "vitest"

import { ModelsDevProvider } from "./models-dev"

const originalFetch = globalThis.fetch
const GENERIC_LOGO = "<svg>generic</svg>"

afterEach(() => {
  globalThis.fetch = originalFetch
})

function catalogFetch(models: Record<string, unknown>, overrides: Record<string, Response> = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname
    const override = overrides[path]
    if (override) return override

    if (path === "/models.json") return Response.json(models)
    if (path === "/api.json") {
      return Response.json({
        deepinfra: { id: "deepinfra", name: "Deep Infra", models: { big: {} } },
      })
    }
    if (path === "/logos/labs/openai.svg") return new Response("<svg>openai</svg>")

    return new Response(GENERIC_LOGO)
  })
}

const GPT = {
  id: "openai/gpt-6-astra",
  name: "GPT-6 Astra",
  family: "gpt",
  release_date: "2026-09-04",
  cost: { input: 10 },
}

describe("ModelsDevProvider", () => {
  it("caches the trimmed catalog, host names, and each vendor's logo", async () => {
    globalThis.fetch = catalogFetch({
      [GPT.id]: GPT,
      "zhipuai/glm-5-3": { ...GPT, id: "zhipuai/glm-5-3" },
    })

    const payload = await new ModelsDevProvider().fetchPayload()

    expect(payload.rows[0]).toEqual({
      id: "openai/gpt-6-astra",
      name: "GPT-6 Astra",
      release_date: "2026-09-04",
      family: "gpt",
    })
    expect(payload.providers).toEqual([{ id: "deepinfra", name: "Deep Infra" }])
    expect(payload.logos).toEqual({ openai: "<svg>openai</svg>", zhipuai: GENERIC_LOGO })
    expect(payload.genericLogo).toBe(GENERIC_LOGO)
  })

  it("fails on a non-2xx response", async () => {
    globalThis.fetch = catalogFetch(
      { [GPT.id]: GPT },
      { "/logos/labs/openai.svg": new Response("gone", { status: 500 }) },
    )

    await expect(new ModelsDevProvider().fetchPayload()).rejects.toThrow("500")
  })

  it("fails when no row parses", async () => {
    globalThis.fetch = catalogFetch({})

    await expect(new ModelsDevProvider().fetchPayload()).rejects.toThrow("no parseable rows")
  })

  it("drops and records a bad row without failing the fetch", async () => {
    globalThis.fetch = catalogFetch({ [GPT.id]: GPT, broken: { id: "broken", name: "" } })

    const payload = await new ModelsDevProvider().fetchPayload()

    expect(payload.rows.map((model) => model.id)).toEqual([GPT.id])
    expect(payload.dropped).toEqual([{ id: "broken", reason: expect.stringContaining("creator") }])
  })
})
