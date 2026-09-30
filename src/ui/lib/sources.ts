import type { ProviderName, ProvidersInfo } from "#/ui/lib/orpc-client"

export function isSource(value: string, info: ProvidersInfo): value is ProviderName {
  return Object.hasOwn(info.displayNames, value)
}

export function sourceLabel(source: ProviderName, info: ProvidersInfo) {
  return info.displayNames[source]
}
