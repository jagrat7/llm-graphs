import { createCookieStore, parseJsonCookie } from "#/ui/lib/cookie-store"

export const PICKED_MODELS_COOKIE = "picked-models"

/** `null` means the reader has never picked, so the chart opens on its default models. */
export type PickedModels = Array<string> | null

export function isPickedModels(value: unknown): value is PickedModels {
  return value === null || (Array.isArray(value) && value.every((id) => typeof id === "string"))
}

/** Takes the cookie's value already URL-decoded. Anything malformed counts as never picked. */
export function parsePickedModels(value: string | null | undefined): PickedModels {
  const parsed = parseJsonCookie(value ?? null)

  return isPickedModels(parsed) ? parsed : null
}

/** The models a reader chose, by entry id, kept in a cookie so the first HTML already shows them. */
const pickedModels = createCookieStore<PickedModels>({
  name: PICKED_MODELS_COOKIE,
  parse: parsePickedModels,
  isEmpty: (models) => models === null,
})

export const readPickedModels = pickedModels.read

/** Shows the picks at once, then saves them for the next page load; `null` forgets them. */
export const savePickedModels = pickedModels.save

/** This tab's picks, saved here or in another tab, or the request's until it has any. */
export const usePickedModels = pickedModels.useValue
