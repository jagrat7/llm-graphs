import { describe, expect, it } from "vitest"

import type { GraphSearch } from "#/ui/lib/graph-state"

import { ProvidersService } from "#/server/services/providers"
import { axisSettings, shareSources, upgradeLegacySearch } from "#/ui/lib/graph-state"

const info = ProvidersService.info()

/** What a recipient's page reads from a shared link. */
function openShared(search: GraphSearch) {
  return upgradeLegacySearch({ ...search, ...shareSources(search, info) })
}

describe("shared link sources", () => {
  it("keeps task cost on a link whose score comes from Artificial Analysis", () => {
    const search: GraphSearch = { x: "cost", y: "score", ySource: "artificialAnalysis" }
    const opened = openShared(search)

    expect(opened.x).toBe("cost")
    expect(opened.xSource).toBeUndefined()
    expect(axisSettings(opened, info)).toEqual(axisSettings(search, info))
  })

  it("pins every chosen axis's source, the depth axis included", () => {
    const search: GraphSearch = { x: "price", y: "score", z: "speed" }
    const settings = axisSettings(search, info)
    const opened = openShared(search)

    expect(opened.xSource).toBe(settings.x.source)
    expect(opened.ySource).toBe(settings.y.source)
    expect(opened.zSource).toBe(settings.z.source)
    expect(axisSettings(opened, info)).toEqual(settings)
  })

  it("still reads an old explicit AA cost link as token price", () => {
    expect(upgradeLegacySearch({ x: "cost", xSource: "artificialAnalysis", y: "score" }).x).toBe(
      "price",
    )
  })
})
