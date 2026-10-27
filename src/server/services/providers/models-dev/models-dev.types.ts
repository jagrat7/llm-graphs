import type { SourcePayload } from "../provider.types"

export type ModelsDevModel = {
  /** `creator/model`, where the creator is the vendor slug. */
  id: string
  name: string
  release_date: string | null
  family: string | null
}

export type ModelsDevHost = {
  /** A hosting provider slug from `api.json`, e.g. `deepinfra`. */
  id: string
  name: string
}

export type ModelsDevPayload = SourcePayload<ModelsDevModel> & {
  providers: Array<ModelsDevHost>
  /** Vendor slug → lab logo SVG, for every vendor in `rows`. */
  logos: Record<string, string>
  /** What models.dev serves for a lab it doesn't know. A logo equal to this isn't real. */
  genericLogo: string
}

/** A catalog model with the context window and the prices its own lab's API lists. */
export type ModelsDevListing = {
  /** `creator/model`, as in the catalog. */
  id: string
  contextTokens: number | null
  /** $/M tokens on the creator's own API, both or neither. */
  prices: { input: number; output: number } | null
}

export type ModelsDevListingPayload = SourcePayload<ModelsDevListing>
