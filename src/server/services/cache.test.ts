import { describe, expect, it, vi } from "vitest"

import type { SourceDefinition } from "./provider/provider.types"

import { MemoryStore, SourceCache } from "./cache"

vi.mock("#/env", () => ({ env: {} }))

const HOUR = 60 * 60 * 1000

function source(fetchPayload: () => Promise<string>): SourceDefinition<string> {
  return { name: "deepswe", cacheKey: "test:source", refreshWindowMs: HOUR, fetchPayload }
}

/** A fetch the test finishes by hand, to hold a request open. */
function pendingFetch() {
  const pending = { finish: (_value: string) => {} }
  const promise = new Promise<string>((resolve) => {
    pending.finish = resolve
  })

  return { ...pending, fetch: vi.fn(() => promise) }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("SourceCache", () => {
  it("fetches once on a cold cache, then answers from the stored copy", async () => {
    const fetchPayload = vi.fn(async () => "v1")
    const cache = new SourceCache(new MemoryStore(), () => 0)

    await expect(cache.read(source(fetchPayload))).resolves.toEqual({
      payload: "v1",
      fetchedAt: new Date(0).toISOString(),
    })
    await expect(cache.read(source(fetchPayload))).resolves.toMatchObject({ payload: "v1" })
    expect(fetchPayload).toHaveBeenCalledTimes(1)
  })

  it("answers a stale read from the old copy and refreshes once in the background", async () => {
    let now = 0
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => now)
    const fetchPayload = vi.fn(async () => "v1")
    await cache.read(source(fetchPayload))

    now = 2 * HOUR
    fetchPayload.mockImplementation(async () => "v2")
    const reads = await Promise.all([
      cache.read(source(fetchPayload)),
      cache.read(source(fetchPayload)),
    ])
    await flush()

    expect(reads.map((read) => read?.payload)).toEqual(["v1", "v1"])
    expect(fetchPayload).toHaveBeenCalledTimes(2)
    await expect(cache.read(source(fetchPayload))).resolves.toMatchObject({ payload: "v2" })
  })

  it("keeps the last good copy when a refresh fails, however old it is", async () => {
    let now = 0
    const cache = new SourceCache(new MemoryStore(), () => now)
    const fetchPayload = vi.fn(async () => "v1")
    await cache.read(source(fetchPayload))

    now = 30 * 24 * HOUR
    fetchPayload.mockRejectedValue(new Error("down"))
    vi.spyOn(console, "warn").mockImplementation(() => {})
    await cache.read(source(fetchPayload))
    await flush()

    await expect(cache.read(source(fetchPayload))).resolves.toEqual({
      payload: "v1",
      fetchedAt: new Date(0).toISOString(),
    })
  })

  it("returns nothing when a cold fetch fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const cache = new SourceCache(new MemoryStore(), () => 0)

    await expect(cache.read(source(async () => Promise.reject(new Error("down"))))).resolves.toBe(
      null,
    )
  })

  it("fetches once when concurrent reads find nothing cached", async () => {
    const { fetch: fetchPayload, finish } = pendingFetch()
    const cache = new SourceCache(new MemoryStore(), () => 0)

    const reads = Promise.all([
      cache.read(source(fetchPayload)),
      cache.read(source(fetchPayload)),
      cache.read(source(fetchPayload)),
    ])
    await flush()
    finish("v1")

    expect((await reads).map((read) => read?.payload)).toEqual(["v1", "v1", "v1"])
    expect(fetchPayload).toHaveBeenCalledTimes(1)
  })

  it("never lets a slower, older fetch overwrite a newer copy", async () => {
    let now = 0
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => now)
    const { fetch: slow, finish } = pendingFetch()

    const read = cache.read(source(slow))
    await flush()
    now = 10
    await store.set("test:source", { payload: "newer", fetchedAt: new Date(5).toISOString() })
    finish("older")

    await expect(read).resolves.toMatchObject({ payload: "newer" })
    await expect(store.get("test:source")).resolves.toMatchObject({ payload: "newer" })
  })
})
