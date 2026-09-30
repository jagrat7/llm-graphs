import { createRouterClient } from "@orpc/server"
import { describe, expect, it } from "vitest"

import router from "."

describe("providers.info", () => {
  it("returns serializable provider metadata without downloader implementations", async () => {
    const client = createRouterClient(router)
    const info = await client.providers.info()

    expect(info).toEqual({
      displayNames: {
        deepswe: "DeepSWE",
        artificialAnalysis: "Artificial Analysis",
      },
      metricProviders: {
        score: ["deepswe"],
        costPerMTokens: ["deepswe", "artificialAnalysis"],
        tokensPerSecond: ["artificialAnalysis"],
        durationSeconds: ["deepswe"],
      },
      notes: {
        deepswe: { costPerMTokens: "observed input/output mix" },
        artificialAnalysis: { costPerMTokens: "3:1 input/output blend" },
      },
    })
    expect(JSON.parse(JSON.stringify(info))).toEqual(info)
  })
})
