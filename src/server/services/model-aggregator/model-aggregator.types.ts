import type {
  DroppedRow,
  MetricRow,
  MetricValues,
  ModelsDevPayload,
  ProviderName,
  ReasoningMode,
  SourceName,
} from "../providers"

/** Metric sources in metadata order: the first one listing a model names it. */
export const METADATA_ORDER = [
  "artificialAnalysis",
  "deepswe",
] as const satisfies ReadonlyArray<ProviderName>

export type MetricSourceInput = {
  name: ProviderName
  fetchedAt: string | null
  rows: Array<MetricRow>
  dropped: Array<DroppedRow>
}

export type AggregatorInputs = {
  metricSources: Array<MetricSourceInput>
  catalog: { fetchedAt: string | null; payload: ModelsDevPayload | null }
}

export type ModelEntry = {
  /** What `?models=` stores. models.dev's spelling when it has the model. */
  id: string
  name: string
  /** A slug, or null when no rule could name one. */
  vendor: string | null
  /** Chart hue in degrees, from the vendor slug. Null for an unknown vendor. */
  hue: number | null
  releaseDate: string | null
}

export type ModelVariant = {
  entryId: string
  mode: ReasoningMode
  level: string
  metrics: MetricValues
  /** The row's own labels contradict each other, so it never joins another source's row. */
  refused?: true
}

export type ModelSnapshot = {
  entries: Array<ModelEntry>
  /** Vendor slug → lab logo SVG. A vendor with only models.dev's generic mark is absent. */
  logos: Record<string, string>
  variants: Record<ProviderName, Array<ModelVariant>>
  fetchedAt: Record<SourceName, string | null>
}

export type MetadataSource = "modelsDev" | ProviderName | "derived"

export type VendorRule =
  | "models.dev"
  | "creator vote"
  | "first-word vote"
  | "creator slug"
  | "id first word"
  | "unknown"

/** Where each part of an entry came from. Kept out of the snapshot; tests and the report read it. */
export type EntryProvenance = {
  id: string
  members: Array<{ source: SourceName; id: string }>
  metadataFrom: MetadataSource
  vendorRule: VendorRule
  creator: string | null
  /** How the members were joined: one shared key, or a dated/undated pair. */
  joinedBy: "key" | "date"
}
