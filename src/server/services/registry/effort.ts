import type { ReasoningMode } from "../provider/provider.types"

export const KNOWN_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const

const KNOWN_LEVEL_SET: ReadonlySet<string> = new Set(KNOWN_LEVELS)

/** Lowercases and closes up a level word, so `Xhigh`, `x-high`, and `xhigh` agree. */
export function normalizeLevel(word: string) {
  return word.toLowerCase().replaceAll(/[\s_-]+/g, "")
}

export function isKnownLevel(level: string) {
  return KNOWN_LEVEL_SET.has(level)
}

/** Levels named in an AA display name: `(high)` and `(…, High Effort)`. Other tokens say nothing. */
function levelFromToken(token: string) {
  const normalized = normalizeLevel(token)
  if (isKnownLevel(normalized)) return normalized

  const effort = /^(.+?)\s+effort$/i.exec(token)

  return effort ? normalizeLevel(effort[1]) : null
}

function modeFromToken(token: string): ReasoningMode | null {
  const normalized = token.toLowerCase().replaceAll(/\s+/g, " ")
  if (normalized === "non-reasoning") return "off"
  if (normalized === "reasoning" || normalized === "adaptive reasoning") return "on"

  return null
}

/** Reads the reasoning mode and effort level out of every `(…)` group in an AA name. */
export function parseNameEffort(name: string) {
  let mode: ReasoningMode | null = null
  let level: string | null = null

  for (const group of name.matchAll(/\(([^()]*)\)/g)) {
    for (const rawToken of group[1].split(",")) {
      const token = rawToken.trim()
      mode = modeFromToken(token) ?? mode
      level = levelFromToken(token) ?? level
    }
  }

  return { mode, level }
}

const REASONING_ON_MARKERS = new Set(["reasoning", "thinking", "adaptive"])
/** Words the model-id matcher drops. Their presence marks AA's non-reasoning Instruct rows. */
export const INSTRUCT_WORDS: ReadonlySet<string> = new Set(["instruct", "it", "chat"])

type SlugEffort = {
  words: Array<string>
  mode: ReasoningMode | null
}

/**
 * Peels effort and reasoning markers off the end of an AA slug. A level word only counts as
 * effort when the name states that same level, and `-max` never does: `qwen3-8-max` is a model.
 */
function peelMarkers(words: Array<string>, nameLevel: string | null): SlugEffort {
  const peeled = [...words]
  let mode: ReasoningMode | null = null

  while (peeled.length > 1) {
    const last = peeled.at(-1)
    const previous = peeled.at(-2)

    if (nameLevel != null && nameLevel !== "max" && last === nameLevel) {
      peeled.pop()
    } else if (last === "effort" && previous === nameLevel && peeled.length > 2) {
      peeled.splice(-2)
    } else if (last === "reasoning" && previous === "non" && peeled.length > 2) {
      peeled.splice(-2)
      mode ??= "off"
    } else if (last != null && REASONING_ON_MARKERS.has(last)) {
      peeled.pop()
      mode ??= "on"
    } else {
      break
    }
  }

  return { words: peeled, mode }
}

/**
 * Splits an AA row into its model id, reasoning mode, and effort level. The name's labels come
 * first, slug markers corroborate or fill in, and an explicit contradiction is flagged.
 */
export function parseArtificialAnalysisEffort(
  slug: string,
  name: string,
  trailingDateLength: (words: ReadonlyArray<string>) => number,
) {
  const fromName = parseNameEffort(name)
  let { words, mode: slugMode } = peelMarkers(slug.toLowerCase().split("-"), fromName.level)
  const dateLength = trailingDateLength(words)

  // Markers can sit before a trailing date: `gemini-2-5-flash-reasoning-04-2025`.
  if (dateLength > 0 && words.length > dateLength + 1) {
    const head = peelMarkers(words.slice(0, -dateLength), fromName.level)
    words = [...head.words, ...words.slice(-dateLength)]
    slugMode ??= head.mode
  }

  const instruct = words.slice(1).some((word) => INSTRUCT_WORDS.has(word))
  const mode: ReasoningMode =
    fromName.mode ?? slugMode ?? (fromName.level ? "on" : instruct ? "off" : "unknown")

  return {
    sourceModelId: words.join("-"),
    mode,
    level: fromName.level ?? "unknown",
    effortConflict:
      fromName.mode != null && slugMode != null && fromName.mode !== slugMode
        ? `slug says reasoning ${slugMode}, name says ${fromName.mode}`
        : null,
  }
}
