import { describe, expect, it } from "vitest"

import { ModelsDevListingProvider, parseModelsDevListing } from "./listing"

const provider = new ModelsDevListingProvider()

function model(id: string, context: number | null = 200_000) {
  return { id, name: id, limit: context == null ? undefined : { context, output: 8192 } }
}

function listing(models: Array<ReturnType<typeof model>>, hosts: Record<string, unknown>) {
  return parseModelsDevListing(Object.fromEntries(models.map((entry) => [entry.id, entry])), hosts)
}

describe("ModelsDevListingProvider", () => {
  it("prices a model from its own lab's API and ignores resellers", () => {
    const { rows } = listing([model("openai/gpt-5"), model("meta/llama-4")], {
      openai: { models: { "gpt-5": { cost: { input: 1.25, output: 10, cache_read: 0.125 } } } },
      deepinfra: { models: { "llama-4": { cost: { input: 0.1, output: 0.3 } } } },
    })

    expect(rows.map((row) => provider.readMetrics(row))).toEqual([
      { inputPricePerMTokens: 1.25, outputPricePerMTokens: 10, contextTokens: 200_000 },
      { inputPricePerMTokens: null, outputPricePerMTokens: null, contextTokens: 200_000 },
    ])
  })

  it.each([
    ["listed at $0 in and out", { cost: { input: 0, output: 0 } }],
    ["without a cost", {}],
    ["with half a price", { cost: { input: 2 } }],
    ["with a negative price", { cost: { input: -1, output: 4 } }],
  ])("leaves a model unpriced when its lab lists it %s", (_, entry) => {
    const { rows } = listing([model("google/gemma-4")], {
      google: { models: { "gemma-4": entry } },
    })

    expect(rows[0].prices).toBeNull()
  })

  it("keeps a model whose context is 0 or missing, without a context", () => {
    const { rows, dropped } = listing([model("openai/gpt-image-2", 0), model("x/y", null)], {
      openai: { models: { "gpt-image-2": { cost: { input: 5, output: 40 } } } },
    })

    expect(dropped).toEqual([])
    expect(rows.map((row) => [row.contextTokens, row.prices])).toEqual([
      [null, { input: 5, output: 40 }],
      [null, null],
    ])
  })

  it("skips a host that doesn't parse without losing the others", () => {
    const { rows } = listing([model("anthropic/claude-opus-4-5"), model("xai/grok-5")], {
      anthropic: { models: { "claude-opus-4-5": { cost: { input: 5, output: 25 } } } },
      xai: "not a host",
    })

    expect(rows.map((row) => row.prices)).toEqual([{ input: 5, output: 25 }, null])
  })

  it("gives each catalog model one row with no effort, for the catalog to name", () => {
    const [row] = provider.toMetricRows(listing([model("openai/gpt-5")], {}))

    expect(row).toMatchObject({
      sourceModelId: "openai/gpt-5",
      rawId: "openai/gpt-5",
      mode: "unknown",
      level: "unknown",
      metadata: null,
    })
  })
})
