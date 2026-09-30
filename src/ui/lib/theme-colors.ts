import { useCallback, useMemo, useSyncExternalStore } from "react"

/**
 * WebGL materials cannot read CSS variables, and the theme is authored in `oklch()`,
 * which `THREE.Color` cannot parse. Painting the colour onto a 1×1 canvas lets the
 * browser do the conversion, so the palette stays defined once in `styles.css`.
 */
const THEME_TOKENS = {
  background: "--background",
  card: "--card",
  foreground: "--foreground",
  mutedForeground: "--muted-foreground",
  border: "--border",
  ring: "--ring",
} as const

export type ThemeColors = Record<keyof typeof THEME_TOKENS, string>

const FALLBACK_COLORS: ThemeColors = {
  background: "#ffffff",
  card: "#ffffff",
  foreground: "#1a1a1a",
  mutedForeground: "#6b7280",
  border: "#d4d4d8",
  ring: "#3b82f6",
}

const VARIABLE_PATTERN = /var\(\s*(--[\w-]+)\s*\)/g
const cache = new Map<string, string>()

let probe: CanvasRenderingContext2D | null | undefined
let themeVersion = 0

function getProbe() {
  if (probe === undefined) {
    probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  }

  return probe
}

function paintToHex(color: string) {
  const context = getProbe()

  if (!context) return null

  // An unparseable value leaves `fillStyle` untouched, so the sentinel detects it.
  context.fillStyle = "#010203"
  context.fillStyle = color
  if (context.fillStyle === "#010203" && color !== "#010203") return null

  context.fillRect(0, 0, 1, 1)
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data

  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`
}

/** Resolves `var(--token)`, `oklch(...)` with or without variables, or any CSS colour to `#rrggbb`. */
export function resolveCssColor(value: string, fallback = "#888888") {
  if (typeof document === "undefined") return fallback

  const key = `${themeVersion}:${value}`
  const cached = cache.get(key)

  if (cached != null) return cached

  // Substitutes every variable, so `oklch(var(--vendor-l) var(--vendor-c) 339)` resolves too.
  const styles = getComputedStyle(document.documentElement)
  const raw = value
    .trim()
    .replaceAll(VARIABLE_PATTERN, (_, name: string) => styles.getPropertyValue(name).trim())
  const resolved = (raw === "" ? null : paintToHex(raw)) ?? fallback

  cache.set(key, resolved)

  return resolved
}

function readThemeColors(): ThemeColors {
  if (typeof document === "undefined") return FALLBACK_COLORS

  const read = (name: keyof ThemeColors) =>
    resolveCssColor(`var(${THEME_TOKENS[name]})`, FALLBACK_COLORS[name])

  return {
    background: read("background"),
    card: read("card"),
    foreground: read("foreground"),
    mutedForeground: read("mutedForeground"),
    border: read("border"),
    ring: read("ring"),
  }
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)

  if (listeners.size === 1) startObserving()

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stopObserving()
  }
}

let observer: MutationObserver | null = null

function notify() {
  themeVersion += 1
  cache.clear()
  for (const listener of listeners) listener()
}

function startObserving() {
  observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  })
}

function stopObserving() {
  observer?.disconnect()
  observer = null
}

function getSnapshot() {
  return themeVersion
}

function getServerSnapshot() {
  return 0
}

/**
 * Resolved theme colours that re-read only when the document theme actually changes,
 * never on every frame or render.
 */
export function useThemeColors() {
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const colors = useMemo<ThemeColors>(() => {
    void version

    return readThemeColors()
  }, [version])
  const resolve = useCallback(
    (value: string) => {
      void version

      return resolveCssColor(value)
    },
    [version],
  )

  return { colors, resolve, version }
}
