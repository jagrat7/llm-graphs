import type { ProviderName, ProvidersInfo } from "#/server/api"

export function isSource(value: string, info: ProvidersInfo): value is ProviderName {
  return Object.hasOwn(info.displayNames, value)
}

export function sourceLabel(source: ProviderName, info: ProvidersInfo) {
  return info.displayNames[source]
}
