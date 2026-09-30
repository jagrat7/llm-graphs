import { registryDiagnosticsProcedure, registrySnapshotProcedure } from "./registry"

export default {
  registry: {
    snapshot: registrySnapshotProcedure,
    diagnostics: registryDiagnosticsProcedure,
  },
}
