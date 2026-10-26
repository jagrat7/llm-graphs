import { createFileRoute } from "@tanstack/react-router"

import { taggedSnapshot } from "#/server/api/models"

const CACHE_HEADERS = {
  // Browsers keep their copy but ask each visit, and get an empty 304 until a source refreshes.
  "Cache-Control": "public, max-age=0, must-revalidate",
  // Vercel's CDN answers for a minute without starting the function, then serves its copy while
  // it fetches the next one.
  "CDN-Cache-Control": "max-age=60, stale-while-revalidate=600",
}

/**
 * The whole snapshot as plain JSON, for the browser's background fetch. A server function's
 * wire format tags every value, which nearly doubles a payload this size.
 */
export const Route = createFileRoute("/api/models/snapshot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { tag, snapshot } = await taggedSnapshot()
        const etag = `"${tag}"`
        const headers = { ...CACHE_HEADERS, ETag: etag }

        if (matchesETag(request.headers.get("If-None-Match"), etag)) {
          return new Response(null, { status: 304, headers })
        }

        return Response.json(snapshot, { headers })
      },
    },
  },
})

/** A browser can send several tags, and compression on the way out can weaken ours to W/"…". */
function matchesETag(header: string | null, etag: string) {
  return (
    header != null &&
    header.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === etag)
  )
}
