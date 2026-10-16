import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useCallback, useEffect, useState } from "react"
import { flushSync } from "react-dom"

import type { Theme } from "#/ui/lib/theme"

import { Button } from "#/ui/components/ui/button"
import {
  applyTheme,
  storeTheme,
  storedTheme,
  systemTheme,
  withThemeTransition,
} from "#/ui/lib/theme"

/** Bare letter, so it stays out of the way of every browser and OS shortcut. */
const TOGGLE_KEY = "d"

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")

  // The inline script in `__root.tsx` has already resolved the theme onto the
  // document, so read it back rather than resolving it a second time.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const follow = () => {
      if (storedTheme() != null) return

      const next = systemTheme()
      setTheme(next)
      applyTheme(next)
    }

    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark"

    withThemeTransition(() => {
      // The browser snapshots the DOM the moment this callback returns, so the
      // icon swap has to land in the same frame as the palette swap.
      flushSync(() => setTheme(next))
      applyTheme(next)
    })
    storeTheme(next)
  }, [theme])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== TOGGLE_KEY) return
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return

      event.preventDefault()
      toggle()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggle])

  const Icon = theme === "dark" ? RiMoonLine : RiSunLine

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-keyshortcuts={TOGGLE_KEY}
      className="text-muted-foreground min-h-11 w-11 sm:min-h-8 sm:w-8"
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
