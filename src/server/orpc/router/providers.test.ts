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
        costPerTask: ["deepswe"],
        costPerMTokens: ["artificialAnalysis"],
        tokensPerSecond: ["artificialAnalysis"],
        durationSeconds: ["deepswe"],
      },
      notes: {
        deepswe: {
          score: "DeepSWE v1.1 pass rate",
          costPerTask: "mean cost per evaluated task",
          durationSeconds: "mean wall time per evaluated task",
        },
        artificialAnalysis: {
          costPerMTokens: "3:1 input/output blend",
          tokensPerSecond: "AA output-generation benchmark",
        },
      },
    })
    expect(JSON.parse(JSON.stringify(info))).toEqual(info)
  })
})
