import { ProvidersService, type ProviderName, type SourceName } from "../providers"
import type { DateGroup, Derivation, KeyClash } from "./derive"
import type { MetadataSource, VendorRule } from "./model-aggregator.types"

import { normalizeId } from "./match-key"

type SourceId = { source: SourceName; id: string }

export type NearMiss = SourceId & {
  /** Why the looser comparison would pair them. Diagnosis only; matching stays strict. */
  why: "prefix" | "edit distance" | "same name"
}

export type UnmatchedId = { id: string; entryId: string; nearMisses: Array<NearMiss> }

export type DiagnosticsReport = {
  fetchedAt: Record<SourceName, string | null>
  /** One number per kind of item below, also written to the log on every rebuild. */
  counts: Record<string, number>
  /** Broken invariants. Tests assert there are none. */
  failures: {
    duplicateEntryIds: Array<string>
    emptyNames: Array<string>
    unattachedRows: Array<SourceId>
    futureReleaseDates: Array<{ id: string; releaseDate: string; fetchedAt: string }>
    droppedRows: Array<SourceId & { reason: string }>
  }
  /** Per source: its clashes, and its ids no other metric source lists, near misses first. */
  sources: Record<SourceName, { keyClashes: Array<KeyClash>; unmatched: Array<UnmatchedId> }>
  unresolvedDateGroups: Array<DateGroup>
  models: {
    effortConflicts: Array<SourceId & { conflict: string }>
    /** Models two metric sources list with no (mode, level) pair in common. */
    noSharedVariant: Array<{ id: string; variants: Partial<Record<ProviderName, Array<string>>> }>
  }
  metadata: {
    metadataFrom: Partial<Record<MetadataSource, number>>
    vendorRule: Partial<Record<VendorRule, number>>
    derivedNames: Array<{ id: string; name: string }>
    unknownVendors: Array<string>
    /** Vendors made from a creator label's slug that models.dev doesn't know. */
    nonCatalogVendors: Array<{ creator: string; vendor: string }>
    splitCreators: Derivation["splitCreators"]
    undated: Array<string>
  }
}

const METRIC_SOURCE_NAMES = ProvidersService.names

function tally<T extends string>(values: Iterable<T>) {
  const counts: Partial<Record<T, number>> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1

  return counts
}

/** Levenshtein distance, stopping early once it exceeds `limit`. */
function editDistanceWithin(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > limit) return false

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    let best = row

    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      )
      best = Math.min(best, current[column])
    }

    if (best > limit) return false
    previous = current
  }

  return previous[right.length] <= limit
}

function numberedWords(id: string) {
  return id
    .split("-")
    .filter((word) => /\d/.test(word))
    .join("-")
}

type Candidate = SourceId & { normalized: string; entryId: string | null; name: string }

function nearMissReason(id: string, name: string, candidate: Candidate): NearMiss["why"] | null {
  if (id.startsWith(`${candidate.normalized}-`) || candidate.normalized.startsWith(`${id}-`)) {
    return "prefix"
  }
  // Different version numbers are never a typo: `claude-opus-4-5` is not a near miss of `-4-6`.
  if (
    numberedWords(id) === numberedWords(candidate.normalized) &&
    editDistanceWithin(id, candidate.normalized, 2)
  ) {
    return "edit distance"
  }
  if (name.toLowerCase() === candidate.name.toLowerCase()) return "same name"

  return null
}

/**
 * Sorts wrong output into Failures (broken invariants), Refusals (matches declined on purpose),
 * and the metadata lists a reviewer reads. Grouped per source and per model, never by pairs of
 * sources, so it grows linearly with the number of sources.
 */
export function buildDiagnostics(derivation: Derivation): DiagnosticsReport {
  const { snapshot, provenance, inputs } = derivation
  const entryById = new Map(snapshot.entries.map((entry) => [entry.id, entry]))
  const idCounts = tally(snapshot.entries.map((entry) => entry.id))
  const catalog = inputs.catalog.payload

  const failures: DiagnosticsReport["failures"] = {
    duplicateEntryIds: Object.entries(idCounts)
      .filter(([, count]) => (count ?? 0) > 1)
      .map(([id]) => id),
    emptyNames: snapshot.entries
      .filter((entry) => entry.name.trim() === "")
      .map((entry) => entry.id),
    unattachedRows: inputs.metricSources.flatMap((input) =>
      input.rows
        .filter((row) => !derivation.attachedRows.has(row))
        .map((row) => ({ source: input.name, id: row.rawId })),
    ),
    futureReleaseDates: provenance.flatMap((from) => {
      const entry = entryById.get(from.id)
      const fetchedAt =
        from.metadataFrom === "derived" ? null : snapshot.fetchedAt[from.metadataFrom]
      // Compared by day: a source may give a full timestamp, and a same-day release isn't future.
      if (
        !entry?.releaseDate ||
        !fetchedAt ||
        entry.releaseDate.slice(0, 10) <= fetchedAt.slice(0, 10)
      ) {
        return []
      }

      return [{ id: entry.id, releaseDate: entry.releaseDate, fetchedAt }]
    }),
    droppedRows: [
      ...inputs.metricSources.flatMap((input) =>
        input.dropped.map((row) => ({ source: input.name, id: row.id ?? "?", reason: row.reason })),
      ),
      ...(catalog?.dropped ?? []).map((row) => ({
        source: "modelsDev" as const,
        id: row.id ?? "?",
        reason: row.reason,
      })),
    ],
  }

  const candidates: Array<Candidate> = [
    ...provenance.flatMap((from) =>
      from.members.map((member) => ({
        ...member,
        normalized: normalizeId(member.id),
        entryId: from.id,
        name: entryById.get(from.id)?.name ?? "",
      })),
    ),
    ...(catalog?.rows ?? [])
      .filter(
        (model) =>
          !provenance.some((from) => from.members.some((member) => member.id === model.id)),
      )
      .map((model) => ({
        source: "modelsDev" as const,
        id: model.id,
        normalized: normalizeId(model.id),
        entryId: null,
        name: model.name,
      })),
  ]

  const sourceReport = (source: SourceName) => ({
    keyClashes: derivation.keyClashes.filter((clash) => clash.source === source),
    unmatched: [] as Array<UnmatchedId>,
  })
  const sources: DiagnosticsReport["sources"] = {
    ...ProvidersService.record(sourceReport),
    modelsDev: sourceReport("modelsDev"),
  }

  for (const from of provenance) {
    const metricSources = new Set(
      from.members.map((member) => member.source).filter((source) => source !== "modelsDev"),
    )
    if (metricSources.size !== 1) continue

    const name = entryById.get(from.id)?.name ?? ""
    const hasCatalog = from.members.some((member) => member.source === "modelsDev")
    for (const member of from.members) {
      if (member.source === "modelsDev") continue

      const normalized = normalizeId(member.id)
      const nearMisses = candidates.flatMap((candidate): Array<NearMiss> => {
        if (candidate.source === member.source || candidate.entryId === from.id) return []
        if (hasCatalog && candidate.source === "modelsDev") return []
        const why = nearMissReason(normalized, name, candidate)

        return why ? [{ source: candidate.source, id: candidate.id, why }] : []
      })
      sources[member.source].unmatched.push({ id: member.id, entryId: from.id, nearMisses })
    }
  }

  for (const source of METRIC_SOURCE_NAMES) {
    sources[source].unmatched = sources[source].unmatched.toSorted(
      (left, right) =>
        Number(right.nearMisses.length > 0) - Number(left.nearMisses.length > 0) ||
        left.id.localeCompare(right.id),
    )
  }

  const variantKeys = (source: ProviderName, id: string) =>
    snapshot.variants[source]
      .filter((variant) => variant.entryId === id && !variant.refused)
      .map((variant) => `${variant.mode}/${variant.level}`)
  const noSharedVariant = provenance.flatMap((from) => {
    const listed = METRIC_SOURCE_NAMES.filter((source) =>
      from.members.some((member) => member.source === source),
    )
    if (listed.length < 2) return []

    const variants = Object.fromEntries(
      listed.map((source) => [source, variantKeys(source, from.id)]),
    )
    const [first, ...rest] = listed.map((source) => new Set(variants[source]))
    const shared = [...first].some((key) => rest.every((keys) => keys.has(key)))

    return shared ? [] : [{ id: from.id, variants }]
  })

  const nonCatalogVendors = new Map<string, string>()
  for (const from of provenance) {
    const vendor = entryById.get(from.id)?.vendor
    if (
      from.vendorRule === "creator slug" &&
      from.creator &&
      vendor &&
      !derivation.catalogVendors.has(vendor)
    ) {
      nonCatalogVendors.set(from.creator, vendor)
    }
  }

  const report: DiagnosticsReport = {
    fetchedAt: snapshot.fetchedAt,
    counts: {},
    failures,
    sources,
    unresolvedDateGroups: derivation.unresolvedDateGroups,
    models: {
      effortConflicts: inputs.metricSources.flatMap((input) =>
        input.rows.flatMap((row) =>
          row.effortConflict
            ? [{ source: input.name, id: row.rawId, conflict: row.effortConflict }]
            : [],
        ),
      ),
      noSharedVariant,
    },
    metadata: {
      metadataFrom: tally(provenance.map((from) => from.metadataFrom)),
      vendorRule: tally(provenance.map((from) => from.vendorRule)),
      derivedNames: provenance
        .filter((from) => from.metadataFrom === "derived")
        .map((from) => ({ id: from.id, name: entryById.get(from.id)?.name ?? "" })),
      unknownVendors: snapshot.entries
        .filter((entry) => entry.vendor == null)
        .map((entry) => entry.id),
      nonCatalogVendors: [...nonCatalogVendors]
        .map(([creator, vendor]) => ({ creator, vendor }))
        .toSorted((left, right) => left.vendor.localeCompare(right.vendor)),
      splitCreators: derivation.splitCreators,
      undated: snapshot.entries
        .filter((entry) => entry.releaseDate == null)
        .map((entry) => entry.id),
    },
  }

  report.counts = countItems(report)

  return report
}

function countItems(report: DiagnosticsReport) {
  const { failures, sources, models, metadata } = report
  const failureCount = Object.values(failures).reduce((total, items) => total + items.length, 0)
  const counts: Record<string, number> = { failures: failureCount }

  for (const [kind, items] of Object.entries(failures)) counts[kind] = items.length
  for (const [source, { keyClashes, unmatched }] of Object.entries(sources)) {
    counts[`${source}.keyClashes`] = keyClashes.length
    if (source === "modelsDev") continue
    counts[`${source}.unmatched`] = unmatched.length
    counts[`${source}.nearMisses`] = unmatched.filter((item) => item.nearMisses.length > 0).length
  }
  counts.unresolvedDateGroups = report.unresolvedDateGroups.length
  counts.effortConflicts = models.effortConflicts.length
  counts.noSharedVariant = models.noSharedVariant.length
  counts.derivedNames = metadata.derivedNames.length
  counts.unknownVendors = metadata.unknownVendors.length
  counts.nonCatalogVendors = metadata.nonCatalogVendors.length
  counts.splitCreators = metadata.splitCreators.length
  counts.undated = metadata.undated.length

  return counts
}

/** The one log line each rebuild writes. */
export function diagnosticsLogLine(report: DiagnosticsReport, entryCount: number) {
  const counts = Object.entries(report.counts)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(" ")

  return `[aggregator] rebuilt ${entryCount} entries: ${counts}`
}
