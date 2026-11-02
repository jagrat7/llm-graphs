import { expect, it } from "vitest"
import { ReactBenchProvider, parseReactBenchPage } from "./react-bench"

function run(model: string, effort: string, passRate: number, extra: object = {}) {
  return {
    id: `${model}:${effort}`,
    model,
    effort,
    passRate,
    ciLo: Math.max(0, passRate - 0.05),
    ciHi: Math.min(1, passRate + 0.05),
    avgOutTokens: 131659.4,
    avgCost: 5.6429,
    trials: 195,
    scored: 195,
    testsOnly: { passRate: 0.8308, ciLo: 0.8, ciHi: 0.86 },
    ...extra,
  }
}

const SOURCE = {
  tasks: 39,
  modelFamilies: 31,
  configurations: 95,
  trials: 18525,
  repositories: 37,
  writeTasks: 28,
  fixTasks: 11,
  maxTasksPerRepository: 2,
}

/** The page's flight data, split across script chunks the way Next.js streams it. */
function page(leaderboard: Array<unknown>, version = "v1.2") {
  const value = {
    "v1.1": { source: SOURCE, leaderboard: [] },
    [version]: { source: SOURCE, leaderboard },
  }
  const flight = `2c:"BenchmarkChartDataProvider"\n18:${JSON.stringify(["$", "$L2d", null, { value }])}\n`
  const half = Math.floor(flight.length / 2)
  return [flight.slice(0, half), flight.slice(half)]
    .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
    .join("")
}

it("reads pass@1, its interval and rollout cost per model and effort", () => {
  const payload = parseReactBenchPage(
    page([
      run("claude-opus-5-5", "max", 0.5436),
      run("moonshotai/kimi-k3", "", 0.3333),
      run("cursor-grok-4.5", "high", 0.3, { hasEstimatedUsage: true }),
      run("gpt-5.6-sol", "max", 1.4),
    ]),
  )
  expect(payload.rows.map((row) => row.id)).toEqual([
    "claude-opus-5-5:max",
    "moonshotai/kimi-k3:",
    "cursor-grok-4.5:high",
  ])
  expect(payload.dropped.map((row) => row.id)).toEqual(["gpt-5.6-sol:max"])
  const rows = new ReactBenchProvider().toMetricRows(payload)
  expect(rows[0]).toMatchObject({
    sourceModelId: "claude-opus-5-5",
    rawId: "claude-opus-5-5:max",
    mode: "on",
    level: "max",
    metrics: { score: 54.36, costPerTask: 5.6429 },
    metadata: { creator: "Anthropic" },
  })
  expect(rows[0]).not.toHaveProperty("configurationKnown")
  expect(rows[0]?.measurements?.score?.interval?.low).toBeCloseTo(49.36)
  expect(rows[0]?.measurements?.score?.detail).toContain("39 tasks (28 writing, 11 fixing)")
  expect(rows[0]?.measurements?.score?.detail).toContain("Tests-only pass rate: 83.1%")
  expect(rows[1]).toMatchObject({
    sourceModelId: "moonshotai/kimi-k3",
    mode: "unknown",
    level: "unknown",
    configurationKnown: false,
    metadata: { creator: "Moonshot AI" },
  })
  expect(rows[1]?.measurements?.score?.detail).toContain("Reasoning effort not reported")
  // Cursor's prefix comes off so the run joins Grok; its estimated cost stays unavailable.
  expect(rows[2]).toMatchObject({
    sourceModelId: "grok-4.5",
    metrics: { costPerTask: null },
    metadata: { creator: "xAI" },
  })
  expect(rows[2]?.measurements?.costPerTask?.detail).toContain("Run through Cursor")
  expect(rows[2]?.measurements?.costPerTask?.detail).toContain("estimated")
})

it("refuses a page without the pinned version or with a duplicate run identity", () => {
  expect(() => parseReactBenchPage(page([run("claude-opus-5-5", "max", 0.5)], "v1.3"))).toThrow(
    /v1\.2 leaderboard missing/,
  )
  expect(() =>
    parseReactBenchPage(
      page([run("claude-opus-5-5", "max", 0.5), run("claude-opus-5-5", "max", 0.4)]),
    ),
  ).toThrow(/duplicate/)
})

it("reads around an unreadable chunk but never a damaged leaderboard", () => {
  const html = page([run("claude-opus-5-5", "max", 0.5)])
  for (const broken of [
    `<script>self.__next_f.push([1,"oops)</script>`,
    // No closing parenthesis: the match must still stop at this script's own end tag.
    `<script>self.__next_f.push(oops</script>`,
  ])
    expect(parseReactBenchPage(broken + html).rows).toHaveLength(1)
  const chunks = html.split("</script>")
  expect(() =>
    parseReactBenchPage(`${chunks[0].slice(0, -40)}</script>${chunks[1]}</script>`),
  ).toThrow(/leaderboard missing/)
})

it("drops rows without an id instead of refusing the refresh", () => {
  const { id: _first, ...first } = run("claude-opus-5-5", "max", 0.5)
  const { id: _second, ...second } = run("claude-opus-5-5", "high", 0.4)
  const payload = parseReactBenchPage(page([first, second, run("gpt-5.6-sol", "max", 0.47)]))
  expect(payload.rows.map((row) => row.id)).toEqual(["gpt-5.6-sol:max"])
  expect(payload.dropped).toHaveLength(2)
})
