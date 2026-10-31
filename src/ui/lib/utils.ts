import type { ClassValue } from "clsx"

import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The density and layout steps `styles.css` adds to the theme. Unregistered, twMerge reads
 * `h-control-md` as no height at all and `text-control` as a colour, so a call site's size
 * would sit beside the primitive's instead of replacing it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["control-sm", "control-md", "control-lg", "control-xl", "chip", "header"],
      text: ["control", "field", "count", "title"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
