import { describe, expect, it } from "vitest"

import { MemoryStore, SOURCE_STAMPS_KEY, SourceCache } from "../cache/cache"
import { ProvidersService } from "../providers"
import { fixtures } from "./fixture-inputs"
import { ModelAggregatorService } from "."

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

function service(store: CountingStore, clock: { now: number }, buildId = "build-1") {
  const now = () => clock.now
  return new ModelAggregatorService(new SourceCache(store, now), buildId, now, true)
}

// Each rebuild runs the full diagnostics, about 0.7 s on the committed fixtures.
describe("snapshot caching", { timeout: 15_000 }, () => {
  it("builds from the payloads once, then answers from memory without touching the store", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)

    const first = await aggregator.getSnapshot()
    expect(store.payloadReads).toBe(payloads.length)

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

  it("rebuilds once a source's stamp moves", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const first = await aggregator.getSnapshot()

    const { cacheKey } = ProvidersService.metricSources.metr
    const refreshedAt = new Date(start + 1).toISOString()
    await store.setWithHashField(
      cacheKey,
      { ...fixtures.metr, fetchedAt: refreshedAt },
      SOURCE_STAMPS_KEY,
      cacheKey,
      refreshedAt,
    )

    store.reset()
    clock.now += 10_000
    const second = await aggregator.getSnapshot()
    expect(second).not.toBe(first)
    expect(second.fetchedAt.metr).toBe(refreshedAt)
    expect(store.payloadReads).toBe(payloads.length)
  })

  it("keeps the snapshot's tag until a source refreshes or the deploy changes", async () => {
    const store = await seededStore()
    const clock = { now: start }
    const aggregator = service(store, clock)
    const { tag } = await aggregator.getTaggedSnapshot()

    clock.now += 10_000
    expect((await aggregator.getTaggedSnapshot()).tag).toBe(tag)
    expect((await service(store, clock, "build-2").getTaggedSnapshot()).tag).not.toBe(tag)

    const { cacheKey } = ProvidersService.metricSources.metr
    const refreshedAt = new Date(start + 1).toISOString()
    await store.setWithHashField(
      cacheKey,
      { ...fixtures.metr, fetchedAt: refreshedAt },
      SOURCE_STAMPS_KEY,
      cacheKey,
      refreshedAt,
    )

    clock.now += 10_000
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

    expect((await store.getHash(SOURCE_STAMPS_KEY))?.[cacheKey]).toBe(refreshedAt)
  })
})
