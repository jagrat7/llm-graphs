import { expect, it } from "vitest"
import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { allFixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"
import { hasMeaningfulComparison } from "./graph-state"
import { EXAMPLES } from "./llms-txt"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(allFixtureInputs())

it("links only to example charts that draw a meaningful comparison", () => {
  for (const { title, search } of EXAMPLES)
    expect(hasMeaningfulComparison(search, info, snapshot), title).toBe(true)
})
