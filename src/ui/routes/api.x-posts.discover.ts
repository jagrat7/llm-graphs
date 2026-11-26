import { createFileRoute } from "@tanstack/react-router"

import { env } from "#/env"
import { discoverPosts } from "#/server/api/x-posts"

/** Vercel's daily cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export const Route = createFileRoute("/api/x-posts/discover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!env.CRON_SECRET) return new Response("Discovery isn't set up", { status: 503 })
        if (request.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 })
        }

        const report = await discoverPosts()
        console.info(
          `[x-posts] discovery: ${report.searches} searches, ${report.candidates} new posts, ${report.screened} screened, ${report.accepted.length} accepted, ${report.errors.length} errors`,
        )
        return Response.json(report)
      },
    },
  },
})
