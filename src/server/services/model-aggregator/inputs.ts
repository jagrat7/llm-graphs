import type { CachedPayload } from "../cache/cache"
import type { MetricSource, ModelsDevPayload, SourcePayload } from "../providers"
import type { AggregatorInputs, MetricSourceInput } from "./model-aggregator.types"

/** One metric source's cached copy, as rows ready to join. A missing copy adds nothing. */
export function metricSourceInput<TPayload extends SourcePayload<unknown>>(
  source: MetricSource<TPayload, unknown>,
  cached: CachedPayload<TPayload> | null,
): MetricSourceInput {
  return {
    name: source.name,
    fetchedAt: cached?.fetchedAt ?? null,
    rows: cached ? source.toMetricRows(cached.payload) : [],
    dropped: cached?.payload.dropped ?? [],
  }
}

export function catalogInput(cached: CachedPayload<ModelsDevPayload> | null) {
  return { fetchedAt: cached?.fetchedAt ?? null, payload: cached?.payload ?? null }
}

/** The inputs' fetch times, which is all that can change the result between deploys. */
export function inputsVersion(inputs: AggregatorInputs) {
  return [...inputs.metricSources, inputs.catalog]
    .map((input) => input.fetchedAt ?? "none")
    .join("|")
}
