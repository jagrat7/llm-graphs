import { describe, expect, it } from "vitest"

import {
  changedSettings,
  DEFAULT_SETTINGS,
  highestEffortOnly,
  isDefaultSettings,
  parseSettings,
  withoutHiddenProviders,
} from "#/ui/lib/settings"

describe("settings", () => {
  it("starts on the defaults when this browser has never changed one", () => {
    expect(parseSettings(null)).toEqual({
      hiddenProviders: [],
      paretoFrontier: false,
      vendorLogos: true,
      paperGrid: true,
      effortLevels: "all",
    })
  })

  it("needs no cookie for the defaults, but does for any change", () => {
    expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true)
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS, hiddenProviders: ["xai"] })).toBe(false)
    // Every field counts, not only the ones someone remembered to list.
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const changed = typeof value === "boolean" ? !value : typeof value === "string" ? "x" : ["x"]

      expect(isDefaultSettings({ ...DEFAULT_SETTINGS, [key]: changed })).toBe(false)
    }
  })

  it("saves only the settings a reader changed, so the rest follow the defaults", () => {
    expect(changedSettings(DEFAULT_SETTINGS)).toEqual({})
    expect(changedSettings({ ...DEFAULT_SETTINGS, vendorLogos: false })).toEqual({
      vendorLogos: false,
    })
    // Read back, the untouched fields take whatever the defaults are now.
    expect(parseSettings({ vendorLogos: false })).toEqual({
      ...DEFAULT_SETTINGS,
      vendorLogos: false,
    })
  })

  it("keeps the valid fields of a stored value and defaults the rest", () => {
    expect(parseSettings({ hiddenProviders: ["meta"], paretoFrontier: "nope" })).toEqual({
      hiddenProviders: ["meta"],
      paretoFrontier: false,
      vendorLogos: true,
      paperGrid: true,
      effortLevels: "all",
    })
  })

  it("falls back to the defaults when the stored value is not an object", () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it("drops hidden providers' models and keeps models without a vendor", () => {
    const models = [
      { id: "a", vendor: "openai" },
      { id: "b", vendor: "xai" },
      { id: "c", vendor: null },
    ]

    expect(withoutHiddenProviders(models, ["xai"]).map((model) => model.id)).toEqual(["a", "c"])
  })
})

describe("highest effort only", () => {
  it("keeps each run's highest effort, separately per configuration", () => {
    const models = [
      { model: "a", effortOrder: 1, id: "a-low" },
      { model: "a", effortOrder: 3, id: "a-high" },
      { model: "a", configuration: "agent", effortOrder: 2, id: "a-agent" },
      { model: "b", effortOrder: 0, id: "b" },
    ]

    expect(highestEffortOnly(models).map((model) => model.id)).toEqual(["a-high", "a-agent", "b"])
  })
})
