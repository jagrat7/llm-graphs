import { describe, expect, it } from "vitest"

import { Route } from "#/ui/routes/index"

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the route's own search parser
const parseSearch = Route.options.validateSearch as (search: Record<string, unknown>) => {
  log?: Array<string>
  linear?: Array<string>
}

describe("compare page link", () => {
  it("reads one or more log metrics, and none when the link names none", () => {
    expect(parseSearch({}).log).toBeUndefined()
    expect(parseSearch({ log: "cost" }).log).toEqual(["cost"])
    expect(parseSearch({ log: ["cost", "price"] }).log).toEqual(["cost", "price"])
  })

  it("drops a log metric it doesn't know and keeps the rest", () => {
    expect(parseSearch({ log: ["cost", "bogus"] }).log).toEqual(["cost"])
    expect(parseSearch({ log: "bogus" }).log).toBeUndefined()
  })

  it("reads the metrics a link keeps linear the same way", () => {
    expect(parseSearch({}).linear).toBeUndefined()
    expect(parseSearch({ linear: "cost" }).linear).toEqual(["cost"])
    expect(parseSearch({ linear: ["cost", "bogus"] }).linear).toEqual(["cost"])
  })
})
