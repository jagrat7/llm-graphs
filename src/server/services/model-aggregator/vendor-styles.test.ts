import { describe, expect, it, vi } from "vitest"

import { aggregateModels } from "./derive"
import { fixtureInputs } from "./fixture-inputs"
import { modelColors, oklch, vendorHue } from "./metadata"

vi.mock("../providers/models-dev/vendor-styles", () => ({
  VENDOR_STYLES: {
    anthropic: { color: "#D97757", logo: "<svg>claude</svg>" },
    openai: { color: "#FFFFFF" },
  },
}))

describe("vendor styles", () => {
  const { snapshot } = aggregateModels(fixtureInputs())
  const ofVendor = (vendor: string) => snapshot.entries.filter((entry) => entry.vendor === vendor)

  it("reads a brand colour's OKLCH hue", () => {
    expect(oklch("#D97757").hue).toBe(39)
    expect(oklch("#4285F4").hue).toBe(260)
  })

  it("puts a styled vendor's models on hues close to its brand", () => {
    const hues = ofVendor("anthropic").map((entry) => entry.hue!)

    expect(hues).toContain(39)
    for (const hue of hues) expect(Math.abs(hue - 39)).toBeLessThanOrEqual(20)
    expect(snapshot.logos.anthropic).toBe("<svg>claude</svg>")
  })

  it("draws a black-and-white brand in shades of ink, tinted toward its hashed hue", () => {
    const openai = ofVendor("openai")

    expect(openai.length).toBeGreaterThan(0)
    for (const entry of openai) {
      expect(entry.hue).toBe(vendorHue("openai"))
      expect([0, 1, 2]).toContain(entry.shade)
    }
  })

  it("keeps other vendors around their hashed hue", () => {
    const other = snapshot.entries.find(
      (entry) => entry.vendor != null && !["anthropic", "openai"].includes(entry.vendor),
    )!
    const offset = ((other.hue! - vendorHue(other.vendor!) + 540) % 360) - 180

    expect(Math.abs(offset)).toBeLessThanOrEqual(20)
    expect(other.shade).toBeUndefined()
  })
})

describe("model colours", () => {
  const entries = [
    { id: "old", vendor: "acme", releaseDate: "2024-01-01" },
    { id: "new", vendor: "acme", releaseDate: "2026-01-01" },
    { id: "mid", vendor: "acme", releaseDate: "2025-01-01" },
    { id: "undated", vendor: "acme", releaseDate: null },
    { id: "anon", vendor: null, releaseDate: "2026-01-01" },
  ]

  it("gives the newest model the brand hue and alternates the rest either side", () => {
    const hue = oklch("#D97757").hue

    expect(Object.fromEntries(modelColors(entries, () => ({ color: "#D97757" })))).toEqual({
      new: { hue },
      mid: { hue: hue + 10 },
      old: { hue: hue - 10 },
      undated: { hue: hue + 20 },
      anon: { hue: null },
    })
  })

  it("steps a black-and-white brand's models from ink toward grey, all on its tint hue", () => {
    const hue = oklch("#1783FF").hue

    expect(
      Object.fromEntries(modelColors(entries, () => ({ color: "#FFFFFF", tint: "#1783FF" }))),
    ).toEqual({
      new: { hue, shade: 0 },
      mid: { hue, shade: 1 },
      old: { hue, shade: 2 },
      undated: { hue, shade: 0 },
      anon: { hue: null },
    })
  })
})
