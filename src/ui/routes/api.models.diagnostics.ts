import { createFileRoute } from "@tanstack/react-router"

import { api } from "#/server/api"

/** Public and read-only, but not linked from the UI. */
export const Route = createFileRoute("/api/models/diagnostics")({
  server: {
    handlers: {
      GET: async () => Response.json(await api.models.diagnostics()),
    },
  },
})
