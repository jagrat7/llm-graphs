import { expect, it } from "vitest"
import { SWEBenchProvider, parseSWEBenchFeed } from "./swe-bench"

function run() {
  return {
    folder: "20260217_mini-v2.0.0_gpt-5-2-high",
    name: "GPT 5.2 (high)",
    model_display: "GPT 5.2",
    model_org: "OpenAI",
    date: "2026-02-17",
    agent: "mini-SWE-agent",
    checked: true,
    "mini-swe-agent_version": "2.0.0",
    tags: ["Model: gpt-5-2", "System: Attempts - 1"],
    reasoning_effort: "high",
    resolved: 72.8,
    instance_cost: 0.5,
    cost: 250,
    per_instance_details: Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [`issue-${i}`, { cost: 0.5 }]),
    ),
  }
}
function feed(rows: unknown[]) {
  return { leaderboards: [{ name: "Verified", results: rows }] }
}

it("pairs published score and fully covered cost in one pinned agent run", () => {
  const provider = new SWEBenchProvider()
  const payload = parseSWEBenchFeed(
    feed([
      run(),
      { ...run(), folder: "other", "mini-swe-agent_version": "1.17.2" },
      { ...run(), folder: "other-agent", agent: "Other" },
    ]),
  )
  expect(payload.rows).toHaveLength(1)
  expect(provider.toMetricRows(payload)[0]).toMatchObject({
    sourceModelId: "gpt-5-2",
    mode: "on",
    level: "high",
    metrics: { score: 72.8, costPerTask: 0.5 },
  })
  // The agent is the harness, so a lone run of a model and effort carries no configuration.
  expect(provider.toMetricRows(payload)[0]?.configuration).toBeUndefined()
  expect(payload.rows[0]).not.toHaveProperty("per_instance_details")
})

it("names a rerun of one model and effort by its folder so neither is folded away", () => {
  const rows = new SWEBenchProvider().toMetricRows(
    parseSWEBenchFeed(feed([run(), { ...run(), folder: "20260301_mini-v2.0.0_gpt-5-2-high" }])),
  )
  expect(rows.map((row) => row.configuration)).toEqual([
    "20260217_mini-v2.0.0_gpt-5-2-high",
    "20260301_mini-v2.0.0_gpt-5-2-high",
  ])
})

it("keeps score while refusing incomplete, inconsistent, zero or warned spending", () => {
  const provider = new SWEBenchProvider()
  const row = run()
  for (const change of [
    { per_instance_details: {} },
    { per_instance_details: { ...row.per_instance_details, "issue-0": { cost: -1 } } },
    { cost: 251 },
    { instance_cost: 0.7 },
    { instance_cost: 0 },
    { warning: "Incomplete run" },
  ]) {
    const [result] = provider.toMetricRows(parseSWEBenchFeed(feed([{ ...row, ...change }])))
    expect(result.metrics).toEqual({ score: 72.8, costPerTask: null })
  }
})

it("keeps unknown effort unreported and records malformed scores", () => {
  const provider = new SWEBenchProvider()
  const payload = parseSWEBenchFeed(
    feed([
      { ...run(), reasoning_effort: null },
      { ...run(), folder: "bad", resolved: 101 },
    ]),
  )
  expect(provider.toMetricRows(payload)[0]).toMatchObject({
    mode: "unknown",
    level: "unknown",
    configurationKnown: false,
  })
  expect(payload.dropped[0].id).toBe("bad")
})

it("rejects ambiguous run identity even when one duplicate has malformed measurements", () => {
  expect(() => parseSWEBenchFeed(feed([run(), { ...run(), resolved: "n/a" }]))).toThrow(/duplicate/)
  expect(() => parseSWEBenchFeed({ leaderboards: [] })).toThrow(/missing/)
  expect(() =>
    parseSWEBenchFeed({
      leaderboards: [feed([run()]).leaderboards[0], feed([run()]).leaderboards[0]],
    }),
  ).toThrow(/duplicated/)
  expect(() => parseSWEBenchFeed(feed([{ ...run(), "mini-swe-agent_version": "3.0.0" }]))).toThrow(
    /no parseable/,
  )
})
