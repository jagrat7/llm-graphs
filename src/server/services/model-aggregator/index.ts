import type { MetricSource, SourcePayload } from "../providers"
import type { AggregatorInputs, ModelSnapshot } from "./model-aggregator.types"

import { SourceCache } from "../cache/cache"
import { ProvidersService } from "../providers"
import { aggregateModels, type Derivation } from "./derive"
import { buildDiagnostics, diagnosticsLogLine, type DiagnosticsReport } from "./diagnostics"
import { catalogInput, inputsVersion, metricSourceInput } from "./inputs"

type Aggregation = {
  version: string
  derivation: Derivation
  report: DiagnosticsReport | null
}

export class ModelAggregatorService {
  /** Rebuilt only when a source's cached copy changes. */
  private latest: Aggregation | null = null

  constructor(private readonly cache = new SourceCache()) {}

  async getSnapshot(): Promise<ModelSnapshot> {
    return (await this.aggregate()).derivation.snapshot
  }

  /** The same result production serves, so it shows what today's rules do with new models. */
  async getDiagnostics() {
    return this.reportFor(await this.aggregate())
  }

  private async aggregate() {
    // Listed in metadata order: the first source listing a model names it.
    const inputs: AggregatorInputs = {
      metricSources: await Promise.all(
        Object.values(ProvidersService.metricSources).map((source) =>
          this.readMetricSource(source),
        ),
      ),
      catalog: catalogInput(await this.cache.read(ProvidersService.catalog)),
    }
    const version = inputsVersion(inputs)

    if (this.latest?.version !== version) {
      const rebuilt: Aggregation = { version, derivation: aggregateModels(inputs), report: null }
      this.latest = rebuilt
      // The report costs several times the aggregation, so it runs after the snapshot is served.
      setTimeout(() => this.reportFor(rebuilt), 0)
    }

    return this.latest
  }

  private async readMetricSource(source: MetricSource<SourcePayload<unknown>, unknown>) {
    return metricSourceInput(source, await this.cache.read(source))
  }

  /** Builds the report once per aggregation and writes its one log line. */
  private reportFor(aggregation: Aggregation) {
    if (!aggregation.report) {
      aggregation.report = buildDiagnostics(aggregation.derivation)
      console.info(
        diagnosticsLogLine(aggregation.report, aggregation.derivation.snapshot.entries.length),
      )
    }

    return aggregation.report
  }
}

export type { ModelEntry, ModelSnapshot, ModelVariant } from "./model-aggregator.types"
export type { MetricKey, ReasoningMode } from "../providers"
