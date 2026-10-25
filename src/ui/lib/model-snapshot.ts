import { createIsomorphicFn } from "@tanstack/react-start"

import type { ModelSnapshot } from "#/server/api"

import { api } from "#/server/api"

/** Every model and its metrics: read directly on the server, as plain JSON in the browser. */
export const fetchModelSnapshot = createIsomorphicFn()
  .server(() => api.models.snapshot())
  .client(async (): Promise<ModelSnapshot> => {
    const response = await fetch("/api/models/snapshot")
    if (!response.ok) throw new Error(`Model snapshot request failed: ${response.status}`)

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own route serializes this type
    return (await response.json()) as ModelSnapshot
  })
