import { describe, expect, it } from "vitest"

import { aggregateModels } from "#/server/services/model-aggregator/derive"
import { allFixtureInputs } from "#/server/services/model-aggregator/fixture-inputs"
import { ProvidersService } from "#/server/services/providers"

import { comparisonModels, comparisonSlice } from "./comparison-view"
import { DEFAULT_SETTINGS } from "./settings"

const info = ProvidersService.info()
const { snapshot } = aggregateModels(allFixtureInputs())
const search = { x: "cost", y: "score" } as const
const settings = DEFAULT_SETTINGS

describe("comparison slice", () => {
  it("opens on the same models the whole snapshot would", () => {
    const whole = comparisonModels(snapshot, info, search, settings)
    const slice = comparisonSlice(snapshot, info, search, null, settings)

    expect(slice.defaultModels).toEqual(whole.defaultModels)
    expect(comparisonModels(slice.snapshot, info, search, settings).models).toEqual(
      whole.models.filter((model) => whole.defaultModels.includes(model.model)),
    )
  })

  it("carries only the picked models, on the axes' sources", () => {
    const { models } = comparisonModels(snapshot, info, search, settings)
    const picks = [...new Set(models.map((model) => model.model))].slice(0, 2)
    const slice = comparisonSlice(snapshot, info, search, picks, settings)

    expect(slice.snapshot.entries.map((entry) => entry.id).toSorted()).toEqual(picks.toSorted())
    for (const rows of Object.values(slice.snapshot.variants)) {
      expect(rows.every((row) => picks.includes(row.entryId))).toBe(true)
    }
    expect(Object.values(slice.snapshot.variants).filter((rows) => rows.length > 0).length).toBe(1)
    expect(Object.keys(slice.snapshot.logos).length).toBeLessThanOrEqual(picks.length)
  })
})
