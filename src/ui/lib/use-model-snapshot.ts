import { useQuery } from "@tanstack/react-query"

import { orpc } from "./orpc-client"

/**
 * Every model and its metrics, fetched once per page load. It never refetches on focus, reconnect, or
 * staleness, so the data on screen only changes on reload.
 */
export function useModelSnapshot() {
  return useQuery({
    ...orpc.models.snapshot.queryOptions(),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}
