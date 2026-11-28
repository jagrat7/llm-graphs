import { createFileRoute } from "@tanstack/react-router"

import { env } from "#/env"
import { handleMcp } from "#/server/api/mcp"

async function guarded(request: Request) {
  if (!env.MCP_SECRET) return new Response("The MCP isn't set up", { status: 503 })
  if (request.headers.get("Authorization") !== `Bearer ${env.MCP_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  return handleMcp(request)
}

/** The examples MCP, for agents: `Authorization: Bearer $MCP_SECRET`. */
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => guarded(request),
      POST: ({ request }) => guarded(request),
      DELETE: ({ request }) => guarded(request),
    },
  },
})
