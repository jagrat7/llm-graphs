import type { SourcePayload } from "../provider.types"
export type METRRow = {
  id: string
  release_date: string
  scaffolds: Array<string>
  p50: { estimate: number; ci_low: number; ci_high: number }
  p80: { estimate: number; ci_low: number; ci_high: number } | null
  average_score: number | null
}
export type METRPayload = SourcePayload<METRRow>
