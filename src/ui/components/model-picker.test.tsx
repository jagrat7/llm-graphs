// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { ModelPicker } from "#/ui/components/model-picker"
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

afterEach(cleanup)

function renderPicker(selected: Array<string> = ["alpha", "beta"]) {
  const onHighlightChange = vi.fn()
  const onChange = vi.fn()
  const element = (ids: Array<string>) => (
    <ModelPicker
      models={models}
      selected={ids}
      onChange={onChange}
      onHighlightChange={onHighlightChange}
    />
  )
  const view = render(element(selected))

  return {
    onChange,
    onHighlightChange,
    rerender: (ids: Array<string>) => view.rerender(element(ids)),
    highlighted: () => onHighlightChange.mock.lastCall?.[0] ?? null,
  }
}

const pill = (name: string) =>
  screen.getByText(name).closest<HTMLElement>("[data-slot=combobox-chip]")!

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
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search models" }))
    })
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
    const overflowPill = screen.getByText("Model12").closest("li")!

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

describe("model picker search", () => {
  it("starts folded and unfolds into a focused search field", async () => {
    renderPicker()

    expect(screen.queryByRole("combobox")).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search models" }))
    })

    expect(document.activeElement).toBe(screen.getByRole("combobox"))
  })

  it("folds on Escape without clearing the selected models", async () => {
    const { onChange } = renderPicker()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search models" }))
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" })
    })

    expect(screen.queryByRole("combobox")).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Search models" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(pill("Alpha")).not.toBeNull()
  })
})

async function openChecklist() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Models/ }))
  })
}

describe("model picker checklist", () => {
  it("adds an unchecked model and removes a checked one", async () => {
    const { onChange } = renderPicker()
    await openChecklist()

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Gamma" }))
    })
    expect(onChange).toHaveBeenLastCalledWith(["alpha", "beta", "gamma"])

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }))
    })
    expect(onChange).toHaveBeenLastCalledWith(["beta"])
  })

  it("emphasises a hovered row and lets go when the list closes", async () => {
    const { highlighted } = renderPicker()
    await openChecklist()
    const row = screen.getByRole("checkbox", { name: "Beta" }).closest("label")!

    fireEvent.pointerEnter(row)
    expect(highlighted()).toBe("beta")

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    })

    expect(row.isConnected).toBe(false)
    expect(highlighted()).toBeNull()
  })
})
