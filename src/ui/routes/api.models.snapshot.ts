import { createFileRoute } from "@tanstack/react-router"

import { api } from "#/server/api"

/**
 * The whole snapshot as plain JSON, for the browser's background fetch. A server function's
 * wire format tags every value, which nearly doubles a payload this size.
 */
export const Route = createFileRoute("/api/models/snapshot")({
  server: {
    handlers: {
      GET: async () => Response.json(await api.models.snapshot()),
    },
  },
})
