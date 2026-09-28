import type { ProviderName } from "#/ui/lib/orpc-client"

import { PROVIDERS } from "#/ui/lib/orpc-client"

export function isSource(value: string): value is ProviderName {
  return Object.hasOwn(PROVIDERS, value)
}

export function sourceLabel(source: ProviderName) {
  return PROVIDERS[source].displayName
}

export function sourceFromLabel(label: string): ProviderName | null {
  for (const source of Object.keys(PROVIDERS)) {
    if (!isSource(source)) continue
    if (PROVIDERS[source].displayName === label) return source
  }

  return null
}

export function uniqueSources(labels: Iterable<string | null | undefined>): Array<ProviderName> {
  const seen = new Set<ProviderName>()
  const sources: Array<ProviderName> = []

  for (const label of labels) {
    if (!label) continue
    const source = sourceFromLabel(label)
    if (!source || seen.has(source)) continue
    seen.add(source)
    sources.push(source)
  }

  return sources
}
