import type { ProviderName } from "#/ui/lib/orpc-client"

import { ProvidersService } from "#/ui/lib/orpc-client"

export function isSource(value: string): value is ProviderName {
  return Object.hasOwn(ProvidersService.metricSources, value)
}

export function sourceLabel(source: ProviderName) {
  return ProvidersService.metricSources[source].displayName
}
