import { describe, expect, it, vi } from "vitest"

import { MemoryStore, SOURCE_STAMPS_KEY, SourceCache } from "../cache/cache"
import { ProvidersService } from "../providers"
import { buildDiagnostics } from "./diagnostics"
import { fixtures } from "./fixture-inputs"
import { ModelAggregatorService } from "."

vi.mock("./diagnostics", async (importOriginal) => {
  const original = await importOriginal<typeof import("./diagnostics")>()
  return { ...original, buildDiagnostics: vi.fn(original.buildDiagnostics) }
})

const payloads = [
  ...Object.values(ProvidersService.metricSources).map((source) => ({
    key: source.cacheKey,
    value: fixtures[source.name],
  })),
  { key: ProvidersService.catalog.cacheKey, value: fixtures.modelsDev },
]
/** The earliest fixture's fetch time, so no fixture is stale and nothing reaches the network. */
const start = Math.min(...payloads.map(({ value }) => Date.parse(value.fetchedAt)))

/** Counts reads by kind, so a test can see which requests touched the payloads. */
class CountingStore extends MemoryStore {
  payloadReads = 0
  stampReads = 0
  sharedReads = 0

  override async get(key: string) {
    if (key.startsWith("llm-scores:snapshot:")) this.sharedReads += 1
    else if (!key.endsWith(":lock")) this.payloadReads += 1
    return super.get(key)
  }

  override async getHash(key: string) {
    this.stampReads += 1
    return super.getHash(key)
  }

  reset() {
    this.payloadReads = 0
    this.stampReads = 0
    this.sharedReads = 0
  }
}

async function seededStore() {
  const store = new CountingStore()
  for (const { key, value } of payloads) await store.set(key, value)
  store.reset()
  return store
}

/** Work the services handed off to run after the response, as Vercel's `waitUntil` keeps alive. */
const background: Array<Promise<unknown>> = []

/** Waits for every hand-off, including any a finished one started. */
async function settle() {
  while (background.length > 0) await Promise.all(background.splice(0))
}

function service(store: CountingStore, clock: { now: number }, buildId = "build-1") {
  const now = () => clock.now
  return new ModelAggregatorService(new SourceCache(store, now), buildId, now, true, (task) => {
    background.push(task)
  })
}

/** Saves a newer copy of one source, as a refresh does. */
async function refreshMetr(store: CountingStore, refreshedAt: string) {
  const { cacheKey } = ProvidersService.metricSources.metr
  await store.setWithHashField(
    cacheKey,
    { ...fixtures.metr, fetchedAt: refreshedAt },
    SOURCE_STAMPS_KEY,
    cacheKey,
    refreshedAt,
  )
}

/** Holds every read of the sources' payloads until `release`, so a test can see who waits on them. */
function holdPayloadReads(store: CountingStore) {
  const get = store.get.bind(store)
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  store.get = async (key) => {
    if (!key.startsWith("llm-scores:snapshot:") && !key.endsWith(":lock")) await released
    return get(key)
  }

  return () => {
    store.get = get
    release()
  }
}

describe("snapshot caching", () => {
  it("builds from the payloads once, then answers from memory without touching the store", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)

    const first = await aggregator.getSnapshot()
    expect(store.payloadReads).toBe(payloads.length)
    await settle()

    store.reset()
    clock.now += 1_000
    expect(await aggregator.getSnapshot()).toBe(first)
    expect(store.payloadReads + store.stampReads + store.sharedReads).toBe(0)
  })

  it("checks only the stamps once its memory is a few seconds old", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const first = await aggregator.getSnapshot()
    await settle()

    store.reset()
    clock.now += 10_000
    expect(await aggregator.getSnapshot()).toBe(first)
    expect(store.stampReads).toBe(1)
    expect(store.payloadReads).toBe(0)
  })

  it("lets a cold instance of the same deploy reuse the built snapshot instead of rebuilding", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const built = await service(store, clock).getSnapshot()
    await settle()

    store.reset()
    const cold = await service(store, clock).getSnapshot()
    expect(cold).toEqual(built)
    expect(store.payloadReads).toBe(0)
    expect(store.sharedReads).toBe(1)
  })

  it("never reuses a snapshot another deploy built", async () => {
    const store = await seededStore()
    const clock = { now: start }
    await service(store, clock, "build-1").getSnapshot()

    store.reset()
    await service(store, clock, "build-2").getSnapshot()
    expect(store.payloadReads).toBe(payloads.length)
  })

  it("keeps serving its snapshot once a source's stamp moves, and rebuilds after the response", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const first = await aggregator.getSnapshot()
    await settle()

    const refreshedAt = new Date(start + 1).toISOString()
    await refreshMetr(store, refreshedAt)
    store.reset()
    clock.now += 10_000
    const release = holdPayloadReads(store)

    expect(await aggregator.getSnapshot()).toBe(first)
    release()
    await settle()

    const second = await aggregator.getSnapshot()
    expect(second).not.toBe(first)
    expect(second.fetchedAt.metr).toBe(refreshedAt)
    expect(store.payloadReads).toBe(payloads.length)
  })

  it("lets a warm instance take the snapshot another instance saved instead of rebuilding", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const first = service(store, clock)
    const second = service(store, clock)
    await first.getSnapshot()
    await settle()
    const before = await second.getSnapshot()
    await settle()

    const refreshedAt = new Date(start + 1).toISOString()
    await refreshMetr(store, refreshedAt)
    clock.now += 10_000
    await first.getSnapshot()
    await settle()

    store.reset()
    clock.now += 10_000
    expect(await second.getSnapshot()).toBe(before)
    await settle()
    expect((await second.getSnapshot()).fetchedAt.metr).toBe(refreshedAt)
    expect(store.payloadReads).toBe(0)
    expect(store.sharedReads).toBe(1)
  })

  it("lets a cold instance serve its deploy's older snapshot while it rebuilds", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const built = await service(store, clock).getSnapshot()
    await settle()

    const refreshedAt = new Date(start + 1).toISOString()
    await refreshMetr(store, refreshedAt)
    const cold = service(store, clock)
    const release = holdPayloadReads(store)

    expect(await cold.getSnapshot()).toEqual(built)
    release()
    await settle()
    expect((await cold.getSnapshot()).fetchedAt.metr).toBe(refreshedAt)
  })

  it("builds on the request only when it has nothing to serve", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const release = holdPayloadReads(store)

    let answered = false
    const pending = aggregator.getSnapshot().then((snapshot) => {
      answered = true
      return snapshot
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(answered).toBe(false)

    release()
    expect((await pending).entries.length).toBeGreaterThan(0)
  })

  it("answers without waiting for the built snapshot to be saved", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const set = store.set.bind(store)
    let saved!: () => void
    const saving = new Promise<void>((resolve) => {
      saved = resolve
    })
    store.set = async (key: string, value: unknown) => {
      if (key.startsWith("llm-scores:snapshot:")) await saving
      return set(key, value)
    }

    expect((await service(store, clock).getSnapshot()).entries.length).toBeGreaterThan(0)
    expect(await store.get("llm-scores:snapshot:build-1")).toBeNull()

    saved()
    await settle()
    expect(await store.get("llm-scores:snapshot:build-1")).not.toBeNull()
  })

  it("leaves the diagnostics report to the diagnostics endpoint", async () => {
    vi.mocked(buildDiagnostics).mockClear()
    const store = await seededStore()
    const aggregator = service(store, { now: start })

    await aggregator.getSnapshot()
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(buildDiagnostics).not.toHaveBeenCalled()

    await aggregator.getDiagnostics()
    expect(buildDiagnostics).toHaveBeenCalledOnce()
  })

  it("keeps the snapshot's tag until a source refreshes or the deploy changes", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const { tag } = await aggregator.getTaggedSnapshot()

    clock.now += 10_000
    expect((await aggregator.getTaggedSnapshot()).tag).toBe(tag)
    expect((await service(store, clock, "build-2").getTaggedSnapshot()).tag).not.toBe(tag)

    await refreshMetr(store, new Date(start + 1).toISOString())
    clock.now += 10_000
    // The older snapshot is still what this answer carries, so its tag still names it.
    expect((await aggregator.getTaggedSnapshot()).tag).toBe(tag)
    await settle()
    expect((await aggregator.getTaggedSnapshot()).tag).not.toBe(tag)
  })

  it("never lets a rebuild's backfill replace a stamp a refresh wrote since", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const { cacheKey } = ProvidersService.metricSources.metr
    const refreshedAt = new Date(Date.parse(fixtures.metr.fetchedAt) + 1).toISOString()

    // A refresh saves a newer copy right after the rebuild read the older one.
    const get = store.get.bind(store)
    let refreshed = false
    store.get = async (key) => {
      const value = await get(key)
      if (key === cacheKey && !refreshed) {
        refreshed = true
        await store.setWithHashField(
          cacheKey,
          { ...fixtures.metr, fetchedAt: refreshedAt },
          SOURCE_STAMPS_KEY,
          cacheKey,
          refreshedAt,
        )
      }
      return value
    }
    await service(store, clock).getSnapshot()
    await settle()

    expect((await store.getHash(SOURCE_STAMPS_KEY))?.[cacheKey]).toBe(refreshedAt)
  })
})
