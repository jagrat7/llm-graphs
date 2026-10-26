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

describe("snapshot caching", () => {
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
    await store.set(cacheKey, { ...fixtures.metr, fetchedAt: refreshedAt })
    await store.setHashFields(SOURCE_STAMPS_KEY, { [cacheKey]: refreshedAt })

    store.reset()
    clock.now += 10_000
    const second = await aggregator.getSnapshot()
    expect(second).not.toBe(first)
    expect(second.fetchedAt.metr).toBe(refreshedAt)
    expect(store.payloadReads).toBe(payloads.length)
  })

})
