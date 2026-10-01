import { expect, it } from "vitest"
import { CursorBenchProvider, parseCursorBenchPage } from "./cursor-bench"

function row(name: string, score: string, cost: string, tokens = "218,363", steps = "185") {
  return `<tr>${["1", `<span>${name}</span>`, score, cost, tokens, steps].map((value) => `<td>${value}</td>`).join("")}</tr>`
}

it("pins the coding revision, preserves effort/cost pairs and refuses changed table meaning", () => {
  const headers = ["", "Model", "Score", "Cost / task", "Tokens / task", "Steps / task"]
    .map((value) => `<th><span>${value}</span></th>`)
    .join("")
  const page = (rows: string) =>
    `<h1>CursorBench 4.0</h1><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
  const html = page(
    row("Opus 5.5 Extra High", "56<!-- -->%", "$<!-- -->6.98") +
      row("Sonnet 5.5 Max", "55.5%", "$9.67") +
      row("GPT-5.6 Sol None", "0%", "$0") +
      row("Composer 2.5", "27.7%", "—", "—", "—") +
      row("Malformed", "101%", "$1"),
  )
  const payload = parseCursorBenchPage(html)
  expect(payload.rows).toHaveLength(4)
  expect(payload.dropped).toHaveLength(1)
  const rows = new CursorBenchProvider().toMetricRows(payload)
  expect(rows[0]).toMatchObject({
    sourceModelId: "claude-opus-5-5",
    mode: "on",
    level: "xhigh",
    metrics: { score: 56, costPerTask: 6.98 },
  })
  expect(rows[1]).toMatchObject({
    sourceModelId: "claude-sonnet-5-5",
    level: "max",
    metrics: { costPerTask: 9.67 },
  })
  expect(rows[0]?.configuration).toBe("Cursor agent · CursorBench 4.0")
  expect(rows[0]?.measurements?.score?.detail).toContain("output tokens/task: 218,363")
  expect(rows[0]?.measurements?.costPerTask?.detail).toContain("cache-write")
  expect(rows[2]).toMatchObject({
    sourceModelId: "gpt-5-6-sol",
    mode: "off",
    level: "unknown",
    metrics: { score: 0, costPerTask: 0 },
  })
  expect(rows[3]).toMatchObject({
    mode: "unknown",
    level: "unknown",
    configurationKnown: false,
    metrics: { costPerTask: null },
  })
  expect(() => parseCursorBenchPage(html.replace("4.0", "3.2"))).toThrow(/version/)
  expect(() => parseCursorBenchPage(html.replace("Cost / task", "Cost / evaluation"))).toThrow(
    /columns/,
  )
  expect(() =>
    parseCursorBenchPage(page(row("Opus 5.5 Max", "57.8%", "$13.43").repeat(2))),
  ).toThrow(/duplicate/)
  expect(() =>
    parseCursorBenchPage(
      page(row("Opus 5.5 Max", "57.8%", "$13.43") + row("Opus 5.5 Max", "101%", "$13.43")),
    ),
  ).toThrow(/duplicate/)
})
