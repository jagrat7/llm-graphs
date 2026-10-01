import { createRouterClient } from "@orpc/server"
import { describe, expect, it } from "vitest"
import router from "."
import { ProvidersService } from "../../services/providers"

describe("providers.info", () => {
  it("returns serializable provider metadata with native score units and no downloader code", async () => {
    const info = await createRouterClient(router).providers.info()
    expect(info).toEqual(ProvidersService.info())
    expect(JSON.parse(JSON.stringify(info))).toEqual(info)
    expect(info.metricProviders.score).toEqual(ProvidersService.providersFor("score"))
    expect(info.presentation.metr.score).toEqual({
      label: "Task horizon (50%)",
      unit: "h",
      format: "hours",
    })
    expect(info.presentation.artificialAnalysis.score?.unit).toBe("points")
    expect(info.presentation.arena.score?.unit).toBe("points")
    expect(info.scopes.artificialAnalysis.costPerMTokens).toBe("model")
  })
})
