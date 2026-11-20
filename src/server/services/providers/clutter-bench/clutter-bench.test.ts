import { describe, expect, it } from "vitest"

import { ClutterBenchProvider, parseClutterBench } from "./clutter-bench"

const sonnet = {
  model: "sonnet",
  name: "Claude Sonnet 5.5 (low)",
  effort: "low",
  raw: { n: 6, clutter: 28.8, usd: 0.03257, sec: 32 },
  simple: { n: 6, clutter: 0, usd: null, sec: 25 },
}
const data = {
  builtAt: "2026-11-17T20:22:54.669Z",
  grader: "consensus-v4",
  board: [sonnet],
}

describe("ClutterBench", () => {
  it("keeps native clutter and costs separate for each prompt at the same effort", () => {
    const raw = new ClutterBenchProvider("raw").toMetricRows(parseClutterBench(data, "raw"))
    const simple = new ClutterBenchProvider("simple").toMetricRows(
      parseClutterBench(data, "simple"),
    )

    expect(raw).toMatchObject([
      {
        sourceModelId: "Claude Sonnet 5.5",
        rawId: "sonnet",
        mode: "on",
        level: "low",
        metrics: { score: 28.8, costPerTask: 0.03257, durationSeconds: 32 },
      },
    ])
    expect(simple).toMatchObject([
      { metrics: { score: 0, costPerTask: null, durationSeconds: 25 } },
    ])
    expect(raw[0].harness).not.toBe(simple[0].harness)
  })

  it("drops an invalid percentage without losing an otherwise valid row with missing usage", () => {
    const payload = parseClutterBench(
      {
        ...data,
        board: [
          sonnet,
          { ...sonnet, model: "invalid", raw: { ...sonnet.raw, clutter: 101 } },
          {
            model: "terra-none",
            name: "GPT-6.1 Terra (none)",
            effort: "none",
            raw: { n: 6, clutter: 38.2 },
          },
        ],
      },
      "raw",
    )
    expect(payload.dropped).toMatchObject([{ id: "invalid" }])
    expect(new ClutterBenchProvider("raw").toMetricRows(payload)[1]).toMatchObject({
      sourceModelId: "GPT-6.1 Terra",
      mode: "off",
      metrics: { score: 38.2, costPerTask: null, durationSeconds: null },
    })
  })

  it("rejects a duplicate run or an empty replacement leaderboard", () => {
    expect(() => parseClutterBench({ ...data, board: [sonnet, sonnet] }, "raw")).toThrow()
    expect(() => parseClutterBench({ ...data, board: [] }, "raw")).toThrow()
  })
})
