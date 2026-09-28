import type { ProviderName } from "#/ui/lib/orpc-client"

import { PROVIDERS } from "#/ui/lib/orpc-client"

export function isSource(value: string): value is ProviderName {
  return value in PROVIDERS
}

export function sourceLabel(source: ProviderName) {
  return PROVIDERS[source].displayName
}
