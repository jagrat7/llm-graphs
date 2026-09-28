import type {
  MetricRow,
  ModelsDevModel,
  ProviderName,
  SourceName,
} from "../provider/provider.types"
import type {
  EntryProvenance,
  MetadataSource,
  MetricSourceInput,
  RegistryEntry,
  RegistryInputs,
  RegistrySnapshot,
  RegistryVariant,
  VendorRule,
} from "./registry.types"

import {
  buildMatchContext,
  firstWord,
  keyOfWords,
  matchWords,
  normalizeId,
  trailingDateLength,
  type MatchContext,
} from "./match-key"
import {
  CatalogIndex,
  catalogVendor,
  deriveName,
  earliestDate,
  pickSourceName,
  slugify,
  vendorHue,
} from "./metadata"
import { METRIC_SOURCES } from "./registry.types"

/** One model as one source lists it, before it joins other sources. */
type SourceModel = {
  source: SourceName
  id: string
  key: string
  /** The key with a trailing snapshot date removed, and that date. */
  datelessKey: string
  date: string | null
  rows: Array<MetricRow>
  catalog: ModelsDevModel | null
}

type Cluster = {
  members: Array<SourceModel>
  joinedBy: "key" | "date"
}

export type KeyClash = { source: SourceName; key: string; ids: Array<string> }
export type DateGroup = { key: string; ids: Array<{ source: SourceName; id: string }> }

export type Derivation = {
  snapshot: RegistrySnapshot
  provenance: Array<EntryProvenance>
  keyClashes: Array<KeyClash>
  unresolvedDateGroups: Array<DateGroup>
  /** Creator labels whose matched models point at more than one models.dev vendor. */
  splitCreators: Array<{ source: ProviderName; creator: string; vendors: Array<string> }>
  catalogVendors: ReadonlySet<string>
  /** Every metric row that became a variant. Any row missing here is a Failure. */
  attachedRows: ReadonlySet<MetricRow>
  inputs: RegistryInputs
}

function sourceModel(
  source: SourceName,
  id: string,
  context: MatchContext,
  rows: Array<MetricRow>,
  catalog: ModelsDevModel | null,
): SourceModel {
  const words = matchWords(id, context)
  const dateLength = words.length > 1 ? trailingDateLength(words) : 0

  return {
    source,
    id,
    key: keyOfWords(words),
    datelessKey: keyOfWords(dateLength > 0 ? words.slice(0, -dateLength) : words),
    date: dateLength > 0 ? words.slice(-dateLength).join("-") : null,
    rows,
    catalog,
  }
}

function variantKey(row: MetricRow) {
  return `${row.mode}/${row.level}`
}

function groupBy<T>(items: Iterable<T>, keyOf: (item: T) => string) {
  const groups = new Map<string, Array<T>>()

  for (const item of items) {
    const key = keyOf(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return groups
}

function metricSourceModels(input: MetricSourceInput, context: MatchContext) {
  return Array.from(
    groupBy(input.rows, (row) => row.sourceModelId),
    ([id, rows]) => sourceModel(input.name, id, context, rows, null),
  )
}

/** A model that lists one variant twice can't stay whole; each spelling becomes its own model. */
function splitDuplicateVariants(model: SourceModel): Array<SourceModel> {
  const variants = new Set(model.rows.map(variantKey))
  if (variants.size === model.rows.length) return [model]

  return Array.from(
    groupBy(model.rows, (row) => row.rawId),
    ([rawId, rows]) => ({
      ...model,
      id: rawId,
      rows,
    }),
  )
}

/**
 * Two models from one source with the same key clash when they claim the same variant (or, in
 * the catalog, at all). Neither joins anything; each stays its own entry under its own spelling.
 */
function splitClashes(models: Array<SourceModel>) {
  const joinable: Array<SourceModel> = []
  const isolated: Array<SourceModel> = []
  const clashes: Array<KeyClash> = []

  for (const group of groupBy(models, (model) => `${model.source}|${model.key}`).values()) {
    const claims = group.flatMap((model) =>
      model.catalog ? ["catalog"] : model.rows.map(variantKey),
    )

    if (new Set(claims).size === claims.length) {
      joinable.push(...group)
      continue
    }

    clashes.push({
      source: group[0].source,
      key: group[0].key,
      ids: group
        .flatMap((model) => (model.catalog ? [model.id] : model.rows.map((row) => row.rawId)))
        .toSorted(),
    })
    isolated.push(...group.flatMap(splitDuplicateVariants))
  }

  return { joinable, isolated, clashes }
}

function sourcesOf(cluster: Cluster) {
  return new Set(cluster.members.map((member) => member.source))
}

/**
 * A dated and an undated id pair up only when each source brings at most one of the group's
 * models and the group has at most one distinct date. Anything else stays apart and is reported.
 */
function pairDates(clusters: Array<Cluster>) {
  const paired: Array<Cluster> = []
  const unresolved: Array<DateGroup> = []

  for (const [key, group] of groupBy(clusters, (cluster) => cluster.members[0].datelessKey)) {
    if (group.length === 1) {
      paired.push(group[0])
      continue
    }

    const perSource = new Map<SourceName, number>()
    for (const cluster of group) {
      for (const source of sourcesOf(cluster))
        perSource.set(source, (perSource.get(source) ?? 0) + 1)
    }
    const dates = new Set(
      group.map((cluster) => cluster.members[0].date).filter((date) => date != null),
    )

    if (
      perSource.size > 1 &&
      [...perSource.values()].every((count) => count === 1) &&
      dates.size <= 1
    ) {
      paired.push({ members: group.flatMap((cluster) => cluster.members), joinedBy: "date" })
      continue
    }

    paired.push(...group)
    if (perSource.size > 1) {
      unresolved.push({
        key,
        ids: group
          .flatMap((cluster) => cluster.members.map(({ source, id }) => ({ source, id })))
          .toSorted(
            (left, right) =>
              left.id.localeCompare(right.id) || left.source.localeCompare(right.source),
          ),
      })
    }
  }

  return { paired, unresolved }
}

function isMetricSource(source: SourceName): source is ProviderName {
  return source !== "modelsDev"
}

function entryId(cluster: Cluster) {
  const catalogMember = cluster.members.find((member) => member.catalog)
  if (catalogMember) return normalizeId(catalogMember.id)

  return cluster.members
    .filter((member) => isMetricSource(member.source))
    .map((member) => normalizeId(member.id))
    .toSorted()[0]
}

function mostCommon(values: ReadonlyArray<string>) {
  const counts = groupBy(values, (value) => value)

  return (
    [...counts.entries()].toSorted(
      ([left, leftItems], [right, rightItems]) =>
        rightItems.length - leftItems.length || left.localeCompare(right),
    )[0]?.[0] ?? null
  )
}

type ResolvedMetadata = {
  name: string
  vendor: string | null
  releaseDate: string | null
  metadataFrom: MetadataSource
  vendorRule: VendorRule
  creator: string | null
}

/**
 * Maps each creator label to a vendor slug: by the models.dev vendors of its matched models, else
 * by the first words of its models, else by the label's own slug.
 */
function resolveCreators(clusters: Array<{ id: string; cluster: Cluster }>, catalog: CatalogIndex) {
  const votes = new Map<
    string,
    { source: ProviderName; vendors: Set<string>; words: Set<string> }
  >()

  for (const { id, cluster } of clusters) {
    const catalogMember = cluster.members.find((member) => member.catalog)

    for (const member of cluster.members) {
      if (!isMetricSource(member.source)) continue

      for (const row of member.rows) {
        const creator = row.metadata?.creator
        if (!creator) continue

        const vote = votes.get(creator) ?? {
          source: member.source,
          vendors: new Set(),
          words: new Set(),
        }
        if (catalogMember?.catalog) vote.vendors.add(catalogVendor(catalogMember.catalog))
        vote.words.add(firstWord(id))
        votes.set(creator, vote)
      }
    }
  }

  const vendorByCreator = new Map<string, { vendor: string; rule: VendorRule }>()
  const splitCreators: Derivation["splitCreators"] = []

  for (const [creator, vote] of [...votes.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (vote.vendors.size === 1) {
      vendorByCreator.set(creator, { vendor: [...vote.vendors][0], rule: "creator vote" })
      continue
    }

    if (vote.vendors.size > 1) {
      splitCreators.push({ source: vote.source, creator, vendors: [...vote.vendors].toSorted() })
    } else {
      const wordVendors = new Set(
        [...vote.words]
          .map((word) => catalog.vendorForFirstWord(word))
          .filter((vendor) => vendor != null),
      )

      if (wordVendors.size === 1) {
        vendorByCreator.set(creator, { vendor: [...wordVendors][0], rule: "first-word vote" })
        continue
      }
    }

    vendorByCreator.set(creator, { vendor: slugify(creator), rule: "creator slug" })
  }

  return { vendorByCreator, splitCreators }
}

function resolveMetadata(
  id: string,
  cluster: Cluster,
  catalog: CatalogIndex,
  vendorByCreator: Map<string, { vendor: string; rule: VendorRule }>,
): ResolvedMetadata {
  const catalogModel = cluster.members.find((member) => member.catalog)?.catalog

  if (catalogModel) {
    return {
      name: catalogModel.name,
      vendor: catalogVendor(catalogModel),
      releaseDate: catalogModel.release_date,
      metadataFrom: "modelsDev",
      vendorRule: "models.dev",
      creator: null,
    }
  }

  for (const source of METRIC_SOURCES) {
    const metadata = cluster.members
      .filter((member) => member.source === source)
      .flatMap((member) => member.rows.map((row) => row.metadata))
      .filter((value) => value != null)
    if (metadata.length === 0) continue

    const creator = mostCommon(
      metadata.map((value) => value.creator).filter((value) => value != null),
    )
    const resolved = creator ? vendorByCreator.get(creator) : undefined
    const fallbackVendor = catalog.vendorForFirstWord(firstWord(id))

    return {
      name: pickSourceName(metadata.map((value) => value.name)) ?? deriveName(id, catalog),
      vendor: resolved?.vendor ?? fallbackVendor,
      releaseDate: earliestDate(metadata.map((value) => value.releaseDate)),
      metadataFrom: source,
      vendorRule: resolved?.rule ?? (fallbackVendor ? "id first word" : "unknown"),
      creator,
    }
  }

  const vendor = catalog.vendorForFirstWord(firstWord(id))

  return {
    name: deriveName(id, catalog),
    vendor,
    releaseDate: null,
    metadataFrom: "derived",
    vendorRule: vendor ? "id first word" : "unknown",
    creator: null,
  }
}

function emptyVariants(): Record<ProviderName, Array<RegistryVariant>> {
  return { deepswe: [], artificialAnalysis: [] }
}

function compareVariants(left: RegistryVariant, right: RegistryVariant) {
  return (
    left.entryId.localeCompare(right.entryId) ||
    left.mode.localeCompare(right.mode) ||
    left.level.localeCompare(right.level)
  )
}

/**
 * Turns every source's cached payload into the registry: one entry per model any metric source
 * lists, with each source's variant rows keyed by (entry id, mode, level). Pure, so a better rule
 * reapplies to everything on the next deploy.
 */
export function deriveRegistry(inputs: RegistryInputs): Derivation {
  const catalogPayload = inputs.catalog.payload
  const catalogModels = catalogPayload?.rows ?? []
  const context = buildMatchContext(
    catalogPayload?.providers.map((provider) => provider.id) ?? [],
    catalogModels.map((model) => model.id),
  )
  const catalog = new CatalogIndex(catalogModels)
  const models = [
    ...inputs.metricSources.flatMap((input) => metricSourceModels(input, context)),
    ...catalogModels.map((model) => sourceModel("modelsDev", model.id, context, [], model)),
  ]
  const { joinable, isolated, clashes } = splitClashes(models)
  const keyed = Array.from(
    groupBy(joinable, (model) => model.key).values(),
    (members): Cluster => ({
      members,
      joinedBy: "key",
    }),
  )
  const { paired, unresolved } = pairDates(keyed)
  const clusters = [
    ...paired,
    ...isolated
      .filter((model) => isMetricSource(model.source))
      .map((model): Cluster => ({ members: [model], joinedBy: "key" })),
  ]
    .filter((cluster) => cluster.members.some((member) => isMetricSource(member.source)))
    .map((cluster) => ({ id: entryId(cluster), cluster }))
    .toSorted((left, right) => left.id.localeCompare(right.id))
  const { vendorByCreator, splitCreators } = resolveCreators(clusters, catalog)
  const entries: Array<RegistryEntry> = []
  const provenance: Array<EntryProvenance> = []
  const variants = emptyVariants()
  const vendors = new Set<string>()
  const attachedRows = new Set<MetricRow>()

  for (const { id, cluster } of clusters) {
    const metadata = resolveMetadata(id, cluster, catalog, vendorByCreator)
    if (metadata.vendor) vendors.add(metadata.vendor)

    entries.push({
      id,
      name: metadata.name,
      vendor: metadata.vendor,
      hue: metadata.vendor ? vendorHue(metadata.vendor) : null,
      releaseDate: metadata.releaseDate,
    })
    provenance.push({
      id,
      members: cluster.members
        .map(({ source, id: memberId }) => ({ source, id: memberId }))
        .toSorted(
          (left, right) =>
            left.source.localeCompare(right.source) || left.id.localeCompare(right.id),
        ),
      metadataFrom: metadata.metadataFrom,
      vendorRule: metadata.vendorRule,
      creator: metadata.creator,
      joinedBy: cluster.joinedBy,
    })

    for (const member of cluster.members) {
      if (!isMetricSource(member.source)) continue

      for (const row of member.rows) {
        attachedRows.add(row)
        variants[member.source].push({
          entryId: id,
          mode: row.mode,
          level: row.level,
          metrics: row.metrics,
          ...(row.effortConflict ? { refused: true as const } : {}),
        })
      }
    }
  }

  const logos: Record<string, string> = {}
  for (const vendor of [...vendors].toSorted()) {
    const logo = catalogPayload?.logos[vendor]
    if (logo && logo !== catalogPayload.genericLogo) logos[vendor] = logo
  }

  const fetchedAtOf = (name: ProviderName) =>
    inputs.metricSources.find((input) => input.name === name)?.fetchedAt ?? null
  const fetchedAt: Record<SourceName, string | null> = {
    deepswe: fetchedAtOf("deepswe"),
    artificialAnalysis: fetchedAtOf("artificialAnalysis"),
    modelsDev: inputs.catalog.fetchedAt,
  }

  return {
    snapshot: {
      entries,
      logos,
      variants: {
        deepswe: variants.deepswe.toSorted(compareVariants),
        artificialAnalysis: variants.artificialAnalysis.toSorted(compareVariants),
      },
      fetchedAt,
    },
    provenance,
    keyClashes: clashes,
    unresolvedDateGroups: unresolved,
    splitCreators,
    catalogVendors: new Set(catalogModels.map((model) => catalogVendor(model))),
    attachedRows,
    inputs,
  }
}
