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
    { modelId: "p-image-ideogram-low", battles: 900, winRate: 40, elo: 1100 },
    { modelId: "gemini-2.5-flash-image", battles: 5000, winRate: 55, elo: 1221 },
    { modelId: "negative", battles: 10, winRate: 50, elo: -3 },
    { modelId: "unlisted", battles: 10, winRate: 50, elo: 1000 },
    { modelId: "malformed", battles: 10, winRate: 50, elo: 1000 },
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
    "p-image-ideogram-low": { displayName: "p-image-ideogram (very_low)", provider: "prunaai" },
    "gemini-2.5-flash-image": {
      displayName: "Gemini 2.5 Flash Image (Nano Banana)",
      provider: "google",
    },
    negative: { displayName: "Negative", provider: null },
    malformed: { displayName: 42 },
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

it("reads each image model's rating, cost, time and votes, apart from its settings and nickname", () => {
  const payload = parseDesignArenaPage(page())
  const rows = new DesignArenaProvider().toMetricRows(payload)

  expect(payload.dropped.map((row) => row.id)).toEqual(["negative", "unlisted", "malformed"])
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
    ["p-image-ideogram", "quality very low", expect.objectContaining({ score: 1100 })],
    ["Gemini 2.5 Flash Image", undefined, expect.objectContaining({ score: 1221 })],
  ])
  expect(rows[0]).toMatchObject({ mode: "off", level: "default", metadata: { creator: "OpenAI" } })
  expect(rows[1].measurements?.score?.interval).toEqual({ low: 1441, high: 1449 })
})

it("fails when the page no longer carries the image board", () => {
  expect(() => parseDesignArenaPage("<html></html>")).toThrow("DesignArena image board missing")
})
