// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { parseVariantParams, VariantBar, Variants } from "#/ui/dev/variants"

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.history.replaceState(null, "", "/")
})

function renderSet() {
  return render(
    <>
      <Variants id="picker" variants={{ legend: <p>Legend</p>, chips: <p>Chips</p> }} />
      <VariantBar />
    </>,
  )
}

describe("parseVariantParams", () => {
  it("reads each set's keys, and none as an empty selection", () => {
    const picks = parseVariantParams("?variant=picker:legend,chips&variant=axes:none&x=cost")

    expect(picks.get("picker")).toEqual(["legend", "chips"])
    expect(picks.get("axes")).toEqual([])
  })

  it("skips values without a set id", () => {
    expect(parseVariantParams("?variant=:legend&variant=legend").size).toBe(0)
  })
})

describe("Variants", () => {
  it("shows the first variant until told otherwise", () => {
    renderSet()

    expect(screen.getByText("Legend")).not.toBeNull()
    expect(screen.queryByText("Chips")).toBeNull()
  })

  it("lets the bar show both, then hide either, and remembers the choice", async () => {
    const view = renderSet()

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "chips" })))
    expect(screen.getByText("Legend")).not.toBeNull()
    expect(screen.getByText("Chips")).not.toBeNull()

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "legend" })))
    expect(screen.queryByText("Legend")).toBeNull()
    expect(screen.getByText("Chips")).not.toBeNull()

    view.unmount()
    renderSet()
    expect(screen.queryByText("Legend")).toBeNull()
    expect(screen.getByText("Chips")).not.toBeNull()
  })

  it("can hide every variant", async () => {
    renderSet()

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "legend" })))
    expect(screen.queryByText("Legend")).toBeNull()
    expect(screen.queryByText("Chips")).toBeNull()
  })

  it("takes the URL's choice over the stored one, without overwriting storage", () => {
    window.localStorage.setItem("dev-variants", JSON.stringify({ picker: ["legend"] }))
    window.history.replaceState(null, "", "/?variant=picker:chips")
    renderSet()

    expect(screen.getByText("Chips")).not.toBeNull()
    expect(screen.queryByText("Legend")).toBeNull()
    expect(JSON.parse(window.localStorage.getItem("dev-variants")!)).toEqual({ picker: ["legend"] })
  })
})
