// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** jsdom has no Cookie Store API, so stand in a map that fires the same change events. */
class FakeCookieStore extends EventTarget {
  cookies = new Map<string, string>()

  async set({ name, value }: { name: string; value: string }) {
    this.cookies.set(name, value)
    this.dispatchEvent(
      Object.assign(new Event("change"), { changed: [{ name, value }], deleted: [] }),
    )
  }

  async delete({ name }: { name: string }) {
    this.cookies.delete(name)
    this.dispatchEvent(Object.assign(new Event("change"), { changed: [], deleted: [{ name }] }))
  }
}

let store: FakeCookieStore

beforeEach(() => {
  store = new FakeCookieStore()
  vi.stubGlobal("cookieStore", store)
  // The module keeps this tab's latest picks, so each test starts from a fresh copy.
  vi.resetModules()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const load = () => import("#/ui/lib/picked-models")

describe("picked models", () => {
  it("shows the loader's picks until this tab saves any", async () => {
    const { usePickedModels } = await load()

    expect(renderHook(() => usePickedModels(["alpha"])).result.current).toEqual(["alpha"])
    expect(renderHook(() => usePickedModels(null)).result.current).toBeNull()
  })

  it("shows a save at once and writes it to the cookie", async () => {
    const { PICKED_MODELS_COOKIE, parsePickedModels, savePickedModels, usePickedModels } =
      await load()
    const { result } = renderHook(() => usePickedModels(null))

    await act(() => savePickedModels(["alpha", "beta"]))

    expect(result.current).toEqual(["alpha", "beta"])
    expect(parsePickedModels(decodeURIComponent(store.cookies.get(PICKED_MODELS_COOKIE)!))).toEqual(
      ["alpha", "beta"],
    )
  })

  it("forgets picks on reset", async () => {
    const { PICKED_MODELS_COOKIE, savePickedModels, usePickedModels } = await load()
    const { result } = renderHook(() => usePickedModels(["alpha"]))

    await act(() => savePickedModels(["gamma"]))
    await act(() => savePickedModels(null))

    expect(result.current).toBeNull()
    expect(store.cookies.has(PICKED_MODELS_COOKIE)).toBe(false)
  })

  it("follows picks changed in another tab", async () => {
    const { PICKED_MODELS_COOKIE, usePickedModels } = await load()
    const { result } = renderHook(() => usePickedModels(null))

    await act(() =>
      store.set({ name: PICKED_MODELS_COOKIE, value: encodeURIComponent('["delta"]') }),
    )
    expect(result.current).toEqual(["delta"])

    await act(() => store.delete({ name: PICKED_MODELS_COOKIE }))
    expect(result.current).toBeNull()
  })

  it("keeps the same picks object when its own save echoes back", async () => {
    const { savePickedModels, usePickedModels } = await load()
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return usePickedModels(null)
    })

    await act(() => savePickedModels(["epsilon"]))

    expect(result.current).toEqual(["epsilon"])
    expect(renders).toBe(2)
  })

  it("ignores a value that is not a list of ids", async () => {
    const { parsePickedModels } = await load()

    expect(parsePickedModels(JSON.stringify({ models: ["alpha"] }))).toBeNull()
    expect(parsePickedModels("not json")).toBeNull()
    expect(parsePickedModels(undefined)).toBeNull()
  })
})
