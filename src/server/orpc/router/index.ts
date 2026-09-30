import { modelDiagnosticsProcedure, modelSnapshotProcedure } from "./models"
import { providersInfoProcedure } from "./providers"

export default {
  models: {
    snapshot: modelSnapshotProcedure,
    diagnostics: modelDiagnosticsProcedure,
  },
  providers: {
    info: providersInfoProcedure,
  },
}
