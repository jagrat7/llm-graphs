// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { ComparisonChart } from "#/ui/components/comparison-chart"
import { CHART_TOOLTIP_CARD_CLASS, CHART_TOOLTIP_WIDTH } from "#/ui/lib/chart-styles"
import { metricRecord } from "#/ui/lib/metrics"
import { rangeMinHeight } from "#/ui/lib/range-definition"
import { providersInfoQueryOptions } from "#/ui/lib/use-providers-info"

function makeModel({
  model,
  effort = "default",
  effortOrder = 0,
  score = 50,
  costPerTask = 10,
  configuration,
}: Partial<Model> & { model: string }): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName: model[0].toUpperCase() + model.slice(1),
    vendor: model,
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: effort === "default" ? "unknown" : "on",
    level: effort === "default" ? "unknown" : effort,
    effort,
    effortOrder,
    score,
    costPerTask,
    configuration,
    sources: {
      ...metricRecord<Model["sources"]["score"]>(() => null),
      score: "deepswe",
      costPerTask: "deepswe",
    },
  }
}

const models = [
  makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40, costPerTask: 2 }),
  makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 60, costPerTask: 6 }),
  makeModel({ model: "beta", score: 52, costPerTask: 12 }),
]

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

function renderChart(highlight: string | null = null) {
  const client = new QueryClient()
  client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())

  return render(
    <QueryClientProvider client={client}>
      <ComparisonChart
        models={models}
        sources={{ x: "deepswe", y: "deepswe" }}
        xMetric="cost"
        yMetric="score"
        highlight={highlight}
      />
    </QueryClientProvider>,
  )
}

/** Keyboard focus walks points in pixel order: alpha low, alpha high, beta. */
async function focusPoint(svg: SVGSVGElement, steps: number) {
  await act(async () => svg.focus())
  for (let step = 0; step < steps; step += 1) {
    await act(async () => {
      svg.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
  }
}

/** Focus states tween in, so read them once the transition has settled. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 600)))
}

function marker(container: HTMLElement, id: string) {
  const node = container.querySelector(`[data-ts-key="model-runs-1:${id}"]`)

  expect(node).not.toBeNull()

  return node!
}

describe("comparison chart", () => {
  it("announces the focused effort with app formatting and shows the card", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)

    const tooltip = container.querySelector<HTMLElement>(".ts-chart-tooltip")!
    const announced = tooltip.getAttribute("aria-label") ?? tooltip.textContent ?? ""
    const card = tooltip.querySelector<HTMLElement>(".ts-chart-tooltip__body > div")

    expect(announced).toContain("Alpha [high]")
    expect(announced).toContain("$6")
    expect(announced).toContain("60%")
    expect(card?.className).toBe(CHART_TOOLTIP_CARD_CLASS)
    expect(card?.style.width).toBe(`${CHART_TOOLTIP_WIDTH}px`)
    // The visible card has to describe the same effort as the announcement, not just
    // the same model: alpha's low effort costs $2 and scores 40%.
    expect(card?.textContent).toContain("Alpha")
    expect(card?.textContent).toContain("high")
    expect(card?.textContent).toContain("$6")
    expect(card?.textContent).toContain("60%")
    expect(card?.textContent).not.toContain("$2")
  })

  it("dims other models while a point is focused", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)
    await settle()

    expect(Number(marker(container, "beta-unknown-unknown").getAttribute("opacity"))).toBeLessThan(
      1,
    )
    expect(Number(marker(container, "alpha-on-low").getAttribute("opacity"))).toBe(1)
  })

  it("draws guides from the focused point to each axis only", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)

    const point = marker(container, "alpha-on-high")
    const [x, y] = [Number(point.getAttribute("cx")), Number(point.getAttribute("cy"))]
    // Every point's pair is pre-rendered; focus only flips which pair is visible.
    const guides = [
      ...container.querySelectorAll('line[data-ts-key^="point-guides-0:"][visibility="visible"]'),
    ]
    const toYAxis = guides.find((line) => line.getAttribute("data-ts-key")?.endsWith("to-y-axis"))
    const toXAxis = guides.find((line) => line.getAttribute("data-ts-key")?.endsWith("to-x-axis"))

    expect(guides).toHaveLength(2)
    expect(
      guides.every((line) => line.getAttribute("data-ts-key")?.includes("alpha-on-high")),
    ).toBe(true)
    expect(Number(toYAxis?.getAttribute("x2"))).toBeCloseTo(x)
    expect(Number(toYAxis?.getAttribute("y1"))).toBeCloseTo(y)
    expect(Number(toXAxis?.getAttribute("y1"))).toBeCloseTo(y)
    expect(Number(toXAxis?.getAttribute("x1"))).toBeCloseTo(x)
  })

  it("does not pin the card on Enter, so leaving the chart clears it", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)
    await act(async () => {
      svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    await act(async () => svg.blur())
    await act(async () => {
      svg.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }))
    })

    const tooltip = container.querySelector<HTMLElement>(".ts-chart-tooltip")

    expect(tooltip?.dataset.sticky).not.toBe("true")
    expect(tooltip?.getAttribute("role")).not.toBe("dialog")
    expect(
      tooltip == null ||
        tooltip.hidden ||
        tooltip.style.display === "none" ||
        tooltip.style.visibility === "hidden" ||
        tooltip.style.opacity === "0",
    ).toBe(true)
  })

  it("inspects a point only while the pointer is on its marker", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
    const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number)
    // jsdom has no layout, so the surface reports its scene size 1:1.
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width, height })
    const point = marker(container, "alpha-on-high")
    const [x, y] = [Number(point.getAttribute("cx")), Number(point.getAttribute("cy"))]
    const tooltipShown = () =>
      container.querySelector(".ts-chart-tooltip__body")?.textContent?.includes("Alpha") ?? false
    const moveTo = (clientX: number, clientY: number) =>
      act(async () => {
        svg.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX,
            clientY,
            bubbles: true,
            pointerType: "mouse",
          }),
        )
      })

    // Just outside the 5px dot: the old chart reached 110px, this one does not reach at all.
    await moveTo(x + 8, y)
    expect(tooltipShown()).toBe(false)

    await moveTo(x + 2, y)
    expect(tooltipShown()).toBe(true)
  })

  it("dims every other model while a picker pill is highlighted", () => {
    const { container } = renderChart("beta")

    expect(Number(marker(container, "alpha-on-high").getAttribute("opacity"))).toBeLessThan(1)
    expect(Number(marker(container, "beta-unknown-unknown").getAttribute("opacity"))).toBe(1)
  })

  it("lets chart focus win over a pill highlight, for markers and labels alike", async () => {
    const { container } = renderChart("beta")
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
    const opacity = (selector: string) =>
      Number(container.querySelector(selector)?.getAttribute("opacity"))

    await focusPoint(svg, 1)
    await settle()

    expect(Number(marker(container, "alpha-on-high").getAttribute("opacity"))).toBe(1)
    expect(Number(marker(container, "beta-unknown-unknown").getAttribute("opacity"))).toBeLessThan(
      1,
    )
    expect(opacity('[data-ts-key="model-labels-2:alpha:name"]')).toBe(1)
    expect(opacity('[data-ts-key="model-labels-2:beta:name"]')).toBeLessThan(1)
  })

  it("keeps the full axis notes in the chart's accessible description", () => {
    const { container } = renderChart()
    const description = container.querySelector("svg.ts-chart desc")?.textContent ?? ""

    expect(description).toContain(
      "Horizontal axis: Task cost · $/task (mean cost per evaluated task).",
    )
    expect(description).toContain("Vertical axis: Score · % (DeepSWE")
  })

  it("ignores a highlight for a model that has no plotted points", () => {
    const { container } = renderChart("gamma")

    expect(Number(marker(container, "alpha-on-high").getAttribute("opacity"))).toBe(1)
    expect(Number(marker(container, "beta-unknown-unknown").getAttribute("opacity"))).toBe(1)
  })
})

/** The tooltip body's text, wherever the chart's tooltip portal put it. */
const tooltipText = () => document.querySelector(".ts-chart-tooltip__body")?.textContent ?? ""

const viewButton = (name: string) => screen.getByRole("button", { name })

describe("stacked runs", () => {
  // Every effort of a model shares its token price, so each run stacks on one x value.
  const priced = [
    {
      ...makeModel({ model: "alpha", effort: "low", effortOrder: 1, score: 40 }),
      costPerMTokens: 4,
    },
    {
      ...makeModel({ model: "alpha", effort: "high", effortOrder: 3, score: 60 }),
      costPerMTokens: 4,
    },
    {
      ...makeModel({ model: "beta", effort: "low", effortOrder: 1, score: 30 }),
      costPerMTokens: 20,
    },
    {
      ...makeModel({ model: "beta", effort: "high", effortOrder: 3, score: 45 }),
      costPerMTokens: 20,
    },
  ].map((model) => ({
    ...model,
    sources: { ...model.sources, costPerMTokens: "artificialAnalysis" as const },
  }))

  function renderPriced(xMetric: "price" | "cost" = "price") {
    const client = new QueryClient()
    client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())

    return render(
      <QueryClientProvider client={client}>
        <ComparisonChart
          models={xMetric === "price" ? priced : models}
          sources={{ x: xMetric === "price" ? "artificialAnalysis" : "deepswe", y: "deepswe" }}
          xMetric={xMetric}
          yMetric="score"
        />
      </QueryClientProvider>,
    )
  }

  it("switches to one row per model and can go back to the scatter", async () => {
    const { container } = renderPriced()

    expect(viewButton("Ranges").getAttribute("aria-pressed")).toBe("true")
    expect(container.textContent).toContain("Alpha · $4")
    expect(screen.getByRole("img", { name: /^Range chart of 2 models/ })).toBeTruthy()

    await act(async () => fireEvent.click(viewButton("Scatter")))

    expect(viewButton("Scatter").getAttribute("aria-pressed")).toBe("true")
    expect(container.textContent).not.toContain("Alpha · $4")
    expect(screen.getByRole("img", { name: /^2D scatter plot/ })).toBeTruthy()
  })

  it("offers no view switch when efforts spread along both axes", () => {
    renderPriced("cost")

    expect(screen.queryByRole("group", { name: "Chart view" })).toBeNull()
  })

  it("describes the displayed range axes, then restores the scatter description", async () => {
    const { container } = renderPriced()
    const description = () => container.querySelector("svg.ts-chart desc")?.textContent ?? ""

    expect(description()).toContain("Horizontal axis: Score")
    expect(description()).toContain("Vertical axis: model configurations")
    expect(description()).toContain("Token price")
    expect(description()).not.toContain("Horizontal axis: Token price")

    await act(async () => fireEvent.click(viewButton("Scatter")))
    expect(description()).toContain("Horizontal axis: Token price")
  })

  it("remembers separate view choices for both orientations of the metrics", async () => {
    const client = new QueryClient()
    client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())
    const chart = (swapped: boolean) => (
      <QueryClientProvider client={client}>
        <ComparisonChart
          models={priced}
          sources={
            swapped
              ? { x: "deepswe", y: "artificialAnalysis" }
              : { x: "artificialAnalysis", y: "deepswe" }
          }
          xMetric={swapped ? "score" : "price"}
          yMetric={swapped ? "price" : "score"}
        />
      </QueryClientProvider>
    )
    const { rerender } = render(chart(false))

    await act(async () => fireEvent.click(viewButton("Scatter")))
    rerender(chart(true))
    expect(viewButton("Ranges").getAttribute("aria-pressed")).toBe("true")
    await act(async () => fireEvent.click(viewButton("Scatter")))
    await act(async () => fireEvent.click(viewButton("Ranges")))
    rerender(chart(false))
    expect(viewButton("Scatter").getAttribute("aria-pressed")).toBe("true")
    rerender(chart(true))
    expect(viewButton("Ranges").getAttribute("aria-pressed")).toBe("true")
  })

  it("gives dense ranges room to grow beyond the scatter frame", () => {
    const client = new QueryClient()
    client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())
    const crowd = Array.from({ length: 20 }, (_, index) =>
      priced.slice(0, 2).map((point) => ({ ...point, model: `model-${index}` })),
    ).flat()
    const { container } = render(
      <QueryClientProvider client={client}>
        <ComparisonChart
          models={crowd}
          sources={{ x: "artificialAnalysis", y: "deepswe" }}
          xMetric="price"
          yMetric="score"
        />
      </QueryClientProvider>,
    )
    const frame = container.querySelector<HTMLElement>('[data-chart-frame="loaded"]')!
    expect(Number.parseFloat(frame.style.minHeight)).toBeGreaterThan(rangeMinHeight(20))
    expect(frame.style.maxHeight).toBe("none")
  })

  it("keeps spans noninteractive while markers expose their original values", async () => {
    const { container } = renderPriced()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
    const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number)
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width, height })
    const low = container.querySelector('[data-ts-key="model-runs-0:alpha-on-low"]')!
    const high = container.querySelector('[data-ts-key="model-runs-0:alpha-on-high"]')!
    const x = Number(low.getAttribute("cx"))
    const y = Number(low.getAttribute("cy"))
    const move = (clientX: number) =>
      act(async () => {
        svg.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX,
            clientY: y,
            bubbles: true,
            pointerType: "mouse",
          }),
        )
      })

    await move((x + Number(high.getAttribute("cx"))) / 2)
    expect(tooltipText()).not.toContain("Alpha")
    await move(x)
    expect(tooltipText()).toContain("Alpha")
    expect(tooltipText()).toContain("40%")
  })

  /**
   * A phone-sized range chart taller than the screen, scrolled so `rowId`'s marker sits
   * just above the viewport's bottom edge; returns where the card was placed.
   */
  async function cardNearViewportBottom(rowId: string, surface: { width: number; height: number }) {
    const viewport = { width: surface.width, height: 700 }
    const card = { width: 200, height: 240 }
    let scrolled = 0
    const restore = [
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(viewport.width),
      vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(viewport.height),
      vi
        .spyOn(HTMLElement.prototype, "offsetWidth", "get")
        .mockImplementation(function (this: HTMLElement) {
          return this.classList.contains("ts-chart-tooltip") ? card.width : 0
        }),
      vi
        .spyOn(HTMLElement.prototype, "offsetHeight", "get")
        .mockImplementation(function (this: HTMLElement) {
          return this.classList.contains("ts-chart-tooltip") ? card.height : 0
        }),
      // The chart host and its SVG share the page position; scrolling moves both up.
      vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(() => DOMRect.fromRect({ x: 0, y: -scrolled, ...surface })),
    ]

    try {
      const { container } = renderPriced()
      const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
      const rowMarker = container.querySelector(`[data-ts-key="model-runs-0:${rowId}"]`)!
      const x = Number(rowMarker.getAttribute("cx"))
      const y = Number(rowMarker.getAttribute("cy"))

      scrolled = y - (viewport.height - 10)
      await act(async () => {
        svg.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: x,
            clientY: y - scrolled,
            bubbles: true,
            pointerType: "mouse",
          }),
        )
      })

      const element = document.querySelector<HTMLElement>(".ts-chart-tooltip")!
      const top = Number.parseFloat(element.style.top)
      const left = Number.parseFloat(element.style.left)

      return { viewport, card, markerTop: y - scrolled, top, left, hidden: element.hidden }
    } finally {
      for (const spy of restore) spy.mockRestore()
    }
  }

  it("keeps a lower row's card on screen when the chart is scrolled, on a phone", async () => {
    const { viewport, card, markerTop, top, left, hidden } = await cardNearViewportBottom(
      "beta-on-low",
      { width: 360, height: 1230 },
    )

    expect(hidden).toBe(false)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + card.height).toBeLessThanOrEqual(viewport.height)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + card.width).toBeLessThanOrEqual(viewport.width)
    // No room below the row, so the card opens above it rather than past the screen edge.
    expect(top + card.height).toBeLessThanOrEqual(markerTop)
  })

  it("keeps a lower row's card on screen when the chart is scrolled, on desktop", async () => {
    const { viewport, card, top, left, hidden } = await cardNearViewportBottom("beta-on-high", {
      width: 1200,
      height: 1230,
    })

    expect(hidden).toBe(false)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + card.height).toBeLessThanOrEqual(viewport.height)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + card.width).toBeLessThanOrEqual(viewport.width)
  })
})
