import { expect, it } from "vitest"
import { ARCPrizeProvider, parseARCPrizeFeed } from "./arc-prize"

it("pins ARC-AGI-2 and preserves effort, budget, missing cost and run identity", () => {
  const model = {
    datasetId: "v2_Semi_Private",
    modelId: "claude-opus-4-6-thinking-120K-low",
    modelDisplayName: "Claude Opus 4.6 (120K, Low)",
    modelType: "CoT",
    modelReleaseDate: null,
    providerDisplayName: "Anthropic",
    score: 0.6458,
    costPerTask: 2.2507,
    resultsUrl: "",
    display: true,
  }
  const feed = {
    version: "v2",
    generatedAt: "2026-09-30T13:12:37.194Z",
    datasets: [{ id: "v2_Semi_Private" }],
    evaluations: [
      model,
      model,
      {
        ...model,
        modelId: "claude-opus-4-6-thinking-8k",
        modelDisplayName: "Claude Opus 4.6 (Thinking 8K)",
        costPerTask: null,
      },
      {
        ...model,
        modelId: "openai-gpt-6-1-sol-none",
        modelDisplayName: "GPT-6.1 Sol (None)",
        score: 0,
        costPerTask: 0,
      },
      { ...model, modelId: "provisional", modelDisplayName: "Gemini 3 Deep Think (Preview) ²" },
      { ...model, modelId: "custom", modelType: "Refinement" },
      { ...model, modelId: "hidden", display: false },
      { ...model, modelId: "wrong-split", datasetId: "v2_Public_Eval" },
    ],
  }
  const payload = parseARCPrizeFeed(feed)
  expect(payload.rows).toHaveLength(4)
  expect(payload.dropped).toHaveLength(1)
  const rows = new ARCPrizeProvider().toMetricRows(payload)
  expect(rows[0]).toMatchObject({
    sourceModelId: "claude-opus-4-6",
    mode: "on",
    level: "low",
    metrics: { score: 64.58, costPerTask: 2.2507 },
  })
  expect(rows[0]?.configuration).toContain("120K token budget")
  expect(rows[1]).toMatchObject({
    sourceModelId: "claude-opus-4-6",
    level: "8k",
    metrics: { costPerTask: null },
  })
  expect(rows[2]).toMatchObject({
    sourceModelId: "gpt-6-1-sol",
    mode: "off",
    level: "unknown",
    metrics: { score: 0, costPerTask: 0 },
  })
  expect(rows[3]?.metrics.costPerTask).toBeNull()
  expect(rows[3]?.metadata?.name).toBe("Gemini 3 Deep Think (Preview)")
  expect(() => parseARCPrizeFeed({ ...feed, version: "v3" })).toThrow()
  expect(() =>
    parseARCPrizeFeed({ ...feed, evaluations: [model, { ...model, score: 0.9 }] }),
  ).toThrow(/conflicting/)
})
