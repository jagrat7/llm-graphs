import { useSuspenseQuery } from "@tanstack/react-query"

import { orpc } from "./orpc-client"

/** Static provider metadata, loaded by the root route before any page renders. */
export const providersInfoQueryOptions = orpc.providers.info.queryOptions({
  staleTime: Infinity,
  gcTime: Infinity,
})

export function useProvidersInfo() {
  return useSuspenseQuery(providersInfoQueryOptions).data
}
