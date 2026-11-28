import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createServerOnlyFn } from "@tanstack/react-start"
import { z } from "zod"

import { XPostsService } from "../services/x-posts"
import { discoveryModels } from "./x-posts"

const DAY_MS = 24 * 60 * 60 * 1000
const CATEGORIES = ["coding", "agents", "reasoning", "chat", "speed", "image"] as const

const reply = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }],
})

function examplesServer() {
  const server = new McpServer({ name: "llm-graphs-examples", version: "1.0.0" })

  server.registerTool(
    "list_models",
    {
      description:
        "Benchmarked models released recently, newest first, with how many example posts each has. Use an id from here for submit_posts.",
      inputSchema: {
        withinDays: z
          .number()
          .int()
          .positive()
          .max(3650)
          .default(120)
          .describe("Released within this many days"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ withinDays }) => {
      const [models, stats] = await Promise.all([discoveryModels(), XPostsService.stats()])
      const kept = new Map(stats.models.map((entry) => [entry.model, entry]))
      const now = Date.now()
      return reply(
        models
          .map((model) => ({
            ...model,
            ageDays: Math.floor((now - Date.parse(model.releaseDate ?? "")) / DAY_MS),
            kept: kept.get(model.id)?.kept ?? 0,
            shown: kept.get(model.id)?.shown ?? 0,
          }))
          .filter((model) => Number.isFinite(model.ageDays) && model.ageDays <= withinDays)
          .toSorted((left, right) => left.ageDays - right.ageDays),
      )
    },
  )

  server.registerTool(
    "submit_posts",
    {
      description:
        "Screens X posts found for one model: loads each, skips ones already seen or without media or under 5 likes, asks Jev whether it shows that model's real output, and keeps the sure ones on the Examples page. Takes about a minute for 100 posts.",
      inputSchema: {
        model: z.string().describe("Model id from list_models"),
        posts: z.array(z.string()).min(1).max(100).describe("Post ids or x.com status links"),
      },
    },
    async ({ model, posts }) =>
      reply(await XPostsService.submit(posts, model, await discoveryModels())),
  )

  server.registerTool(
    "list_posts",
    {
      description:
        "Kept example posts, most liked first, each marked with whether the page shows it (the page caps posts per model and per author) and whether it's blocked.",
      inputSchema: {
        model: z.string().optional().describe("Model id"),
        category: z.enum(CATEGORIES).optional(),
        limit: z.number().int().positive().max(500).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    async (filter) => reply(await XPostsService.list(filter)),
  )

  const blockTarget = {
    post: z.string().optional().describe("Post id or x.com status link"),
    author: z.string().optional().describe("X handle, with or without @"),
  }
  server.registerTool(
    "block",
    {
      description:
        "Hides a post, or every post by an author, from the Examples page and from future searches.",
      inputSchema: blockTarget,
      annotations: { destructiveHint: true },
    },
    async (target) => reply(await XPostsService.setBlocked(target, true)),
  )
  server.registerTool(
    "unblock",
    {
      description: "Shows a blocked post or author again.",
      inputSchema: blockTarget,
    },
    async (target) => reply(await XPostsService.setBlocked(target, false)),
  )

  server.registerTool(
    "run_discovery",
    {
      description:
        "Runs the daily Firecrawl search now (15 searches, about 30 of the 1,000 free monthly credits, about 2 minutes).",
    },
    async () => reply(await XPostsService.discover(await discoveryModels())),
  )

  server.registerTool(
    "stats",
    {
      description:
        "Posts kept and shown per model, the page's limits, block lists, and the latest search and submit runs.",
      annotations: { readOnlyHint: true },
    },
    async () => reply(await XPostsService.stats()),
  )

  return server
}

/** Answers one MCP request; each request gets its own server, so nothing is kept between them. */
export const handleMcp = createServerOnlyFn(async (request: Request) => {
  const server = examplesServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
})
