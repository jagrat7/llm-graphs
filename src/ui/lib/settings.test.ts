// @vitest-environment jsdom
import { createStore } from "jotai"
import { RESET } from "jotai/utils"
import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  highestEffortOnly,
  settingsAtom,
  withoutHiddenProviders,
} from "#/ui/lib/settings"

afterEach(() => localStorage.clear())

/** The atom reads storage when something first subscribes to it, as a mounted component does. */
function mountedStore() {
  const store = createStore()
  store.sub(settingsAtom, () => {})
  return store
}

describe("settings", () => {
  it("starts on the defaults when this browser has never changed one", () => {
    expect(mountedStore().get(settingsAtom)).toEqual({
      hiddenProviders: [],
      paretoFrontier: true,
      vendorLogos: true,
      effortLevels: "all",
      openingModels: 9,
    })
  })

  it("stores changes and forgets them on reset", () => {
    const store = mountedStore()

    store.set(settingsAtom, { ...DEFAULT_SETTINGS, hiddenProviders: ["xai"] })
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      hiddenProviders: ["xai"],
    })

    store.set(settingsAtom, RESET)
    expect(store.get(settingsAtom)).toEqual(DEFAULT_SETTINGS)
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it("keeps the valid fields of a stored value and defaults the rest", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ hiddenProviders: ["meta"], paretoFrontier: "nope", openingModels: 7 }),
    )

    expect(mountedStore().get(settingsAtom)).toEqual({
      hiddenProviders: ["meta"],
      paretoFrontier: true,
      vendorLogos: true,
      effortLevels: "all",
      openingModels: 9,
    })
  })

  it("falls back to the defaults when the stored value is not an object", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify([]))

    expect(mountedStore().get(settingsAtom)).toEqual(DEFAULT_SETTINGS)
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
