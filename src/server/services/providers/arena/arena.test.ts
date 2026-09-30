import { describe, expect, it, vi, afterEach } from "vitest"
import board from "./fixtures/leaderboard.json"
import { ArenaProvider, arenaEffort, parseArenaPage } from "./arena"

function html(leaderboard: unknown = board) {
  const record = `1c:${JSON.stringify(["$", "$L3a", null, { leaderboard }])}\n`
  const chunks = [record.slice(0, 160), record.slice(160)]
  return chunks
    .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
    .join("")
}
afterEach(() => vi.unstubAllGlobals())
describe("Arena first-party leaderboard", () => {
  it("joins streamed chunks, retains native ratings, intervals and snapshot settings", () => {
    const provider = new ArenaProvider()
    const payload = parseArenaPage(html())
    expect(payload.rows).toHaveLength(board.entries.length)
    const [row] = provider.toMetricRows(payload)
    expect(row.metrics.score).toBe(board.entries[0].rating)
    expect(row.measurements?.score).toMatchObject({
      updatedAt: board.voteCutoffISOString,
      preliminary: true,
      interval: { low: board.entries[0].ratingLower, high: board.entries[0].ratingUpper },
    })
    expect(row.metrics.costPerTask).toBeUndefined()
  })
  it("fails refresh rather than accidentally import another category or adjustment", () => {
    expect(() =>
      parseArenaPage(html({ ...board, params: { ...board.params, category: "coding" } })),
    ).toThrow()
    expect(() =>
      parseArenaPage(html({ ...board, params: { ...board.params, factuality: true } })),
    ).toThrow()
    expect(() => parseArenaPage("<html>Challenge page</html>")).toThrow("not found")
  })
  it("does not drop a scored model for an absent organization and records malformed rows", () => {
    const payload = parseArenaPage(
      html({
        ...board,
        entries: [
          { ...board.entries[0], modelOrganization: "" },
          { ...board.entries[1], rating: "bad" },
        ],
      }),
    )
    expect(payload.rows[0].modelOrganization).toBeNull()
    expect(payload.dropped).toHaveLength(1)
  })
  it("preserves model-name max and budget/date variants rather than borrowing another effort", () => {
    for (const [id, sourceModelId, mode, level] of [
      ["muse-spark-1.2 (xHigh)", "muse-spark-1.2", "on", "xhigh"],
      ["muse-spark-1.3-max", "muse-spark-1.3", "on", "max"],
      ["gemini-3-flash (thinking-minimal)", "gemini-3-flash", "on", "minimal"],
      ["mimo-v2-flash (non-thinking)", "mimo-v2-flash", "off", "unknown"],
      ["mimo-v2-flash (thinking)", "mimo-v2-flash", "on", "unknown"],
      ["qwen3-235b-a22b-no-thinking", "qwen3-235b-a22b", "off", "unknown"],
    ])
      expect(arenaEffort(id), id).toEqual({ sourceModelId, mode, level })
    expect(arenaEffort("qwen3.8-max")).toMatchObject({
      sourceModelId: "qwen3.8-max",
      level: "unknown",
    })
    expect(arenaEffort("gpt-5.4-high")).toMatchObject({
      sourceModelId: "gpt-5.4",
      mode: "on",
      level: "high",
    })
    expect(arenaEffort("claude-opus-4-5-20251101-high-32k").sourceModelId).toContain("high-32k")
    const provider = new ArenaProvider()
    const [raw] = parseArenaPage(html()).rows
    const rows = provider.toMetricRows({
      rows: [
        { ...raw, modelDisplayName: "qwen3.8-max" },
        { ...raw, modelDisplayName: "gpt-5.4-high" },
      ],
      dropped: [],
    })
    expect(rows[0].configurationKnown).toBe(false)
    expect(rows[1].configurationKnown).toBeUndefined()
  })
  it("rejects a broken interval and reports upstream HTTP failures", async () => {
    const provider = new ArenaProvider()
    const [row] = parseArenaPage(html()).rows
    expect(provider.readMetrics({ ...row, ratingLower: row.rating + 1 }).score).toBeNull()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("blocked", { status: 503 })),
    )
    await expect(provider.fetchPayload()).rejects.toThrow("503")
  })
})
