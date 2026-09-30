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
