/**
 * A class list that names a theme, as `dark:bg-muted`, `hover:light:text-primary` or
 * `[.dark_&]:border-0`. Prose like "light: 3 models" is a word and a colon, not a class.
 */
const THEME_VARIANT = /(?:^|:)(dark|light):\S|\[[^\]\s]*\.(dark|light)(?![a-z0-9-])[^\]\s]*\]:\S/

function findThemeVariant(text) {
  for (const token of text.split(/\s+/)) {
    const match = THEME_VARIANT.exec(token)
    if (match) return { token, theme: match[1] ?? match[2] }
  }

  return null
}

const noThemeVariants = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid dark: and light: class variants, so both themes come from the same classes",
    },
    schema: [],
    messages: {
      themeVariant:
        "`{{token}}` styles only the {{theme}} theme. Use a theme token from styles.css instead, so both themes share the same classes.",
    },
  },

  create(context) {
    function check(node, text) {
      const found = text == null ? null : findThemeVariant(text)
      if (found) context.report({ node, messageId: "themeVariant", data: found })
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value)
      },

      TemplateElement(node) {
        check(node, node.value.cooked)
      },
    }
  },
}

export default noThemeVariants
