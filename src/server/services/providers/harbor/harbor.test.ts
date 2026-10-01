import { expect, it } from "vitest"
import terminalFixture from "../../model-aggregator/fixtures/terminal-bench.json"
import scienceFixture from "../../model-aggregator/fixtures/terminal-bench-science.json"
import { TerminalBenchProvider } from "../terminal-bench/terminal-bench"
import { TerminalBenchScienceProvider } from "../terminal-bench-science/terminal-bench-science"

it("uses actual trial counts and preserves CI versus standard-error semantics", () => {
  const terminal = new TerminalBenchProvider()
  const science = new TerminalBenchScienceProvider()
  const row = terminalFixture.payload.rows[0]
  const scientific = scienceFixture.payload.rows[0]
  expect(terminal.readMetrics(row)).toEqual({
    score: 58.18,
    costPerTask: 3267.18 / 330,
    durationSeconds: 2796.3,
  })
  expect(science.readMetrics(scientific).costPerTask).toBeCloseTo(23.7974342)
  expect(
    terminal.toMetricRows({ rows: [row], dropped: [] })[0]?.measurements?.score?.detail,
  ).toContain("95% confidence")
  const measurement = science.toMetricRows({ rows: [scientific], dropped: [] })[0]?.measurements
    ?.score
  expect(measurement?.interval).toBeUndefined()
  expect(measurement?.detail).toContain("standard error")
  for (const bad of [
    { ...row, n_trials: row.n_trials - 1 },
    { ...row, metrics: { ...row.metrics, display_cost: "$3k (partial: 324/330 trials)" } },
    { ...row, metrics: { ...row.metrics, total_cost_usd: null } },
  ]) {
    expect(terminal.readMetrics(bad)).toMatchObject({
      score: 58.18,
      costPerTask: null,
      durationSeconds: 2796.3,
    })
  }
  expect(
    terminal.readMetrics({ ...row, metrics: { ...row.metrics, total_cost_usd: 0 } }).costPerTask,
  ).toBe(0)
})

it("refuses another benchmark/dataset and excludes hidden results", () => {
  const provider = new TerminalBenchProvider()
  const row = terminalFixture.payload.rows[0]
  const leaderboard = {
    id: row.leaderboard_id,
    package: "terminal-bench/terminal-bench",
    name: "4-0-0",
    dataset_version_ids: ["1922072f-a433-429a-8929-350d5e1bcf02"],
  }
  const root = { leaderboard, rows: [row, { ...row, id: "hidden", status: "hidden" }] }
  expect(provider.parsePayload(root).rows).toHaveLength(1)
  expect(() =>
    provider.parsePayload({ ...root, leaderboard: { ...leaderboard, name: "3-0-0" } }),
  ).toThrow()
  expect(() =>
    provider.parsePayload({
      ...root,
      leaderboard: { ...leaderboard, dataset_version_ids: ["changed"] },
    }),
  ).toThrow(/dataset changed/)
})
