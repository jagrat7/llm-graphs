import { Redis } from "@upstash/redis"

import { env } from "#/env"

import type { SourceDefinition } from "./provider/provider.types"

/**
 * Longer than the slowest fetch (AA pages through its whole list), so a second refresh can't
 * start while the first is still running. A failed background refresh retries once it expires.
 */
const REFRESH_LOCK_SECONDS = 5 * 60
/** How long a cold read waits for another request's fetch before giving up. */
const COLD_WAIT_MS = 30_000
const COLD_POLL_MS = 500

export type CachedPayload<T> = {
  payload: T
  fetchedAt: string
}

export interface CacheStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  /** Resolves true for exactly one caller until the lock expires or is released. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>
  releaseLock(key: string): Promise<void>
}

class RedisStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string) {
    try {
      return await this.redis.get(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown) {
    try {
      await this.redis.set(key, value)
    } catch {
      // A failed write keeps the previous copy, which is still the last good one.
    }
  }

  async acquireLock(key: string, ttlSeconds: number) {
    try {
      return (await this.redis.set(key, 1, { nx: true, ex: ttlSeconds })) === "OK"
    } catch {
      return false
    }
  }

  async releaseLock(key: string) {
    try {
      await this.redis.del(key)
    } catch {
      // The lock expires on its own.
    }
  }
}

/** Stands in for Redis when it isn't configured, so local dev still caches per process. */
export class MemoryStore implements CacheStore {
  private readonly values = new Map<string, unknown>()
  private readonly locks = new Map<string, number>()

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async set(key: string, value: unknown) {
    this.values.set(key, value)
  }

  async acquireLock(key: string, ttlSeconds: number) {
    const now = Date.now()
    if ((this.locks.get(key) ?? 0) > now) return false

    this.locks.set(key, now + ttlSeconds * 1000)
    return true
  }

  async releaseLock(key: string) {
    this.locks.delete(key)
  }
}

const memoryStore = new MemoryStore()
/** Fetches running in this process, so concurrent reads share one upstream request. */
const inFlight = new Map<string, Promise<unknown>>()

function defaultStore(): CacheStore {
  const token = env.UPSTASH_REDIS_REST_TOKEN
  const url = env.UPSTASH_REDIS_REST_URL

  return token && url ? new RedisStore(new Redis({ token, url })) : memoryStore
}

/**
 * Keeps each source's last good payload with no expiry. Reads always answer from that copy;
 * once it is older than the source's refresh window, one background refresh starts.
 */
export class SourceCache {
  private resolvedStore: CacheStore | undefined

  constructor(
    store?: CacheStore,
    private readonly now: () => number = Date.now,
  ) {
    this.resolvedStore = store
  }

  /** Resolved on first use: the router module also loads in the client bundle, which has no env. */
  private get store() {
    this.resolvedStore ??= defaultStore()

    return this.resolvedStore
  }

  async read<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    const cached = await this.stored(source)
    if (!cached) return this.fillCold(source)

    if (this.now() - Date.parse(cached.fetchedAt) > source.refreshWindowMs) {
      void this.refreshInBackground(source)
    }

    return cached
  }

  private async stored<T>(source: SourceDefinition<T>) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only this source writes its key
    return (await this.store.get(source.cacheKey)) as CachedPayload<T> | null
  }

  private lockKey<T>(source: SourceDefinition<T>) {
    return `${source.cacheKey}:lock`
  }

  /**
   * With nothing cached, one request fetches behind the lock and the rest wait for its copy,
   * so a cold start never multiplies requests to a rate-limited source.
   */
  private async fillCold<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    const running = inFlight.get(source.cacheKey)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keyed by this source
    if (running) return (await running) as CachedPayload<T> | null

    if (await this.store.acquireLock(this.lockKey(source), REFRESH_LOCK_SECONDS)) {
      try {
        return await this.refresh(source)
      } finally {
        // A failed cold fetch has nothing to protect, so the next request may try again.
        await this.store.releaseLock(this.lockKey(source))
      }
    }

    for (let waited = 0; waited < COLD_WAIT_MS; waited += COLD_POLL_MS) {
      await new Promise((resolve) => setTimeout(resolve, COLD_POLL_MS))
      const cached = await this.stored(source)
      if (cached) return cached
    }

    return null
  }

  private async refreshInBackground<T>(source: SourceDefinition<T>) {
    if (inFlight.has(source.cacheKey)) return

    const locked = await this.store.acquireLock(this.lockKey(source), REFRESH_LOCK_SECONDS)
    if (locked) await this.refresh(source)
  }

  private refresh<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    const running = this.fetchAndStore(source).finally(() => inFlight.delete(source.cacheKey))
    inFlight.set(source.cacheKey, running)

    return running
  }

  /**
   * A failed fetch leaves the stored copy untouched, and so does one that finishes after a newer
   * copy landed: an older response never overwrites fresher data.
   */
  private async fetchAndStore<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    const startedAt = this.now()
    let payload: T

    try {
      payload = await source.fetchPayload()
    } catch (error) {
      console.warn(`[source-cache] ${source.name} refresh failed:`, error)
      return null
    }

    const current = await this.stored(source)
    if (current && Date.parse(current.fetchedAt) > startedAt) return current

    const entry = { payload, fetchedAt: new Date(this.now()).toISOString() }
    await this.store.set(source.cacheKey, entry)

    return entry
  }
}
