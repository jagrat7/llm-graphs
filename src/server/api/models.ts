import { createServerFn } from "@tanstack/react-start"

import { ModelAggregatorService } from "../services/model-aggregator"

let modelAggregator: ModelAggregatorService | undefined

/** One per server process, made on first use so the browser bundle never builds one. */
function aggregator() {
  modelAggregator ??= new ModelAggregatorService()
  return modelAggregator
}

/** Every model and its metrics. */
export const snapshot = createServerFn({ method: "GET" }).handler(() => aggregator().getSnapshot())

/** How today's matching rules treat each source's rows. Served at GET /api/models/diagnostics. */
export const diagnostics = createServerFn({ method: "GET" }).handler(() =>
  aggregator().getDiagnostics(),
)
