import noServerDeepImports from "./rules/no-server-deep-imports.mjs"
import noThemeVariants from "./rules/no-theme-variants.mjs"
import onlyServiceExport from "./rules/only-service-export.mjs"

const PLUGIN_NAME = "local"

const plugin = {
  meta: {
    name: PLUGIN_NAME,
  },
  rules: {
    "no-server-deep-imports": noServerDeepImports,
    "no-theme-variants": noThemeVariants,
    "only-service-export": onlyServiceExport,
  },
}

export default plugin
