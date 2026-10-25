import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"

import { api } from "#/server/api"

/** Static provider metadata, loaded by the root route before any page renders. */
export const providersInfoQueryOptions = queryOptions({
  queryKey: ["providers", "info"],
  queryFn: () => api.providers.info(),
  staleTime: Infinity,
  gcTime: Infinity,
})

export function useProvidersInfo() {
  return useSuspenseQuery(providersInfoQueryOptions).data
}
