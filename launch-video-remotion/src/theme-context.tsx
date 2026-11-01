import { createContext, use } from "react"

import type { Theme } from "./theme"

import { LIGHT } from "./theme"

export const ThemeContext = createContext<Theme>(LIGHT)

/** The pad the film is drawn on; the same timeline renders on either. */
export const useTheme = () => use(ThemeContext)
