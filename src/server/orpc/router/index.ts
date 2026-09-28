import { getModelCostProcedure } from "./cost"
import { getModelDurationProcedure } from "./duration"
import { listProviderModelsProcedure } from "./provider"
import { registrySnapshotProcedure } from "./registry"
import { getModelScoreProcedure } from "./score"
import { getModelTokensPerSecondProcedure } from "./token-speed"

export default {
  models: {
    list: listProviderModelsProcedure,
    score: getModelScoreProcedure,
    costPerMTokens: getModelCostProcedure,
    tokensPerSecond: getModelTokensPerSecondProcedure,
    durationSeconds: getModelDurationProcedure,
  },
  registry: {
    snapshot: registrySnapshotProcedure,
  },
}
