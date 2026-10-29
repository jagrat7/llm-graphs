import { expect, it } from "vitest"
import { FrontierCodeProvider, parseFrontierCodeFeed } from "./frontier-code"

function run(score: number, cost: number | null = 1.5) {
  return {
    main: {
      correct: 0.497,
      new_score: score,
      tokens: 41233,
      cost,
      duration_min: null,
      tool_calls: null,
      ote: null,
      flagged_rate: 0.0152,
    },
  }
}

function feed(models = ["Claude Opus 5.5", "GPT-6.1 Sol", "SWE-1.7", "Kimi K3", "Grok 4.7"]) {
  return {
    models,
    harness: { "Claude Opus 5.5": "claude-code", "GPT-6.1 Sol": "codex", "SWE-1.7": "devin-cli" },
    efforts: {
      "Claude Opus 5.5": ["high", "max"],
      "GPT-6.1 Sol": ["xhigh", "max"],
      "SWE-1.7": ["na"],
      "Kimi K3": ["high"],
    },
    subsets: { main: 132 },
    data: {
      "Claude Opus 5.5": { high: run(0.3453, 2.423), max: run(0.4545, 12.821) },
      "GPT-6.1 Sol": { xhigh: run(1.2) },
      "SWE-1.7": { na: run(0.1615, null) },
      "Kimi K3": { high: run(0.1774) },
    },
  }
}

it("reads the published score and rollout cost per model, effort and harness", () => {
  const payload = parseFrontierCodeFeed(feed())
  // GPT-6.1 Sol xhigh is out of range, its max run is missing, Kimi K3 has no harness and
  // Grok 4.7 lists no efforts.
  expect(payload.rows.map((row) => row.id)).toEqual([
    "Claude Opus 5.5 / high",
    "Claude Opus 5.5 / max",
    "SWE-1.7 / na",
  ])
  expect(payload.dropped.map((row) => row.id)).toEqual([
    "GPT-6.1 Sol / xhigh",
    "GPT-6.1 Sol / max",
    "Kimi K3 / high",
    "Grok 4.7",
  ])
  const rows = new FrontierCodeProvider().toMetricRows(payload)
  expect(rows[1]).toMatchObject({
    sourceModelId: "claude-opus-5-5",
    rawId: "Claude Opus 5.5 / max",
    mode: "on",
    level: "max",
    configuration: "Claude Code · FrontierCode 2.0",
    metrics: { score: 45.45, costPerTask: 12.821 },
    metadata: { name: "Claude Opus 5.5", creator: "Anthropic" },
  })
  expect(rows[1]).not.toHaveProperty("configurationKnown")
  expect(rows[1]?.measurements?.score?.detail).toContain("Pass rate: 49.7%")
  expect(rows[1]?.measurements?.costPerTask?.detail).toContain("list API prices")
  expect(rows[2]).toMatchObject({
    sourceModelId: "swe-1-7",
    mode: "unknown",
    level: "unknown",
    configurationKnown: false,
    configuration: "Devin CLI · FrontierCode 2.0",
    metrics: { costPerTask: null },
    metadata: { creator: "Cognition" },
  })
  expect(rows[2]?.measurements?.score?.detail).toContain("Reasoning effort not reported")
})

it("refuses a changed feed shape or duplicate run identity", () => {
  expect(() => parseFrontierCodeFeed({ ...feed(), subsets: { diamond: 40 } })).toThrow()
  expect(() => parseFrontierCodeFeed(feed(["Claude Opus 5.5", "Claude Opus 5.5"]))).toThrow(
    /duplicate/,
  )
})
