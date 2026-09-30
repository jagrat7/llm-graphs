import { Redis } from "@upstash/redis"

import { env } from "#/env"

import type { SourceDefinition } from "./provider/provider.types"

/**
 * Longer than the slowest fetch (AA pages through its whole list), so a second refresh can't
 * start while the first is still running. A failed background refresh retries once it expires.
 */
const REFRESH_LOCK_SECONDS = 5 * 60
/**
 * A cold fetch holds a short lock and keeps extending it while it runs, so a slow fetch keeps
 * its lock but one whose holder died frees it quickly for a waiting request.
 */
const COLD_LOCK_SECONDS = 30
const COLD_HEARTBEAT_MS = 10_000
const COLD_POLL_MS = 500
/** Deletes the lock only while it still holds the caller's token. */
const RELEASE_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0'
/** Extends the lock only while it still holds the caller's token. */
const EXTEND_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) end return 0'

export type CachedPayload<T> = {
  payload: T
  fetchedAt: string
}

export interface CacheStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  /** Resolves a token for exactly one caller until the lock expires or is released; else null. */
  acquireLock(key: string, ttlSeconds: number): Promise<string | null>
  /**
   * Releases the lock only while `token` still holds it: a holder whose lock expired mid-fetch
   * must not free the lock another request has since taken.
   */
  releaseLock(key: string, token: string): Promise<void>
  /** Pushes the lock's expiry out to `ttlSeconds` from now, only while `token` still holds it. */
  extendLock(key: string, token: string, ttlSeconds: number): Promise<void>
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
    const token = crypto.randomUUID()

    try {
      return (await this.redis.set(key, token, { nx: true, ex: ttlSeconds })) === "OK"
        ? token
        : null
    } catch {
      // With Redis unreachable nothing can be shared, so each request fetches for itself.
      return token
    }
  }

  async releaseLock(key: string, token: string) {
    try {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, [key], [token])
    } catch {
      // The lock expires on its own.
    }
  }

  async extendLock(key: string, token: string, ttlSeconds: number) {
    try {
      await this.redis.eval(EXTEND_LOCK_SCRIPT, [key], [token, ttlSeconds])
    } catch {
      // The next heartbeat tries again.
    }
  }
}

/** Stands in for Redis when it isn't configured, so local dev still caches per process. */
export class MemoryStore implements CacheStore {
  private readonly values = new Map<string, unknown>()
  private readonly locks = new Map<string, { token: string; expiresAt: number }>()

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async set(key: string, value: unknown) {
    this.values.set(key, value)
  }

  async acquireLock(key: string, ttlSeconds: number) {
    const now = Date.now()
    if ((this.locks.get(key)?.expiresAt ?? 0) > now) return null

    const token = crypto.randomUUID()
    this.locks.set(key, { token, expiresAt: now + ttlSeconds * 1000 })
    return token
  }

  async releaseLock(key: string, token: string) {
    if (this.locks.get(key)?.token === token) this.locks.delete(key)
  }

  async extendLock(key: string, token: string, ttlSeconds: number) {
    const lock = this.locks.get(key)
    if (lock?.token === token && lock.expiresAt > Date.now()) {
      lock.expiresAt = Date.now() + ttlSeconds * 1000
    }
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
   * so a cold start never multiplies requests to a rate-limited source. A waiter waits as long
   * as the lock is held, however slow the fetch, and takes its own turn once the lock frees up
   * with nothing stored: the fetch failed, or its holder died and stopped extending the lock.
   */
  private async fillCold<T>(source: SourceDefinition<T>): Promise<CachedPayload<T> | null> {
    const lockKey = this.lockKey(source)

    // Unbounded on purpose: a live holder keeps the lock only while its fetch runs, a dead one's
    // lock frees within COLD_LOCK_SECONDS, and an unreachable store hands out a turn.
    for (;;) {
      const running = inFlight.get(source.cacheKey)
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keyed by this source
      if (running) return (await running) as CachedPayload<T> | null

      const token = await this.store.acquireLock(lockKey, COLD_LOCK_SECONDS)
      if (token) {
        const heartbeat = setInterval(
          () => void this.store.extendLock(lockKey, token, COLD_LOCK_SECONDS),
          COLD_HEARTBEAT_MS,
        )

        try {
          return await this.refresh(source)
        } finally {
          clearInterval(heartbeat)
          // A failed cold fetch has nothing to protect, so the next request may try again.
          await this.store.releaseLock(lockKey, token)
        }
      }

      await new Promise((resolve) => setTimeout(resolve, COLD_POLL_MS))
      const cached = await this.stored(source)
      if (cached) return cached
    }
  }

  private async refreshInBackground<T>(source: SourceDefinition<T>) {
    if (inFlight.has(source.cacheKey)) return

    // Left to expire rather than released, so a failed refresh isn't retried on every read.
    const token = await this.store.acquireLock(this.lockKey(source), REFRESH_LOCK_SECONDS)
    if (token) await this.refresh(source)
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
