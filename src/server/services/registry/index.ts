import { SourceCache } from "../cache"
import { ArtificialAnalysisProvider } from "../provider/artificial-analysis"
import { DeepSWEProvider } from "../provider/deep-swe"
import { ModelsDevProvider } from "../provider/models-dev"
import type { RegistrySnapshot } from "./registry.types"
import type {
  ArtificialAnalysisPayload,
  DeepSWEPayload,
  ModelsDevPayload,
  SourceDefinition,
} from "../provider/provider.types"
import { deriveRegistry, type Derivation } from "./derive"
import { buildDiagnostics, diagnosticsLogLine, type DiagnosticsReport } from "./diagnostics"
import { inputsVersion, registryInputs } from "./inputs"

type RegistrySources = {
  deepswe: SourceDefinition<DeepSWEPayload>
  artificialAnalysis: SourceDefinition<ArtificialAnalysisPayload>
  modelsDev: SourceDefinition<ModelsDevPayload>
}

/** One derivation per process, rebuilt only when a source's cached copy changes. */
let latest: {
  version: string
  derivation: Derivation
  report: DiagnosticsReport | null
} | null = null

/** Builds the report once per derivation and writes its one log line. */
function reportFor(current: NonNullable<typeof latest>) {
  if (!current.report) {
    current.report = buildDiagnostics(current.derivation)
    console.info(diagnosticsLogLine(current.report, current.derivation.snapshot.entries.length))
  }

  return current.report
}

export class RegistryService {
  constructor(
    private readonly cache = new SourceCache(),
    private readonly sources: RegistrySources = {
      deepswe: new DeepSWEProvider(),
      artificialAnalysis: new ArtificialAnalysisProvider(),
      modelsDev: new ModelsDevProvider(),
    },
  ) {}

  async getSnapshot(): Promise<RegistrySnapshot> {
    return (await this.derive()).derivation.snapshot
  }

  /** The same derivation production serves, so it shows what today's rules do with new models. */
  async getDiagnostics() {
    return reportFor(await this.derive())
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
      const rebuilt = { version, derivation: deriveRegistry(registryInputs(cached)), report: null }
      latest = rebuilt
      // The report costs several times the derivation, so it runs after the snapshot is served.
      setTimeout(() => reportFor(rebuilt), 0)
    }

    return latest
  }
}

export type { RegistryEntry, RegistrySnapshot, RegistryVariant } from "./registry.types"
export type { MetricKey, ReasoningMode } from "../provider/provider.types"
