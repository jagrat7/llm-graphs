import { afterEach, describe, expect, it, vi } from "vitest"

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

afterEach(() => {
  vi.useRealTimers()
})

describe("MemoryStore locks", () => {
  it("won't let a holder whose lock expired release the next holder's lock", async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()
    const first = await store.acquireLock("lock", 60)

    vi.advanceTimersByTime(61_000)
    const second = await store.acquireLock("lock", 60)
    await store.releaseLock("lock", first ?? "")

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    await expect(store.acquireLock("lock", 60)).resolves.toBeNull()
  })
})

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

  it("keeps waiting on another instance's cold fetch, however long it runs", async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => 0)
    const fetchPayload = vi.fn(async () => "mine")
    const theirs = await store.acquireLock("test:source:lock", 30)

    const read = cache.read(source(fetchPayload))
    // The other instance's heartbeat keeps its lock through a ten-minute fetch.
    for (let elapsed = 0; elapsed < 10 * 60 * 1000; elapsed += 20_000) {
      await store.extendLock("test:source:lock", theirs ?? "", 30)
      await vi.advanceTimersByTimeAsync(20_000)
    }
    await store.set("test:source", { payload: "theirs", fetchedAt: new Date(0).toISOString() })
    await vi.advanceTimersByTimeAsync(1000)

    await expect(read).resolves.toMatchObject({ payload: "theirs" })
    expect(fetchPayload).not.toHaveBeenCalled()
  })

  it("fetches itself once another instance's cold fetch gives up", async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => 0)
    const fetchPayload = vi.fn(async () => "mine")
    const theirs = await store.acquireLock("test:source:lock", 5 * 60)

    const read = cache.read(source(fetchPayload))
    await vi.advanceTimersByTimeAsync(10_000)
    await store.releaseLock("test:source:lock", theirs ?? "")
    await vi.advanceTimersByTimeAsync(1000)

    await expect(read).resolves.toMatchObject({ payload: "mine" })
    expect(fetchPayload).toHaveBeenCalledTimes(1)
  })

  it("keeps a slow cold fetch's lock alive for as long as it runs", async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => 0)
    const { fetch: slow, finish } = pendingFetch()

    const read = cache.read(source(slow))
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)

    await expect(store.acquireLock("test:source:lock", 30)).resolves.toBeNull()
    finish("v1")
    await expect(read).resolves.toMatchObject({ payload: "v1" })
  })

  it("takes a turn within seconds when a cold fetch's holder dies", async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()
    const cache = new SourceCache(store, () => 0)
    const fetchPayload = vi.fn(async () => "mine")
    // Taken and never extended or released, as by a process that died mid-fetch.
    await store.acquireLock("test:source:lock", 30)

    const read = cache.read(source(fetchPayload))
    await vi.advanceTimersByTimeAsync(31_000)

    await expect(read).resolves.toMatchObject({ payload: "mine" })
    expect(fetchPayload).toHaveBeenCalledTimes(1)
  })
})
