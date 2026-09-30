import type { ArtificialAnalysisRow, MetricReaders } from "../provider.types"

/** AA's usual blend: three input tokens for every output token. */
function blendedPrice(input: number | null, output: number | null) {
  if (input == null || output == null) return null

  const blended = (3 * input + output) / 4
  // AA lists a model it has no hosted price for at $0 in and out.
  return blended > 0 ? blended : null
}

export const artificialAnalysisMetrics: MetricReaders<ArtificialAnalysisRow> = {
  costPerMTokens: {
    read: (row) => blendedPrice(row.price_1m_input_tokens, row.price_1m_output_tokens),
    note: "3:1 input/output blend",
  },
  tokensPerSecond: { read: (row) => row.median_output_tokens_per_second },
}
