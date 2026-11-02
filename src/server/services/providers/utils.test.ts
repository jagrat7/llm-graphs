import { describe, expect, it } from "vitest"

import type { ReasoningMode } from "./provider.types"
import { effortOrder } from "./utils"

function sorted(runs: Array<[ReasoningMode, string]>) {
  return runs
    .toSorted((left, right) => effortOrder(...left) - effortOrder(...right))
    .map(([mode, level]) => `${mode}/${level}`)
}

describe("effortOrder", () => {
  it("puts non-reasoning before the lowest effort", () => {
    expect(
      sorted([
        ["on", "max"],
        ["on", "low"],
        ["off", "unknown"],
        ["on", "minimal"],
      ]),
    ).toEqual(["off/unknown", "on/minimal", "on/low", "on/max"])
  })

  it("puts every non-reasoning run before every reasoning run", () => {
    expect(
      sorted([
        ["on", "low"],
        ["off", "high"],
        ["off", "unknown"],
        ["off", "low"],
      ]),
    ).toEqual(["off/low", "off/high", "off/unknown", "on/low"])
  })

  it("orders budgets after levels and an unstated effort or mode last", () => {
    expect(
      sorted([
        ["unknown", "unknown"],
        ["on", "unknown"],
        ["on", "32k"],
        ["on", "between tools"],
        ["on", "8k"],
        ["on", "max"],
      ]),
    ).toEqual(["on/max", "on/8k", "on/32k", "on/between tools", "on/unknown", "unknown/unknown"])
  })
})
