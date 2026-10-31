/**
 * Dev-only variants: put candidate versions of a component on the real page, side by side
 * or one at a time, and switch between them from a small bar in the corner.
 *
 *   <Variants id="model-picker" variants={{ legend: <ModelPicker />, chips: <ChipPicker /> }} />
 *
 * When showing several at once needs the layout around them to change (a grid gaining
 * columns, say), read the selection with the hook and lay them out yourself:
 *
 *   const shown = useVariants("model-picker", ["legend", "chips"])
 *
 * The bar lists every set on the page and shows or hides each variant; the choice is kept
 * in localStorage. A URL picks for a screenshot without touching storage:
 * `?variant=model-picker:chips`, `?variant=model-picker:legend,chips` for both, and
 * `?variant=model-picker:none` for neither. Repeat `variant` for more sets.
 *
 * Production builds always render the first (or `fallback`) variant and never mount the bar.
 * The server renders that one too; the stored or URL choice applies once the page hydrates.
 */
import type { ReactNode } from "react"

import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"
import { useEffect, useSyncExternalStore } from "react"

import { Button } from "#/ui/components/ui/button"
import { cn } from "#/ui/lib/utils"

const STORAGE_KEY = "dev-variants"
const URL_PARAM = "variant"

type VariantSet = { id: string; keys: ReadonlyArray<string>; fallback: string }

const sets = new Map<string, VariantSet>()
const shown = new Map<string, ReadonlyArray<string>>()
const listeners = new Set<() => void>()
// The bar re-reads the registry on any change; a counter is its stable snapshot.
let version = 0

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** `?variant=set:a,b` → { set: ["a", "b"] }; `none` hides every variant of the set. */
export function parseVariantParams(search: string): Map<string, Array<string>> {
  const picks = new Map<string, Array<string>>()

  for (const value of new URLSearchParams(search).getAll(URL_PARAM)) {
    const split = value.indexOf(":")
    if (split <= 0) continue

    const keys = value
      .slice(split + 1)
      .split(",")
      .filter(Boolean)
    picks.set(value.slice(0, split), keys.includes("none") ? [] : keys)
  }

  return picks
}

function readStored(): Record<string, Array<string>> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    if (parsed == null || typeof parsed !== "object") return {}

    // Only lists of strings survive: anything else in storage is someone else's or stale.
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Array<string>] =>
          Array.isArray(entry[1]) && entry[1].every((key) => typeof key === "string"),
      ),
    )
  } catch {
    return {}
  }
}

function register(set: VariantSet) {
  sets.set(set.id, set)

  // The URL is for one-off screenshots, so it outranks storage but never overwrites it.
  const initial = parseVariantParams(window.location.search).get(set.id) ??
    readStored()[set.id] ?? [set.fallback]
  shown.set(
    set.id,
    set.keys.filter((key) => initial.includes(key)),
  )
  emit()
}

function unregister(id: string) {
  sets.delete(id)
  shown.delete(id)
  emit()
}

/** Shows or hides one variant; the bar's buttons call this. */
export function toggleVariant(id: string, key: string) {
  const set = sets.get(id)
  const current = shown.get(id)
  if (!set || !current) return

  const next = set.keys.filter((candidate) =>
    candidate === key ? !current.includes(key) : current.includes(candidate),
  )
  shown.set(id, next)

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), [id]: next }))
  } catch {
    // Storage can be full or blocked; the choice still holds for this page.
  }
  emit()
}

/**
 * The variants of `id` to render, in `keys` order. Registers the set with the bar while
 * mounted. Outside dev, and before hydration, it is just `[fallback]`.
 */
export function useVariants<Key extends string>(
  id: string,
  keys: ReadonlyArray<Key>,
  fallback: Key = keys[0],
): Array<Key> {
  const keysKey = keys.join("\n")
  const selection = useSyncExternalStore(
    subscribe,
    () => shown.get(id),
    () => undefined,
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    register({ id, keys: keysKey.split("\n"), fallback })
    return () => unregister(id)
  }, [id, keysKey, fallback])

  if (!import.meta.env.DEV || selection === undefined) return [fallback]

  return keys.filter((key) => selection.includes(key))
}

/** Renders the shown variants of `id`, side by side when there are several. */
export function Variants<Key extends string>({
  id,
  variants,
  fallback,
  className,
}: {
  id: string
  variants: Record<Key, ReactNode>
  fallback?: Key
  /** Classes for the row that holds several variants at once. */
  className?: string
}) {
  const keys = Object.keys(variants).filter((key): key is Key => key in variants)
  const visible = useVariants(id, keys, fallback)

  if (visible.length === 1) return variants[visible[0]]

  return (
    <div data-variants={id} className={cn("flex gap-4", className)}>
      {visible.map((key) => (
        <div key={key} data-variant={key} className="min-w-0 flex-1">
          {variants[key]}
        </div>
      ))}
    </div>
  )
}

/** The switch for every set on the page. Mount once, in dev only; it renders nothing until a set registers. */
export function VariantBar() {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )

  if (sets.size === 0) return null

  return (
    <div
      role="group"
      aria-label="Variants"
      className="bg-popover text-control ring-foreground/10 fixed bottom-4 left-4 z-50 flex flex-col gap-1 rounded-lg p-1 shadow-md ring-1"
    >
      {[...sets.values()].map((set) => {
        const visible = shown.get(set.id) ?? []

        return (
          <div key={set.id} className="flex items-center gap-1">
            <span className="text-muted-foreground px-2 font-medium">{set.id}</span>
            {set.keys.map((key) => {
              const isShown = visible.includes(key)

              return (
                <Button
                  key={key}
                  variant={isShown ? "secondary" : "ghost"}
                  size="lg"
                  aria-pressed={isShown}
                  onClick={() => toggleVariant(set.id, key)}
                  className={cn(!isShown && "text-muted-foreground")}
                >
                  {isShown ? <RiEyeLine aria-hidden="true" /> : <RiEyeOffLine aria-hidden="true" />}
                  {key}
                </Button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
