import { describe, expect, it, vi, afterEach } from "vitest"
import { stringify } from "yaml"
import fixture from "../../model-aggregator/fixtures/metr.json"
import { METRProvider, metrModelId } from "./metr"

afterEach(() => vi.unstubAllGlobals())
describe("METR Time Horizon", () => {
  it("uses native hours, preserves uncertainty/scaffolds, and never invents effort or runtime", () => {
    const provider = new METRProvider()
    const measured = fixture.payload.rows.find((row) => row.id === "gpt_5_4")!
    const [row] = provider.toMetricRows({ rows: [measured], dropped: [] })
    expect(row.metrics.score).toBeCloseTo(341.735147 / 60, 2)
    expect(row.mode).toBe("unknown")
    expect(row.level).toBe("unknown")
    expect(row.configurationKnown).toBe(false)
    expect(row.measurements?.score?.interval?.low).toBe(measured.p50.ci_low / 60)
    expect(row.measurements?.score?.detail).toContain(measured.scaffolds[0])
    expect(row.metrics.durationSeconds).toBeUndefined()
    expect(row.metrics.costPerTask).toBeUndefined()
  })
  it("does not present unreliable extrapolations above 16 hours or invalid bounds as measured capability", () => {
    const provider = new METRProvider()
    const row = fixture.payload.rows[0]
    expect(
      provider.readMetrics({ ...row, p50: { estimate: 961, ci_low: 950, ci_high: 1200 } }).score,
    ).toBeNull()
    expect(
      provider.readMetrics({ ...row, p50: { estimate: 12, ci_low: 20, ci_high: 25 } }).score,
    ).toBeNull()
  })
  it("accepts legacy unspecified scaffolds but refuses a different suite", async () => {
    const result = {
      benchmark_name: "METR-Horizon-v1.1",
      results: {
        gpt_4: {
          release_date: "2023-03-14",
          scaffolds: ["modular-public", null],
          metrics: { p50_horizon_length: { estimate: 12, ci_low: 5, ci_high: 30 } },
        },
      },
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stringify(result))),
    )
    const payload = await new METRProvider().fetchPayload()
    expect(payload.dropped).toEqual([])
    expect(payload.rows[0].scaffolds).toContain("unspecified scaffold")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stringify({ ...result, benchmark_name: "Other suite" }))),
    )
    await expect(new METRProvider().fetchPayload()).rejects.toThrow()
  })
  it("normalizes only published harness markers and Claude naming order", () => {
    expect(metrModelId("claude_4_1_opus_inspect")).toBe("claude-opus-4-1")
    expect(metrModelId("gpt_5_1_codex_max_inspect")).toBe("gpt-5-1-codex-max")
    expect(metrModelId("claude_3_5_sonnet_20240620_inspect")).toBe("claude-sonnet-3-5-20240620")
  })
})
