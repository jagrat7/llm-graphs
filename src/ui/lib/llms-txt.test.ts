import { expect, it } from "vitest"
import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { allFixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { hasMeaningfulComparison } from "./graph-state"
import { EXAMPLES, llmsTxt } from "./llms-txt"
import { METRICS } from "./metrics"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(allFixtureInputs())
const text = llmsTxt(info, snapshot, "https://llm-graphs.example")

it("links only to example charts that draw a meaningful comparison", () => {
  for (const { title, search } of EXAMPLES)
    expect(hasMeaningfulComparison(search, info, snapshot), title).toBe(true)
})

it("names every metric, source and model a link can pick", () => {
  for (const metric of METRICS) expect(text).toContain(`- \`${metric}\`:`)
  for (const source of ProvidersService.names) expect(text).toContain(`- \`${source}\`:`)
  const measured = new Set(
    Object.values(snapshot.variants).flatMap((rows) => rows.map((row) => row.entryId)),
  )
  for (const id of measured) expect(text).toContain(`- \`${id}\` `)
})

it("builds links on the origin it is served from", () => {
  expect(text).toContain("](https://llm-graphs.example/?x=cost&y=score&ySource=sweBench)")
  expect(text).not.toContain("llm-graphs.vercel.app")
})
