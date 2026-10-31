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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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
  screen.getByText(name).closest<HTMLElement>("[data-slot=model-picker-entry]")!

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

      return id == null
        ? null
        : document
            .getElementById(id)
            ?.querySelector("[data-slot=model-picker-option-name]")
            ?.textContent?.toLowerCase()
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

/** Ids `model00`, `model01`, … that sort in the order they are picked. */
const picks = (count: number) =>
  Array.from({ length: count }, (_, index) => `model${String(index).padStart(2, "0")}`)

describe("model picker key", () => {
  it("shows nine picks in full, with no count", () => {
    render(<ModelPicker models={picks(9).map(makeModel)} selected={picks(9)} onChange={() => {}} />)

    expect(document.querySelectorAll("[data-slot=model-picker-entry]")).toHaveLength(9)
    expect(screen.queryByRole("button", { name: /more selected models/ })).toBeNull()
  })

  it("gives the last cell to the count once the picks outgrow the key", () => {
    render(
      <ModelPicker models={picks(10).map(makeModel)} selected={picks(10)} onChange={() => {}} />,
    )

    expect(document.querySelectorAll("[data-slot=model-picker-entry]")).toHaveLength(8)
    expect(screen.getByRole("button", { name: "Show 2 more selected models" })).not.toBeNull()
  })
})

describe("model picker search", () => {
  it("labels each suggestion with what choosing it does", async () => {
    renderPicker(["alpha"])
    const input = screen.getByRole("combobox")

    await act(async () => input.focus())
    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" })
    })

    expect(screen.getByRole("option", { name: /Alpha/ }).textContent).toContain("Remove")
    expect(screen.getByRole("option", { name: /Gamma/ }).textContent).toContain("Add")
  })

  it("shows the search field immediately without taking focus", () => {
    renderPicker()

    expect(screen.getByRole("combobox")).not.toBeNull()
    expect(document.activeElement).not.toBe(screen.getByRole("combobox"))
  })

  it("stays expanded on Escape without clearing the selected models", async () => {
    const { onChange } = renderPicker()

    await act(async () => {
      screen.getByRole("combobox").focus()
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" })
    })

    expect(document.activeElement).toBe(screen.getByRole("combobox"))
    expect(onChange).not.toHaveBeenCalled()
    expect(pill("Alpha")).not.toBeNull()
  })

  it("keeps the search field and query after clicking outside or opening Models", async () => {
    renderPicker()
    render(<button>Outside</button>)

    const input = screen.getByRole("combobox")

    await act(async () => {
      input.focus()
      fireEvent.change(input, { target: { value: "alp" } })
    })
    await act(async () => {
      const outside = screen.getByRole("button", { name: "Outside" })
      outside.focus()
      fireEvent.click(outside)
      await new Promise(requestAnimationFrame)
    })

    expect(screen.getByRole("combobox")).toBe(input)
    expect(screen.getByDisplayValue("alp")).toBe(input)
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside" }))

    await openChecklist()

    expect(screen.getByRole("combobox")).toBe(input)
    expect(screen.getByDisplayValue("alp")).toBe(input)
    expect(screen.getByRole("checkbox", { name: "Alpha" })).not.toBeNull()
  })

  it("focuses the visible search with the slash shortcut", async () => {
    render(<ModelPicker models={models} selected={[]} onChange={() => {}} shortcut />)

    await act(async () => {
      fireEvent.keyDown(document.body, { key: "/" })
    })

    expect(document.activeElement).toBe(screen.getByRole("combobox"))
  })
})

async function openChecklist() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Models/ }))
  })
}

describe("model picker checklist", () => {
  it("can clear a selection the current models do not include", async () => {
    const { onChange } = renderPicker(["retired"])
    await openChecklist()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    })

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it("keeps picks the current models do not include when a pill is removed", async () => {
    const { onChange } = renderPicker(["retired", "alpha", "beta"])

    await act(async () => {
      fireEvent.click(pill("Beta").querySelector("button")!)
    })

    expect(onChange).toHaveBeenLastCalledWith(["retired", "alpha"])
  })

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
