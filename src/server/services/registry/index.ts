import { SourceCache } from "../cache"
import { ArtificialAnalysisProvider } from "../provider/artificial-analysis"
import { DeepSWEProvider } from "../provider/deep-swe"
import { ModelsDevProvider } from "../provider/models-dev"
import type {
  ArtificialAnalysisPayload,
  DeepSWEPayload,
  ModelsDevPayload,
  SourceDefinition,
} from "../provider/provider.types"
import { deriveRegistry, type Derivation } from "./derive"
import { inputsVersion, registryInputs } from "./inputs"

type RegistrySources = {
  deepswe: SourceDefinition<DeepSWEPayload>
  artificialAnalysis: SourceDefinition<ArtificialAnalysisPayload>
  modelsDev: SourceDefinition<ModelsDevPayload>
}

/** One derivation per process, rebuilt only when a source's cached copy changes. */
let latest: { version: string; derivation: Derivation } | null = null

export class RegistryService {
  constructor(
    private readonly cache = new SourceCache(),
    private readonly sources: RegistrySources = {
      deepswe: new DeepSWEProvider(),
      artificialAnalysis: new ArtificialAnalysisProvider(),
      modelsDev: new ModelsDevProvider(),
    },
  ) {}

  async getSnapshot() {
    return (await this.derive()).snapshot
  }

  private async derive() {
    const [deepswe, artificialAnalysis, modelsDev] = await Promise.all([
      this.cache.read(this.sources.deepswe),
      this.cache.read(this.sources.artificialAnalysis),
      this.cache.read(this.sources.modelsDev),
    ])
    const cached = { deepswe, artificialAnalysis, modelsDev }
    const version = inputsVersion(cached)

    if (latest?.version !== version) {
      latest = { version, derivation: deriveRegistry(registryInputs(cached)) }
    }

    return latest.derivation
  }
}

export type { RegistryEntry, RegistrySnapshot, RegistryVariant } from "./registry.types"
export type { MetricKey, ReasoningMode } from "../provider/provider.types"
