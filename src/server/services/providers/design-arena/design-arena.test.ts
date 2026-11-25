import { expect, it } from "vitest"
import { DesignArenaProvider, parseDesignArenaPage } from "./design-arena"

const BOARD = {
  arenaType: "models",
  category: "image",
  data: [
    {
      modelId: "gpt-image-2.5-sunburst",
      battles: 14799,
      winRate: 71.8,
      elo: 1451,
      btStdErr: null,
      avgGenerationTimeMs: 25553,
      avgCostUsd: 0.053,
    },
    {
      modelId: "rowan",
      battles: 2892,
      winRate: 70.7,
      elo: 1445,
      btStdErr: 4,
      avgGenerationTimeMs: 67182,
      avgCostUsd: null,
    },
    { modelId: "unlisted", battles: 10, winRate: 50, elo: 1000 },
  ],
  metadata: { lastUpdateTime: "2026-11-25T08:16:54.495744+00:00" },
}
const REGISTRY = {
  models: {
    "gpt-image-2.5-sunburst": { displayName: "GPT-Image-2.5 Sunburst", provider: "openai" },
    rowan: {
      displayName: "GPT Image 2.6 Sunburst (quality: max, complexity: high)",
      provider: "openai",
    },
  },
}

/** The page's flight data, split across script chunks the way Next.js streams it. */
function page() {
  const flight = `1f:${JSON.stringify({ boards: [BOARD], subcategoryBoards: [], registry: REGISTRY })}\n`
  const half = Math.floor(flight.length / 2)
  return [flight.slice(0, half), flight.slice(half)]
    .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
    .join("")
}

it("reads each image model's rating, cost, time and votes, keeping its settings apart", () => {
  const payload = parseDesignArenaPage(page())
  const rows = new DesignArenaProvider().toMetricRows(payload)

  expect(payload.dropped).toEqual([{ id: "unlisted", reason: expect.any(String) }])
  expect(rows.map((row) => [row.sourceModelId, row.configuration, row.metrics])).toEqual([
    [
      "GPT-Image-2.5 Sunburst",
      undefined,
      { score: 1451, costPerTask: 0.053, durationSeconds: 25.553, votes: 14799 },
    ],
    [
      "GPT Image 2.6 Sunburst",
      "quality max, complexity high",
      { score: 1445, costPerTask: null, durationSeconds: 67.182, votes: 2892 },
    ],
  ])
  expect(rows[0]).toMatchObject({ mode: "off", level: "default", metadata: { creator: "OpenAI" } })
  expect(rows[1].measurements?.score?.interval).toEqual({ low: 1441, high: 1449 })
})

it("fails when the page no longer carries the image board", () => {
  expect(() => parseDesignArenaPage("<html></html>")).toThrow("DesignArena image board missing")
})
