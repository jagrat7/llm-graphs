import { describe, expect, it, vi } from "vitest"

import { selectFixtureSources } from "./refresh-model-fixtures"

describe("fixture source selection", () => {
  const sources = [{ name: "arena" }, { name: "artificialAnalysis" }, { name: "modelsDev" }]

  it("keeps all sources in registry order when none are requested", () => {
    expect(selectFixtureSources(sources, [])).toEqual(sources)
  })

  it("selects requested registry names once and preserves registry order", () => {
    expect(selectFixtureSources(sources, ["modelsDev", "arena", "arena"])).toEqual([
      sources[0],
      sources[2],
    ])
  })

  it("refreshes Arena without fetching a source that needs credentials", async () => {
    const arena = { name: "arena", fetchPayload: vi.fn(async () => ({ rows: ["arena"] })) }
    const artificialAnalysis = {
      name: "artificialAnalysis",
      fetchPayload: vi.fn(async () => {
        throw new Error("AA_API_KEY is required")
      }),
    }
    const selected = selectFixtureSources([arena, artificialAnalysis], ["arena"])
    expect(await Promise.all(selected.map((source) => source.fetchPayload()))).toEqual([
      { rows: ["arena"] },
    ])
    expect(arena.fetchPayload).toHaveBeenCalledOnce()
    expect(artificialAnalysis.fetchPayload).not.toHaveBeenCalled()
  })

  it("rejects unknown sources with the valid registry names", () => {
    expect(() => selectFixtureSources(sources, ["arena", "missing"])).toThrow(
      "Unknown source missing; one of arena, artificialAnalysis, modelsDev",
    )
  })
})
