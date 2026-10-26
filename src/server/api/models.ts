import { createServerFn, createServerOnlyFn } from "@tanstack/react-start"

import { ModelAggregatorService } from "../services/model-aggregator"

let modelAggregator: ModelAggregatorService | undefined

/** One per server process, made on first use so the browser bundle never builds one. */
function aggregator() {
  modelAggregator ??= new ModelAggregatorService()
  return modelAggregator
}

/** Every model and its metrics. */
export const snapshot = createServerFn({ method: "GET" }).handler(() => aggregator().getSnapshot())

/**
 * The snapshot with a tag for HTTP caching, for the plain-JSON route. Server-only, so the browser
 * build gets a stub instead of pulling in the aggregator through the route's import.
 */
export const taggedSnapshot = createServerOnlyFn(() => aggregator().getTaggedSnapshot())

/** How today's matching rules treat each source's rows. Served at GET /api/models/diagnostics. */
export const diagnostics = createServerFn({ method: "GET" }).handler(() =>
  aggregator().getDiagnostics(),
)
