import type { SourcePayload } from "../provider.types"
export type ArenaRow = {
  modelName: string
  organization: string | null
  rating: number
  ratingLower: number
  ratingUpper: number
  votes: number
  rank: number
  publishDate: string
}
export type ArenaPayload = SourcePayload<ArenaRow>
