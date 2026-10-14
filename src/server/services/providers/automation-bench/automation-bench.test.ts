import { expect, it } from "vitest"
import { AutomationBenchProvider, parseAutomationModule } from "./automation-bench"

it("keeps effort/fallback configurations and declines incomparable costs", () => {
  const script =
    "version=`1.0.6`,table=[[1,`Claude Sonnet 5.5 (default fallbacks, Max)`,`44.75%`,`$1.14`],[2,`Claude Sonnet 5.5 (default fallbacks, Between tools)`,`18.57%`,`$0.30`],[3,`Claude Fable 5.1 (with Opus 5 Fallback)`,`31.4%`,`$2.45`],[4,`Gemma 4 31B (Max)`,`1.7%`,`$0.09†`],[5,`Gemini 3.1 Pro (preview) (High)`,`8.68%`,`$0.30*`],[6,`GPT 6 Luna (None)`,`0.3%`,`$0.01`],[7,`Unspecified`,`0.0%`,`—`]]"
  const payload = parseAutomationModule(script)
  const rows = new AutomationBenchProvider().toMetricRows(payload)
  expect(rows[0]).toMatchObject({
    sourceModelId: "claude-sonnet-5-5",
    mode: "on",
    level: "max",
    metrics: { score: 44.75, costPerTask: 1.14 },
  })
  expect(rows[0]?.configuration).toContain("default fallbacks")
  expect(rows[1]?.configuration).toContain("between tools reasoning")
  expect(rows[2]?.sourceModelId).toContain("with-opus-5-fallback")
  expect(rows[2]?.metrics.costPerTask).toBeNull()
  expect(rows[3]?.metrics.costPerTask).toBeNull()
  expect(rows[4]).toMatchObject({
    sourceModelId: "gemini-3-1-pro-(preview)",
    level: "high",
    metrics: { costPerTask: 0.3 },
  })
  expect(rows[4]?.measurements?.costPerTask?.detail).toContain("Standard list pricing")
  expect(rows[5]).toMatchObject({ mode: "off", level: "unknown" })
  expect(rows[6]).toMatchObject({
    mode: "unknown",
    level: "unknown",
    metrics: { score: 0, costPerTask: null },
  })
  expect(() => parseAutomationModule(script.replace("1.0.6", "2.0.0"))).toThrow(/version/)
  expect(() => parseAutomationModule("globalThis.sideEffect = true")).toThrow(/schema/)
})
