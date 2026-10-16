import { atomWithStorage, createJSONStorage } from "jotai/utils"

export const PICKED_MODELS_STORAGE_KEY = "picked-models"

/** `null` means the reader has never picked, so the chart opens on its default models. */
export type PickedModels = Array<string> | null

export function isPickedModels(value: unknown): value is PickedModels {
  return value === null || (Array.isArray(value) && value.every((id) => typeof id === "string"))
}

const json = createJSONStorage<unknown>()
const valid = (value: unknown, fallback: PickedModels) => (isPickedModels(value) ? value : fallback)

/**
 * The models a reader chose, by entry id, kept in this browser so they survive reloads and
 * switching benchmarks. Read on mount rather than on init, so the server render and the first
 * client render agree; other tabs pick up changes through the `storage` event.
 */
export const pickedModelsAtom = atomWithStorage<PickedModels>(PICKED_MODELS_STORAGE_KEY, null, {
  getItem: (key, fallback) => valid(json.getItem(key, fallback), fallback),
  setItem: (key, value) => {
    try {
      json.setItem(key, value)
    } catch {
      // Private browsing denies writes; the picks still hold for this session.
    }
  },
  removeItem: (key) => json.removeItem(key),
  subscribe: (key, callback, fallback) =>
    json.subscribe?.(key, (value) => callback(valid(value, fallback)), fallback),
})
