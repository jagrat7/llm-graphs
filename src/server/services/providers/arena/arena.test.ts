import { readFile } from "node:fs/promises"
import { describe, expect, it, vi, afterEach } from "vitest"
import { ArenaProvider, arenaEffort, parseArenaRecords } from "./arena"

function record(overrides: Record<string, unknown> = {}) {
  return {
    model_name: "Claude Opus 5.5 (High)",
    organization: "anthropic",
    rating: 1500,
    rating_lower: 1490,
    rating_upper: 1510,
    vote_count: 10322,
    rank: 2n,
    category: "overall",
    leaderboard_publish_date: "2026-10-22",
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("Arena official dataset", () => {
  it("retains ratings, intervals, votes and publication date for the overall board", () => {
    const provider = new ArenaProvider()
    const payload = parseArenaRecords([record(), record({ category: "coding", rating: "bad" })])
    expect(payload.rows).toHaveLength(1)
    expect(payload.dropped).toEqual([])
    const [row] = provider.toMetricRows(payload)
    expect(row.metrics).toEqual({ score: 1500, votes: 10322 })
    expect(row.measurements?.score).toEqual({
      label: "Arena Text · overall · style control",
      updatedAt: "2026-10-22",
      detail: "10,322 votes · rank 2",
      interval: { low: 1490, high: 1510 },
    })
    expect(row.metadata).toEqual({
      name: "Claude Opus 5.5 (High)",
      creator: "anthropic",
      releaseDate: null,
    })
    expect(payload.rows[0].rank).toBe(2)
    expect(parseArenaRecords([record({ rank: 3 })]).rows[0].rank).toBe(3)
    expect(provider.readMetrics({ ...payload.rows[0], ratingLower: 1501 }).score).toBeNull()
  })

  it("keeps absent organizations and records malformed overall rows", () => {
    const payload = parseArenaRecords([
      record({ organization: " " }),
      record({ organization: null }),
      record({ model_name: "invalid rating", rating: "bad" }),
      record({ model_name: "fractional votes", vote_count: 0.5 }),
      record({ model_name: "unsafe rank", rank: 9007199254740993n }),
      record({ model_name: "invalid date", leaderboard_publish_date: "2026-02-30" }),
    ])
    expect(payload.rows.map((row) => row.organization)).toEqual([null, null])
    expect(payload.dropped.map((row) => row.id)).toEqual([
      "invalid rating",
      "fractional votes",
      "unsafe rank",
      "invalid date",
    ])
  })

  it("rejects an empty, invalid or mixed-date overall snapshot", () => {
    for (const records of [[], [record({ category: "coding" })], [record({ rating: null })]])
      expect(() => parseArenaRecords(records)).toThrow("Arena returned no parseable rows")
    expect(() =>
      parseArenaRecords([record(), record({ leaderboard_publish_date: "2026-10-21" })]),
    ).toThrow("Arena latest split mixes publish dates")
  })

  it("decodes the official parquet through fetch and preserves the leading configuration", async () => {
    const bytes = await readFile(new URL("./fixtures/latest.parquet", import.meta.url))
    const fetch = vi.fn(async () => new Response(bytes))
    vi.stubGlobal("fetch", fetch)
    const provider = new ArenaProvider()
    const payload = await provider.fetchPayload()
    provider.validatePayload(payload)
    expect(payload.rows).toHaveLength(418)
    expect(payload.dropped).toEqual([])
    expect(payload.rows.find((row) => row.rank === 1)).toMatchObject({
      modelName: "Gemini 4 Argon (High)",
      rating: 1517.1715740590357,
      votes: 10083,
      publishDate: "2026-10-22",
    })
    expect(
      provider.toMetricRows(payload).find((row) => row.rawId === "Gemini 4 Argon (High)"),
    ).toMatchObject({
      sourceModelId: "Gemini 4 Argon",
      mode: "on",
      level: "high",
      metrics: { score: 1517.1715740590357, votes: 10083 },
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text_style_control/latest-00000-of-00001.parquet",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(provider.href).toBe("https://arena.ai/leaderboard/text")
    expect(provider.cacheKey).toBe("llm-scores:source:arena:text-overall-style-control:v5")
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
    const [raw] = parseArenaRecords([record()]).rows
    const rows = provider.toMetricRows({
      rows: [
        { ...raw, modelName: "qwen3.8-max" },
        { ...raw, modelName: "gpt-5.4-high" },
      ],
      dropped: [],
    })
    expect(rows[0].configurationKnown).toBe(false)
    expect(rows[1].configurationKnown).toBeUndefined()
  })

  it("reports upstream HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    )
    await expect(new ArenaProvider().fetchPayload()).rejects.toThrow("Arena Text returned 503")
  })

  it.each(["<html>Challenge page</html>", "PAR1truncated"])(
    "reports unreadable parquet responses: %s",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(body)),
      )
      await expect(new ArenaProvider().fetchPayload()).rejects.toThrow(
        "Arena Text returned an unreadable parquet file",
      )
    },
  )
})
