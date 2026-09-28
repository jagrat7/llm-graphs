import { os } from "@orpc/server"

import { RegistryService } from "../../services/registry"

const registryService = new RegistryService()

export const registrySnapshotProcedure = os.handler(() => registryService.getSnapshot())

/** Public and read-only, but not linked from the UI: GET /api/registry/diagnostics. */
export const registryDiagnosticsProcedure = os
  .route({ method: "GET", path: "/registry/diagnostics" })
  .handler(() => registryService.getDiagnostics())
