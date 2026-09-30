import { describe, expect, it } from "vitest"

import { aggregateModels, type Derivation } from "./derive"
import { buildDiagnostics } from "./diagnostics"
import { fixtureInputs, fixtures } from "./fixture-inputs"

const derivation = aggregateModels(fixtureInputs())
const { snapshot } = derivation
const report = buildDiagnostics(derivation)

function entry(id: string) {
  return snapshot.entries.find((candidate) => candidate.id === id)
}

function provenance(id: string) {
  return derivation.provenance.find((candidate) => candidate.id === id)
}

function variants(source: "deepswe" | "artificialAnalysis", id: string) {
  return snapshot.variants[source]
    .filter((variant) => variant.entryId === id)
    .map((variant) => `${variant.mode}/${variant.level}`)
}

describe("model aggregation", () => {
  it("ranks known effort levels low to high consistently across sources", () => {
    const fable = snapshot.variants.deepswe
      .filter((variant) => variant.entryId === "claude-fable-5")
      .toSorted((left, right) => left.effortOrder - right.effortOrder)

    expect(fable.map((variant) => variant.level)).toEqual(["low", "medium", "high", "xhigh", "max"])
    const aaMax = snapshot.variants.artificialAnalysis.find(
      (variant) => variant.entryId === "claude-fable-5" && variant.level === "max",
    )
    expect(aaMax?.effortOrder).toBe(fable.at(-1)?.effortOrder)
  })

  it("names a model the way models.dev does: gpt-6-astra is GPT-6 Astra", () => {
    expect(entry("gpt-6-astra")).toMatchObject({ name: "GPT-6 Astra", vendor: "openai" })
  })

  it("keeps max in qwen3-8-max's id instead of reading it as effort", () => {
    expect(entry("qwen3-8-max")).toBeDefined()
    expect(entry("qwen3-8")).toBeUndefined()
    expect(variants("artificialAnalysis", "qwen3-8-max")).toEqual(["unknown/unknown"])
  })

  it("pairs undated claude-3-7-sonnet with models.dev's -20250219", () => {
    expect(provenance("claude-3-7-sonnet-20250219")).toMatchObject({
      joinedBy: "date",
      members: [
        { source: "artificialAnalysis", id: "claude-3-7-sonnet" },
        { source: "modelsDev", id: "anthropic/claude-3-7-sonnet-20250219" },
      ],
    })
  })

  it("never pairs two different command-r dates", () => {
    const commandR = derivation.provenance.filter((candidate) => /^command-r-\d/.test(candidate.id))

    expect(commandR.length).toBeGreaterThan(0)
    for (const candidate of commandR) expect(candidate.joinedBy).toBe("key")
    expect(
      derivation.unresolvedDateGroups.some((group) =>
        group.ids.some((member) => member.id.startsWith("command-r-0")),
      ),
    ).toBe(true)
  })

  it("maps AA's Kimi creator to models.dev's moonshotai vendor", () => {
    const kimi = derivation.provenance.find(
      (candidate) =>
        candidate.creator === "Kimi" && candidate.metadataFrom === "artificialAnalysis",
    )

    expect(kimi?.vendorRule).toBe("creator vote")
    expect(entry(kimi?.id ?? "")?.vendor).toBe("moonshotai")
  })

  it("keeps every DeepSWE id as the entry id", () => {
    const deepsweIds = new Set(fixtures.deepswe.payload.rows.map((row) => row.model))
    const entryIds = new Set(snapshot.variants.deepswe.map((variant) => variant.entryId))

    expect(deepsweIds.size).toBe(28)
    expect(entryIds).toEqual(deepsweIds)
  })

  it("never lends Fable 5's AA on/max speed to its DeepSWE low row", () => {
    expect(variants("deepswe", "claude-fable-5")).toContain("on/low")
    expect(variants("artificialAnalysis", "claude-fable-5")).toEqual(["on/max"])
  })

  it("breaks no invariant on real payloads", () => {
    expect(report.failures).toEqual({
      duplicateEntryIds: [],
      emptyNames: [],
      unattachedRows: [],
      futureReleaseDates: [],
      droppedRows: [],
    })
    expect(report.counts.failures).toBe(0)
  })

  it("reports declined matches per source and per model, never per pair of sources", () => {
    expect(Object.keys(report.sources).toSorted()).toEqual([
      "arena",
      "artificialAnalysis",
      "deepswe",
      "metr",
      "modelsDev",
    ])
    expect(report.unresolvedDateGroups).toContainEqual(
      expect.objectContaining({
        ids: expect.arrayContaining([
          { source: "modelsDev", id: "mistral/mistral-large-2411" },
          { source: "modelsDev", id: "mistral/mistral-large-2512" },
        ]),
      }),
    )
    expect(report.models.noSharedVariant).toContainEqual({
      id: "claude-sonnet-4-6",
      variants: { artificialAnalysis: ["off/high", "off/low", "on/max"], deepswe: ["on/high"] },
    })
  })

  it("reads a nameless AA row's slug level only where named rows state levels for its model", () => {
    const nameless = new Set([
      "gpt-6-astra-low",
      "qwen3-8-max",
      "mistral-medium",
      "claude-sonnet-4-6-non-reasoning-low-effort",
    ])
    const { snapshot: result } = aggregateModels(
      fixtureInputs({
        ...fixtures.artificialAnalysis,
        payload: {
          ...fixtures.artificialAnalysis.payload,
          rows: fixtures.artificialAnalysis.payload.rows.map((row) =>
            nameless.has(row.slug) ? { ...row, name: null } : row,
          ),
        },
      }),
    )
    const variantsOf = (id: string) =>
      result.variants.artificialAnalysis
        .filter((variant) => variant.entryId === id)
        .map((variant) => `${variant.mode}/${variant.level}`)

    expect(result.entries.some((candidate) => candidate.id === "gpt-6-astra-low")).toBe(false)
    expect(variantsOf("gpt-6-astra")).toContain("on/low")
    expect(variantsOf("qwen3-8-max")).toEqual(["unknown/unknown"])
    expect(variantsOf("mistral-medium")).toEqual(["unknown/unknown"])
    expect(variantsOf("claude-sonnet-4-6")).toContain("off/low")
  })

  it("matches the committed whole model-list snapshot and report", async () => {
    await expect(snapshotText(derivation)).toMatchFileSnapshot("./__snapshots__/models.jsonl")
    await expect(`${JSON.stringify(report, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/diagnostics.json",
    )
  })
})

/** One line per entry, so a rule change diffs as exactly the entries it touched. */
function snapshotText({ snapshot: result, provenance: sources }: Derivation) {
  const lines = result.entries.map((modelEntry, index) => {
    const from = sources[index]
    const variantsOf = (source: "deepswe" | "artificialAnalysis") =>
      result.variants[source]
        .filter((variant) => variant.entryId === modelEntry.id)
        .map((variant) => `${variant.mode}/${variant.level}${variant.refused ? "!" : ""}`)

    return JSON.stringify({
      ...modelEntry,
      logo: modelEntry.vendor != null && modelEntry.vendor in result.logos,
      metadataFrom: from.metadataFrom,
      vendorRule: from.vendorRule,
      creator: from.creator,
      joinedBy: from.joinedBy,
      members: from.members.map((member) => `${member.source}:${member.id}`),
      deepswe: variantsOf("deepswe"),
      artificialAnalysis: variantsOf("artificialAnalysis"),
    })
  })

  return `${lines.join("\n")}\n`
}
