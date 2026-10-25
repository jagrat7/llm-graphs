import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useSyncExternalStore } from "react"

export const PICKED_MODELS_COOKIE = "picked-models"

const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365

/** `null` means the reader has never picked, so the chart opens on its default models. */
export type PickedModels = Array<string> | null

export function isPickedModels(value: unknown): value is PickedModels {
  return value === null || (Array.isArray(value) && value.every((id) => typeof id === "string"))
}

/** Takes the cookie's value already URL-decoded. Anything malformed counts as never picked. */
export function parsePickedModels(value: string | null | undefined): PickedModels {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)

    return isPickedModels(parsed) ? parsed : null
  } catch {
    return null
  }
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

/** The API exists only in secure contexts, so a plain-HTTP LAN address goes without it. */
function hasCookieStore() {
  return "cookieStore" in globalThis
}

/**
 * The models a reader chose, by entry id. They live in a cookie rather than localStorage so
 * the server sees them on the page request and renders them in the first HTML.
 */
export const readPickedModels = createIsomorphicFn()
  .server(async () => parsePickedModels(getCookie(PICKED_MODELS_COOKIE)))
  .client(async () => {
    if (!hasCookieStore()) return null

    const cookie = await cookieStore.get(PICKED_MODELS_COOKIE)

    return parsePickedModels(decodeCookieValue(cookie?.value))
  })

/**
 * This tab's picks once it has saved or heard any, kept as the cookie's encoded value so an
 * echo of its own save is told apart from a real change. `undefined` defers to the loader.
 */
let latest: { encoded: string | null; models: PickedModels } | undefined
const listeners = new Set<() => void>()
let watchingCookie = false

function publish(models: PickedModels) {
  const encoded = models === null ? null : encodeURIComponent(JSON.stringify(models))

  if (latest?.encoded === encoded) return
  latest = { encoded, models }
  for (const notify of listeners) notify()
}

function handleCookieChange(event: CookieChangeEvent) {
  if (event.deleted.some((cookie) => cookie.name === PICKED_MODELS_COOKIE)) {
    publish(null)
    return
  }

  const changed = event.changed.find((cookie) => cookie.name === PICKED_MODELS_COOKIE)

  if (changed) publish(parsePickedModels(decodeCookieValue(changed.value)))
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

/**
 * The picks to show: this tab's latest, or the loader's until it has any. The server and
 * hydration use the loader's, which the request's cookie decided.
 */
export function usePickedModels(saved: PickedModels) {
  return useSyncExternalStore(
    subscribe,
    () => (latest === undefined ? saved : latest.models),
    () => saved,
  )
}

/** Shows the picks at once, then saves them for the next page load; `null` forgets them. */
export async function savePickedModels(models: PickedModels) {
  publish(models)

  if (!hasCookieStore()) return

  if (models === null) {
    await cookieStore.delete({ name: PICKED_MODELS_COOKIE, path: "/" })
    return
  }

  await cookieStore.set({
    name: PICKED_MODELS_COOKIE,
    value: latest!.encoded!,
    expires: Date.now() + ONE_YEAR_MS,
    path: "/",
    sameSite: "lax",
  })
}
