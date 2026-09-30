import { useQuery } from "@tanstack/react-query"

import { orpc } from "./orpc-client"

/**
 * The whole registry, fetched once per page load. It never refetches on focus, reconnect, or
 * staleness, so the data on screen only changes on reload.
 */
export function useRegistrySnapshot() {
  return useQuery({
    ...orpc.registry.snapshot.queryOptions(),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}
