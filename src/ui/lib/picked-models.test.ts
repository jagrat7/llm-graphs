// @vitest-environment jsdom
import { createStore } from "jotai"
import { RESET } from "jotai/utils"
import { afterEach, describe, expect, it } from "vitest"

import { PICKED_MODELS_STORAGE_KEY, pickedModelsAtom } from "#/ui/lib/picked-models"

afterEach(() => localStorage.clear())

/** The atom reads storage when something first subscribes to it, as a mounted component does. */
function mountedStore() {
  const store = createStore()
  store.sub(pickedModelsAtom, () => {})
  return store
}

describe("picked models", () => {
  it("starts on the defaults when this browser has never picked", () => {
    expect(mountedStore().get(pickedModelsAtom)).toBeNull()
  })

  it("restores the picks a previous visit stored", () => {
    localStorage.setItem(PICKED_MODELS_STORAGE_KEY, JSON.stringify(["alpha", "beta"]))

    expect(mountedStore().get(pickedModelsAtom)).toEqual(["alpha", "beta"])
  })

  it("stores new picks and forgets them on reset", () => {
    const store = mountedStore()

    store.set(pickedModelsAtom, ["gamma"])
    expect(localStorage.getItem(PICKED_MODELS_STORAGE_KEY)).toBe('["gamma"]')

    store.set(pickedModelsAtom, RESET)
    expect(store.get(pickedModelsAtom)).toBeNull()
    expect(localStorage.getItem(PICKED_MODELS_STORAGE_KEY)).toBeNull()
  })

  it("ignores a stored value that is not a list of ids", () => {
    localStorage.setItem(PICKED_MODELS_STORAGE_KEY, JSON.stringify({ models: ["alpha"] }))
    expect(mountedStore().get(pickedModelsAtom)).toBeNull()

    localStorage.setItem(PICKED_MODELS_STORAGE_KEY, "not json")
    expect(mountedStore().get(pickedModelsAtom)).toBeNull()
  })
})
