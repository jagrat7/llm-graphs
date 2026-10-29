import type { MetricReaders } from "../provider.types"
import type { ArtificialAnalysisRow } from "./artificial-analysis.types"

function listedPrices(row: ArtificialAnalysisRow): { input: number; output: number } | null {
  const { price_1m_input_tokens: input, price_1m_output_tokens: output } = row
  if (
    input == null ||
    output == null ||
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input < 0 ||
    output < 0
  )
    return null

  // AA lists a model it has no hosted price for at $0 in and out.
  return input === 0 && output === 0 ? null : { input, output }
}

export const artificialAnalysisMetrics: MetricReaders<ArtificialAnalysisRow> = {
  score: {
    read: (row) => validMetric(row.intelligence_index),
    presentation: { label: "Intelligence Index", unit: "points", format: "number" },
    note: "AA Intelligence Index; native index points",
    describe: (row) => ({
      label: `AA Intelligence Index${row.index_version ? ` v${row.index_version}` : ""}`,
    }),
  },
  costPerTask: {
    read: (row) => validMetric(row.cost_per_task),
    note: "AA Intelligence Index mean cost per task; same configuration",
    describe: (row) => ({
      label: `AA Intelligence Index${row.index_version ? ` v${row.index_version}` : ""}`,
    }),
  },
  costPerMTokens: {
    scope: "model",
    read: (row) => {
      const prices = listedPrices(row)
      return prices && (3 * prices.input + prices.output) / 4
    },
    note: "3:1 input/output blend",
  },
  inputPricePerMTokens: {
    scope: "model",
    read: (row) => listedPrices(row)?.input ?? null,
    presentation: { label: "Input token price", unit: "$/M tokens", format: "currency" },
  },
  outputPricePerMTokens: {
    scope: "model",
    read: (row) => listedPrices(row)?.output ?? null,
    presentation: { label: "Output token price", unit: "$/M tokens", format: "currency" },
  },
  tokensPerSecond: {
    read: (row) =>
      row.median_output_tokens_per_second != null &&
      Number.isFinite(row.median_output_tokens_per_second) &&
      row.median_output_tokens_per_second > 0
        ? row.median_output_tokens_per_second
        : null,
    note: "AA output-generation benchmark",
  },
}

function validMetric(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null
}
