import { Redis } from "@upstash/redis"

import { env } from "#/env"

import type { SourceDefinition } from "./provider/provider.types"

/** Long enough for one refresh to finish, short enough that a failed one retries soon. */
const REFRESH_LOCK_SECONDS = 60

export type CachedPayload<T> = {
  payload: T
  fetchedAt: string
}

export interface CacheStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  /** Resolves true for exactly one caller until the lock expires. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>
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
}

const memoryStore = new MemoryStore()

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only this source writes its key
    const cached = (await this.store.get(source.cacheKey)) as CachedPayload<T> | null
    if (!cached) return this.refresh(source)

    if (this.now() - Date.parse(cached.fetchedAt) > source.refreshWindowMs) {
      void this.refreshInBackground(source)
    }

    return cached
  }

  private async refreshInBackground<T>(source: SourceDefinition<T>) {
    const locked = await this.store.acquireLock(`${source.cacheKey}:lock`, REFRESH_LOCK_SECONDS)
    if (locked) await this.refresh(source)
  }

  /** A failed fetch leaves the stored copy untouched. */
  private async refresh<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    let payload: T

    try {
      payload = await source.fetchPayload()
    } catch (error) {
      console.warn(`[source-cache] ${source.name} refresh failed:`, error)
      return null
    }

    const entry = { payload, fetchedAt: new Date(this.now()).toISOString() }
    await this.store.set(source.cacheKey, entry)

    return entry
  }
}
