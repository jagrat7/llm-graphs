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
}
export type ArenaPayload = SourcePayload<ArenaRow>
