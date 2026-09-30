import { os } from "@orpc/server"

import { ModelAggregatorService } from "../../services/model-aggregator"

const modelAggregator = new ModelAggregatorService()

  export const modelSnapshotProcedure = os.handler(() => modelAggregator.getSnapshot())

/** Public and read-only, but not linked from the UI: GET /api/models/diagnostics. */
export const modelDiagnosticsProcedure = os
  .route({ method: "GET", path: "/models/diagnostics" })
  .handler(() => modelAggregator.getDiagnostics())
