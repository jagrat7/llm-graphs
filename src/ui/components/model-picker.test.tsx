// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { countFittingChips, ModelPicker } from "#/ui/components/model-picker"
import { metricRecord } from "#/ui/lib/metrics"

function makeModel(model: string): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName: model[0].toUpperCase() + model.slice(1),
    vendor: model,
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: "unknown",
    level: "unknown",
    effort: "default",
    effortOrder: 0,
    sources: metricRecord<Model["sources"]["score"]>(() => null),
  }
}

const models = [makeModel("alpha"), makeModel("beta"), makeModel("gamma")]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** jsdom has no layout, so give the ghost row 300px and every chip 100px: two to a row. */
function stubChipLayout() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return DOMRect.fromRect({ width: this.dataset.slot === "model-picker-ghost" ? 300 : 100 })
    },
  )
}

function renderPicker(selected: Array<string> = ["alpha", "beta"]) {
  const onHighlightChange = vi.fn()
  const element = (ids: Array<string>) => (
    <ModelPicker
      models={models}
      selected={ids}
      onChange={() => {}}
      onHighlightChange={onHighlightChange}
    />
  )
  const view = render(element(selected))

  return {
    onHighlightChange,
    rerender: (ids: Array<string>) => view.rerender(element(ids)),
    highlighted: () => onHighlightChange.mock.lastCall?.[0] ?? null,
  }
}

/** Every selected name is also in the picker's hidden measuring row; skip that copy. */
const shownText = (name: string) =>
  screen.getAllByText(name).find((element) => !element.closest("[data-slot=model-picker-ghost]"))!

const pill = (name: string) => shownText(name).closest<HTMLElement>("[data-slot=combobox-chip]")!

describe("model picker highlight", () => {
  it("reports the model whose pill is hovered or focused", () => {
    const { highlighted } = renderPicker()

    fireEvent.pointerEnter(pill("Beta"))
    expect(highlighted()).toBe("beta")

    fireEvent.pointerLeave(pill("Beta"))
    expect(highlighted()).toBeNull()

    fireEvent.focus(pill("Beta"))
    expect(highlighted()).toBe("beta")

    fireEvent.blur(pill("Beta"))
    expect(highlighted()).toBeNull()
  })

  it("keeps a focused pill highlighted after the pointer passes over another", () => {
    const { highlighted } = renderPicker()

    fireEvent.focus(pill("Alpha"))
    fireEvent.pointerEnter(pill("Beta"))
    expect(highlighted()).toBe("beta")

    fireEvent.pointerLeave(pill("Beta"))
    expect(highlighted()).toBe("alpha")
  })

  it("treats focus moving onto a pill's own remove button as staying on the pill", () => {
    const { highlighted } = renderPicker()
    const remove = pill("Beta").querySelector("button")!

    fireEvent.focus(pill("Beta"))
    fireEvent.blur(pill("Beta"), { relatedTarget: remove })
    expect(highlighted()).toBe("beta")
  })

  it("highlights the model under keyboard navigation in the list", async () => {
    const { highlighted } = renderPicker()
    const input = screen.getByRole("combobox")
    const activeModel = () => {
      const id = input.getAttribute("aria-activedescendant")

      return id == null ? null : document.getElementById(id)?.textContent?.toLowerCase()
    }
    const press = (key: string) =>
      act(async () => {
        fireEvent.keyDown(input, { key })
      })

    await act(async () => input.focus())
    await press("ArrowDown")
    await press("ArrowDown")
    const first = highlighted()

    expect(first).not.toBeNull()
    expect(first).toBe(activeModel())

    await press("ArrowDown")

    expect(highlighted()).not.toBe(first)
    expect(highlighted()).toBe(activeModel())

    await press("Escape")
    expect(highlighted()).toBeNull()
  })

  it("clears an overflow pill's highlight when its list closes", async () => {
    stubChipLayout()
    const many = Array.from({ length: 13 }, (_, index) => `model${String(index).padStart(2, "0")}`)
    const onHighlightChange = vi.fn()
    const latest = () => onHighlightChange.mock.lastCall?.[0] ?? null

    render(
      <ModelPicker
        models={many.map(makeModel)}
        selected={many}
        onChange={() => {}}
        onHighlightChange={onHighlightChange}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /more selected models/ }))
    })
    const overflowPill = shownText("Model12").closest("li")!

    fireEvent.pointerEnter(overflowPill)
    expect(latest()).toBe("model12")

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    })

    expect(overflowPill.isConnected).toBe(false)
    expect(latest()).toBeNull()
  })

  it("forgets a removed pill, so selecting it again does not bring the highlight back", () => {
    const { highlighted, rerender } = renderPicker()

    fireEvent.pointerEnter(pill("Beta"))
    rerender(["alpha"])
    expect(highlighted()).toBeNull()

    rerender(["alpha", "beta"])
    expect(highlighted()).toBeNull()
  })
})

describe("countFittingChips", () => {
  const fit = { available: 100, gap: 4, rows: 3, moreWidth: 30 }

  it("keeps every chip when they all fit the rows", () => {
    expect(countFittingChips([48, 48, 48, 48, 48, 48], fit)).toBe(6)
  })

  it("leaves room on the last row for the count trigger", () => {
    // Two chips a row; the seventh spills, so the last row trades a chip for the trigger.
    expect(countFittingChips([48, 48, 48, 48, 48, 48, 48], fit)).toBe(5)
  })

  it("gives a chip wider than the row a row of its own", () => {
    expect(countFittingChips([140, 20, 20], { ...fit, rows: 2 })).toBe(3)
    expect(countFittingChips([140, 140, 140], { ...fit, rows: 2 })).toBe(1)
  })

  it("shows only the trigger when not even one chip fits beside it", () => {
    expect(countFittingChips([90, 90], { ...fit, rows: 1 })).toBe(0)
  })
})
