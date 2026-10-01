import type { SourcePayload } from "../provider.types"
export type ArenaRow = {
  modelKey: string
  modelDisplayName: string
  modelOrganization: string | null
  rating: number
  ratingLower: number
  ratingUpper: number
  votes: number
  releaseType: string | null
  updatedAt: string
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
  contextLength: number | null
  rank: number | null
  rankLower: number | null
  rankUpper: number | null
}
export type ArenaPayload = SourcePayload<ArenaRow>
