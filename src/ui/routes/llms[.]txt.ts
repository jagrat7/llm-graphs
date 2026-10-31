import { createFileRoute } from "@tanstack/react-router"

import { api } from "#/server/api"
import { llmsTxt } from "#/ui/lib/llms-txt"

/** The site described for AI agents, so they can pick a chart's options and hand back a link. */
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [info, snapshot] = await Promise.all([api.providers.info(), api.models.snapshot()])

        return new Response(llmsTxt(info, snapshot, new URL(request.url).origin), {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            // Changes only when a source refreshes, so Vercel's CDN answers most requests.
            "CDN-Cache-Control": "max-age=600, stale-while-revalidate=3600",
          },
        })
      },
    },
  },
})
