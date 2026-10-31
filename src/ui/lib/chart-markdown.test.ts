import { describe, expect, it } from "vitest"
import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { allFixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { chartMarkdown, prefersMarkdown } from "./chart-markdown"
import { defaultPicks, offeredVariants } from "./model-view"
import { axisBindings, axisSettings, scoreSourceOf } from "./graph-state"
import { isMetric, type Metric } from "./metrics"

describe("prefersMarkdown", () => {
  it.each([
    ["Claude Code", "text/markdown, text/html, */*", true],
    [
      "Cursor",
      "text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.8,application/xml;q=0.7,image/webp;q=0.6,*/*;q=0.5",
      true,
    ],
    ["Cursor, later", "text/markdown, text/plain;q=0.9, */*;q=0.8", true],
    [
      "OpenCode",
      "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
      true,
    ],
    [
      "Codex",
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      false,
    ],
    ["Gemini CLI", "*/*", false],
    ["a browser", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["HTML ranked above markdown", "text/html, text/markdown;q=0.5", false],
    ["markdown refused", "text/markdown;q=0", false],
    ["no header", null, false],
  ])("%s", (_agent, accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected)
  })
})

const thisLink = (text: string) =>
  text.slice(text.indexOf("## This link"), text.indexOf("## Building"))

describe("chartMarkdown", () => {
  const info = ProvidersService.info()
  const { snapshot } = aggregateModels(allFixtureInputs())
  const origin = "https://llm-graphs.example"
  /** Parses the way the route does: an unknown metric falls back to the axis's default. */
  const describeLink = (query: string) => {
    const params = new URLSearchParams(query)
    const metric = (axis: "x" | "y", fallback: Metric) => {
      const value = params.get(axis)
      return value != null && isMetric(value) ? value : fallback
    }
    const search = {
      x: metric("x", "cost"),
      y: metric("y", "score"),
      xSource: params.get("xSource") ?? undefined,
      ySource: params.get("ySource") ?? undefined,
      ...(params.has("models") ? { models: params.getAll("models") } : {}),
    }

    return chartMarkdown(info, snapshot, search, params, origin)
  }

  it("names each axis's metric and source, then the default picks, before the guide", () => {
    const text = describeLink("x=cost&y=score&ySource=sweBench")
    const section = thisLink(text)

    expect(section).toContain(
      "Vertical axis, `y=score`: Issues resolved (%) from SWE-bench Verified (`ySource=sweBench`)",
    )
    expect(section).toContain(
      "Horizontal axis, `x=cost`: Task cost ($/task) from SWE-bench Verified, the Score axis's benchmark",
    )
    expect(section).toContain("the site's default picks since the link names none")
    expect(section).toContain("The chart compares these models.")
    const search = { x: "cost", y: "score", ySource: "sweBench" } as const
    const axes = axisSettings(search, info)
    const bindings = axisBindings(axes, info)
    const picks = defaultPicks(
      snapshot,
      offeredVariants(snapshot, bindings),
      scoreSourceOf(axes),
      info,
      bindings.map((b) => b.metric),
    )
    for (const id of picks) expect(section).toContain(`\`${id}\``)
    expect(text).toContain("## Building a chart link")
  })

  it("says which parts of the link the chart ignored", () => {
    const section = thisLink(
      describeLink("x=cost&xSource=arena&y=bogus&ySource=swe-bench&models=no-such-model"),
    )

    expect(section).toContain("`y=bogus` isn't a metric, so the chart uses `score`.")
    expect(section).toContain(
      "`ySource=swe-bench` isn't a source of `score`, so the chart reads DeepSWE instead.",
    )
    expect(section).toContain("`xSource` is ignored: cost always reads the Score axis's benchmark.")
    expect(section).toContain("Not model ids, so left out: `models=no-such-model`.")
  })

  it("says when the picks leave nothing to compare", () => {
    const [only] = snapshot.variants.sweBench
    const section = thisLink(describeLink(`x=cost&y=score&ySource=sweBench&models=${only.entryId}`))

    expect(section).toContain("The chart has nothing to compare.")
  })
})
