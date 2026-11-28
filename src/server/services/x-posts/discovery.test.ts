import { expect, it } from "vitest"

import {
  discoveryStats,
  judge,
  scheduledSearches,
  setBlocked,
  siblings,
  toPostId,
  type DiscoveryModel,
} from "./discovery"

const NOW = Date.parse("2026-11-26T06:00:00.000Z")

function model(id: string, name: string, releaseDate: string, extra: Partial<DiscoveryModel> = {}) {
  return { id, name, vendor: "openai", releaseDate, makesImages: false, ...extra }
}

const astra = model("gpt-6-2-astra", "GPT-6.2 Astra", "2026-11-17")
const oldAstra = model("gpt-6-astra", "GPT-6 Astra", "2026-09-22")

it("searches new models daily, recent ones weekly, and old ones never", () => {
  const models = [
    astra,
    model("weekly-due", "Weekly Due", "2026-10-15"),
    model("weekly-not-due", "Weekly Off", "2026-10-16"),
    model("too-old", "Too Old", "2026-05-01"),
    model("undated", "Undated", ""),
  ]

  const queried = new Set(scheduledSearches(models, NOW).map((search) => search.model.id))
  expect(queried).toEqual(new Set(["gpt-6-2-astra", "weekly-due"]))
  expect(scheduledSearches(models, NOW)[0].query).toBe('"GPT-6.2 Astra" one-shot')
})

it("stays inside the free search allowance however many models are new", () => {
  const many = Array.from({ length: 20 }, (_, index) =>
    model(`m${index}`, `Model ${index}`, "2026-11-20"),
  )
  expect(scheduledSearches(many, NOW)).toHaveLength(15)
})

it("weighs a model against its own lab's recent versions only", () => {
  const others = [
    oldAstra,
    model("gpt-4", "GPT-4", "2023-03-14"),
    model("gemini-4-carbon", "Gemini 4 Carbon", "2026-11-10", { vendor: "google" }),
  ]
  expect(siblings(astra, [astra, ...others]).map((other) => other.id)).toEqual(["gpt-6-astra"])
})

const sure = {
  verdict: "output",
  pOutput: 0.97,
  pSuitable: 0.9,
  categories: { image: 0.6, coding: 0.3, agents: 0.1 },
  models: { "gpt-6-2-astra": 0.4, "gpt-6-astra": 0.1 },
}

it("keeps a sure output under the searched model, never filing a text model as image", () => {
  expect(judge(sure, astra, [oldAstra])).toEqual({ model: astra, category: "coding" })
})

it("moves a post to the version it really shows", () => {
  const older = { ...sure, models: { "gpt-6-2-astra": 0.14, "gpt-6-astra": 0.32 } }
  expect(judge(older, astra, [oldAstra])?.model.id).toBe("gpt-6-astra")
})

it("files an image model's output as image", () => {
  const banana = model("nano-banana-2-1", "Nano Banana 2.1", "2026-10-01", { makesImages: true })
  expect(judge(sure, banana, [])?.category).toBe("image")
})

it("keeps the searched model when another version only edges it", () => {
  const close = { ...sure, models: { "gpt-6-2-astra": 0.2, "gpt-6-astra": 0.25 } }
  expect(judge(close, astra, [oldAstra])?.model.id).toBe("gpt-6-2-astra")
})

it("drops anything it isn't sure of", () => {
  expect(judge({ ...sure, pOutput: 0.6 }, astra, [])).toBeNull()
  expect(judge({ ...sure, verdict: "pointer" }, astra, [])).toBeNull()
  expect(judge({ ...sure, pSuitable: 0.4 }, astra, [])).toBeNull()
  expect(judge({ ...sure, pOutput: 0.75 }, astra, [])).not.toBeNull()
})

it("reads a post id from an id or any form of post link", () => {
  expect(toPostId("2059000000000000001")).toBe("2059000000000000001")
  expect(toPostId(" https://x.com/someone/status/2059000000000000001?s=20 ")).toBe(
    "2059000000000000001",
  )
  expect(toPostId("twitter.com/someone/status/2059000000000000001/photo/1")).toBe(
    "2059000000000000001",
  )
  expect(toPostId("https://x.com/someone")).toBeNull()
})

it("blocks and unblocks posts and authors", async () => {
  await setBlocked({ post: "https://x.com/someone/status/2059000000000000001" }, true)
  await setBlocked({ author: "@Spammer" }, true)
  expect(await discoveryStats()).toMatchObject({
    blockedPosts: ["2059000000000000001"],
    blockedAuthors: ["spammer"],
  })

  await setBlocked({ author: "spammer" }, false)
  expect((await discoveryStats()).blockedAuthors).toEqual([])
  await expect(setBlocked({ post: "not a post" }, true)).rejects.toThrow("Not a post id or link")
})
