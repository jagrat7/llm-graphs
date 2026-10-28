import { readFile } from "node:fs/promises"
import { describe, expect, it, vi, afterEach } from "vitest"
import arenaFixture from "../../model-aggregator/fixtures/arena.json"
import { normalizeId } from "../../model-aggregator/match-key"
import { ArenaProvider, parseArenaRecords } from "./arena"

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

  it.each([
    ["Gemini 4 Argon (High)", "gemini-4-argon", "on", "high", undefined],
    ["Muse Spark 1.2 (xHigh)", "muse-spark-1-2", "on", "xhigh", undefined],
    ["Gemini 3 Flash (Minimal)", "gemini-3-flash", "on", "minimal", undefined],
    ["Qwen3.8-Max", "qwen3-8-max", "unknown", "unknown", undefined],
    ["Mistral Medium", "mistral-medium", "unknown", "unknown", undefined],
    ["MiMo-V2-Flash (Thinking)", "mimo-v2-flash", "on", "unknown", undefined],
    ["Grok 4 Fast (Non-Reasoning)", "grok-4-fast", "off", "unknown", undefined],
    ["Qwen3-Next-80B-A3B-Thinking", "qwen3-next-80b-a3b", "on", "unknown", undefined],
    ["Trinity Large Thinking", "trinity-large", "on", "unknown", undefined],
    ["Claude 3.5 Sonnet (20241022)", "claude-3-5-sonnet-20241022", "unknown", "unknown", undefined],
    ["DeepSeek-V3 (0324)", "deepseek-v3-0324", "unknown", "unknown", undefined],
    ["Command A (03-2025)", "command-a-03-2025", "unknown", "unknown", undefined],
    ["Qwen3-Max (2025-09-23)", "qwen3-max-2025-09-23", "unknown", "unknown", undefined],
    [
      "Phi-3 Mini 4K Instruct (June 2024)",
      "phi-3-mini-4k-instruct-june-2024",
      "unknown",
      "unknown",
      undefined,
    ],
    ["Command R+ (08-2024)", "command-r-plus-08-2024", "unknown", "unknown", undefined],
    [
      "Reka Flash 21B (Online, 20240226)",
      "reka-flash-21b-online-20240226",
      "unknown",
      "unknown",
      undefined,
    ],
    ["Grok 4.20 Beta (Reasoning, 0309)", "grok-4-20-beta-0309", "on", "unknown", undefined],
    [
      "Gemini 2.5 Flash-Lite Preview (Non-Thinking, 09-2025)",
      "gemini-2-5-flash-lite-preview-09-2025",
      "off",
      "unknown",
      undefined,
    ],
    [
      "Claude Sonnet 4 (Thinking 32K, 20250514)",
      "claude-sonnet-4-20250514",
      "on",
      "unknown",
      "32K thinking budget",
    ],
    [
      "Claude Opus 4.5 (High, 32K, 20251101)",
      "claude-opus-4-5-20251101",
      "on",
      "high",
      "32K thinking budget",
    ],
  ])("reads the published name %s as %s %s/%s", (name, id, mode, level, configuration) => {
    const published = arenaFixture.payload.rows.filter((row) => row.modelName === name)
    expect(published).toHaveLength(1)
    const [row] = new ArenaProvider().toMetricRows({ rows: published, dropped: [] })
    expect(normalizeId(row.sourceModelId)).toBe(id)
    expect(row).toMatchObject({ mode, level, rawId: name, metadata: { name } })
    expect(row.configuration).toBe(configuration)
    expect(row.configurationKnown).toBe(
      mode === "unknown" || level === "unknown" ? false : undefined,
    )
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
