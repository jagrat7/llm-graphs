import { describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { coversText } from "#/ui/lib/chart-image"
import { plotCsv, shareFilename, shareSubtitle, shareTitle } from "#/ui/lib/chart-share"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"

const info = ProvidersService.info()

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerTask = 10,
  tokensPerSecond = null,
  displayName = model[0].toUpperCase() + model.slice(1),
  configuration,
}: Partial<Model> & { model: string }): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName,
    vendor: "openai",
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: effort === "default" ? "unknown" : "on",
    level: effort === "default" ? "unknown" : effort,
    effort,
    effortOrder,
    score,
    costPerTask,
    tokensPerSecond,
    configuration,
    sources: metricRecord<Model["sources"]["score"]>(() => null),
  }
}

const models = [
  makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 60, costPerTask: 6 }),
  makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40.25, costPerTask: 2 }),
  makeModel({ model: "beta", displayName: 'Beta "Pro", v2', score: 52, costPerTask: 12 }),
]

describe("chart share text", () => {
  it("titles the comparison vertical metric first", () => {
    expect(shareTitle(buildPlotData(models, { x: "cost", y: "score" }))).toBe("Score vs Task cost")
    expect(
      shareTitle(
        buildPlotData(
          models.map((model) => ({ ...model, tokensPerSecond: 80 })),
          { x: "cost", y: "score", z: "speed" },
        ),
      ),
    ).toBe("Score vs Task cost vs Output speed")
  })

  it("names each source once beside the model count", () => {
    const data = buildPlotData(models, { x: "cost", y: "score" })

    expect(shareSubtitle(data, { x: "deepswe", y: "deepswe" }, info)).toBe(
      `2 models · Sources: ${info.displayNames.deepswe}`,
    )
    expect(shareSubtitle(data, {}, info)).toBe("2 models")
  })

  it("names files after the metrics compared", () => {
    const data = buildPlotData(
      models.map((model) => ({ ...model, outputPricePerMTokens: 4 })),
      { x: "outputPrice", y: "score" },
    )

    expect(shareFilename(data, "png")).toBe("llm-graphs-score-vs-output-price.png")
    expect(shareFilename(data, "csv")).toBe("llm-graphs-score-vs-output-price.csv")
  })
})

describe("plot CSV", () => {
  it("writes raw values per effort, grouped by model in effort order", () => {
    const csv = plotCsv(
      buildPlotData(models, { x: "cost", y: "score" }),
      { x: "deepswe", y: "deepswe" },
      info,
    )
    const [header, ...rows] = csv.split("\r\n")

    expect(header).toBe(
      `Model,Vendor,Effort,Task cost ($/task) [${info.displayNames.deepswe}],Score (%) [${info.displayNames.deepswe}]`,
    )
    expect(rows).toEqual([
      "Alpha,OpenAI,low,2,40.25",
      "Alpha,OpenAI,high,6,60",
      '"Beta ""Pro"", v2",OpenAI,default,12,52',
    ])
  })

  it("adds a configuration column only when a point has one", () => {
    const configured = [...models, makeModel({ model: "gamma", configuration: "agent" })]
    const csv = plotCsv(buildPlotData(configured, { x: "cost", y: "score" }), {}, info)

    expect(csv.split("\r\n")[0]).toBe(
      "Model,Vendor,Effort,Configuration,Task cost ($/task),Score (%)",
    )
    expect(csv).toContain("Gamma,OpenAI,default,agent,10,50")
  })

  it("keeps a name that starts like a formula from running as one", () => {
    const csv = plotCsv(
      buildPlotData([makeModel({ model: "x", displayName: "=HYPERLINK(1)" })], {
        x: "cost",
        y: "score",
      }),
      {},
      info,
    )

    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1),OpenAI,default,10,50")
  })
})

describe("font subsetting", () => {
  it("matches unicode ranges, wildcards and open ranges", () => {
    const latin = "U+0000-00FF, U+0131, U+2000-206F"

    expect(coversText(latin, ["A".codePointAt(0)!])).toBe(true)
    expect(coversText(latin, ["·".codePointAt(0)!])).toBe(true)
    expect(coversText(latin, ["Ж".codePointAt(0)!])).toBe(false)
    expect(coversText("U+04??", ["Ж".codePointAt(0)!])).toBe(true)
    expect(coversText("", ["Ж".codePointAt(0)!])).toBe(true)
  })
})
