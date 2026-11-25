import * as models from "./models"
import * as providers from "./providers"
import * as xPosts from "./x-posts"

/** Every server function the UI calls, grouped by what it serves. */
export const api = {
  models: {
    snapshot: models.snapshot,
    diagnostics: models.diagnostics,
  },
  providers: {
    info: providers.info,
  },
  xPosts: {
    examples: xPosts.examples,
  },
}

export type ModelSnapshot = Awaited<ReturnType<typeof api.models.snapshot>>
export type ProvidersInfo = Awaited<ReturnType<typeof api.providers.info>>
export type ModelExamples = NonNullable<Awaited<ReturnType<typeof api.xPosts.examples>>>
export type XPost = ModelExamples["posts"][number]
export type ProviderName = keyof ProvidersInfo["displayNames"]
export type MetricKey = keyof ProvidersInfo["metricProviders"]
export type ReasoningMode = ModelSnapshot["variants"][ProviderName][number]["mode"]
