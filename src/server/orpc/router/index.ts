import { modelDiagnosticsProcedure, modelSnapshotProcedure } from "./models"

export default {
  models: {
    snapshot: modelSnapshotProcedure,
    diagnostics: modelDiagnosticsProcedure,
  },
}
