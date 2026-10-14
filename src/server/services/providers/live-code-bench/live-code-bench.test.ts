import { expect, it } from "vitest"
import { LiveCodeBenchProvider, parseLiveCodeBenchFeed } from "./live-code-bench"

function feed() {
  const models = [
    { model_name: "o4-mini__high", model_repr: "O4-Mini (High)" },
    { model_name: "claude-sonnet-4-20250514_nothink", model_repr: "Claude-Sonnet-4" },
  ]
  return {
    models,
    date_marks: [Date.parse("2024-08-01"), Date.parse("2025-05-01")],
    performances: models.flatMap((model, index) =>
      Array.from({ length: 454 }, (_, i) => ({
        model: model.model_repr,
        question_id: `problem-${i}`,
        platform: "leetcode",
        date: Date.parse("2024-09-01"),
        difficulty: i === 0 ? "hard" : "easy",
        "pass@1": i === 0 ? 0 : index === 0 ? 80 : 40,
      })),
    ),
  }
}

it("matches the question-weighted published percentage and keeps costs unavailable", () => {
  const provider = new LiveCodeBenchProvider()
  const rows = provider.toMetricRows(parseLiveCodeBenchFeed(feed()))
  expect(rows[0]).toMatchObject({
    sourceModelId: "o4-mini",
    mode: "on",
    level: "high",
    metrics: { score: 79.8 },
  })
  expect(rows[1]).toMatchObject({
    sourceModelId: "claude-sonnet-4-20250514",
    mode: "off",
    level: "unknown",
    configurationKnown: false,
    metrics: { score: 39.9 },
  })
  expect(provider.metrics).not.toHaveProperty("costPerTask")
  expect(rows[0].measurements?.score?.detail).toContain("2024-08-01–2025-05-01")
})

it("drops the whole model when any selected problem is missing or invalid", () => {
  for (const malformed of [false, true]) {
    const raw = feed()
    if (malformed) raw.performances[0]["pass@1"] = 101
    else raw.performances.shift()
    const payload = parseLiveCodeBenchFeed(raw)
    expect(payload.rows).toHaveLength(1)
    expect(payload.rows[0].model_repr).toBe("Claude-Sonnet-4")
    expect(payload.dropped[0].id).toBe("O4-Mini (High)")
  }
})

it("rejects duplicate identities before dropping invalid measurements", () => {
  const raw = feed()
  raw.performances.push({ ...raw.performances[0], "pass@1": 101 })
  expect(() => parseLiveCodeBenchFeed(raw)).toThrow(/duplicate problem/)
  expect(() =>
    parseLiveCodeBenchFeed({ ...feed(), models: [feed().models[0], feed().models[0]] }),
  ).toThrow(/duplicate model/)
})

it("refuses dataset-window changes and conflicting question metadata", () => {
  const raw = feed()
  raw.performances[454].difficulty = "medium"
  expect(() => parseLiveCodeBenchFeed(raw)).toThrow(/conflicting question/)
  expect(() => parseLiveCodeBenchFeed({ ...feed(), date_marks: [] })).toThrow(/window missing/)
  expect(() => parseLiveCodeBenchFeed({ ...feed(), performances: [] })).toThrow(
    /question set changed/,
  )
})

it("preserves thinking with an unreported level and resolves endpoint aliases from published identities", () => {
  const provider = new LiveCodeBenchProvider()
  const rows = provider.toMetricRows({
    dropped: [],
    rows: [
      {
        model_name: "claude-opus-4-20250514",
        model_repr: "Claude-Opus-4 (Thinking)",
        score: 56.6,
        questions: 454,
      },
      {
        model_name: "deepseek-reasoner",
        model_repr: "DeepSeek-R1-0528",
        score: 73.1,
        questions: 454,
      },
    ],
  })
  expect(rows[0]).toMatchObject({
    mode: "on",
    level: "unknown",
    configurationKnown: false,
    sourceModelId: "claude-opus-4-20250514",
  })
  expect(rows[1]).toMatchObject({ mode: "unknown", sourceModelId: "DeepSeek-R1-0528" })
  expect(rows[0].metadata?.releaseDate).toBeNull()
})

it("refuses contradictory reasoning labels rather than guessing a configuration", () => {
  const provider = new LiveCodeBenchProvider()
  const rows = provider.toMetricRows({
    dropped: [],
    rows: [
      { model_name: "o4-mini__high", model_repr: "O4-Mini (Low)", score: 70, questions: 454 },
      {
        model_name: "claude-opus-4_nothink",
        model_repr: "Claude-Opus-4 (Thinking)",
        score: 40,
        questions: 454,
      },
    ],
  })
  expect(rows.every((row) => row.effortConflict != null && row.configurationKnown === false)).toBe(
    true,
  )
})
