import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useSyncExternalStore } from "react"

const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365

/** The Cookie Store API exists only in secure contexts, so a plain-HTTP LAN address goes without. */
function hasCookieStore() {
  return "cookieStore" in globalThis
}

/** The Cookie Store API hands values back raw; the server's parser decodes its own. */
function decodeCookieValue(value: string | null | undefined) {
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** A cookie's decoded value: from the page request on the server, from the jar in the browser. */
const readCookie = createIsomorphicFn()
  .server(async (name: string) => getCookie(name) ?? null)
  .client(async (name: string) => {
    if (!hasCookieStore()) return null

    return decodeCookieValue((await cookieStore.get(name))?.value)
  })

type CookieStoreOptions<T> = {
  name: string
  /** Turns the decoded cookie, or null when there is none, into a value. Never throws. */
  parse: (value: string | null) => T
  /** Values that need no cookie, such as "never picked" or the default settings. */
  isEmpty: (value: T) => boolean
}

/**
 * A value kept in a cookie, so the server sees it on the page request and renders with it.
 * The server reads it once per request; the browser writes it and hears changes from other tabs.
 */
export function createCookieStore<T>({ name, parse, isEmpty }: CookieStoreOptions<T>) {
  /**
   * This tab's value once it has saved or heard one, kept with its encoded form so an echo of
   * its own save is told apart from a real change. `undefined` defers to the request's value.
   */
  let latest: { encoded: string | null; value: T } | undefined
  const listeners = new Set<() => void>()
  let watchingCookie = false

  function publish(value: T) {
    const encoded = isEmpty(value) ? null : encodeURIComponent(JSON.stringify(value))

    if (latest?.encoded === encoded) return
    latest = { encoded, value }
    for (const notify of listeners) notify()
  }

  function handleCookieChange(event: CookieChangeEvent) {
    if (event.deleted.some((cookie) => cookie.name === name)) {
      publish(parse(null))
      return
    }

    const changed = event.changed.find((cookie) => cookie.name === name)

    if (changed) publish(parse(decodeCookieValue(changed.value)))
  }

  /** Re-renders on a save here or a change from another tab. */
  function subscribe(notify: () => void) {
    listeners.add(notify)

    // One page-long listener, however many components subscribe.
    if (!watchingCookie && hasCookieStore()) {
      watchingCookie = true
      cookieStore.addEventListener("change", handleCookieChange)
    }

    return () => {
      listeners.delete(notify)
    }
  }

  return {
    read: async () => parse(await readCookie(name)),

    /** Shows the value at once, then saves it for the next page load. Empty values delete it. */
    save: async (value: T) => {
      publish(value)

      if (!hasCookieStore()) return

      const encoded = latest?.encoded ?? null

      if (encoded === null) {
        await cookieStore.delete({ name, path: "/" })
        return
      }

      await cookieStore.set({
        name,
        value: encoded,
        expires: Date.now() + ONE_YEAR_MS,
        path: "/",
        sameSite: "lax",
      })
    },

    /**
     * The value to show: this tab's latest, or `saved` until it has one. The server and
     * hydration use `saved`, which the request's cookie decided.
     */
    useValue: (saved: T) =>
      useSyncExternalStore(
        subscribe,
        () => (latest === undefined ? saved : latest.value),
        () => saved,
      ),
  }
}

/** For cookies holding JSON: anything malformed reads as no cookie. */
export function parseJsonCookie(value: string | null): unknown {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
