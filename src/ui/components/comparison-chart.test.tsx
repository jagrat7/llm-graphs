// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { Metric } from "#/ui/lib/metrics"
import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { ComparisonChart } from "#/ui/components/comparison-chart"
import { barsMinWidth } from "#/ui/lib/bar-definition"
import { standaloneChartSvg } from "#/ui/lib/chart-image"
import { CHART_TOOLTIP_CARD_CLASS, CHART_TOOLTIP_WIDTH } from "#/ui/lib/chart-styles"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
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

function renderChart(
  highlight: string | null = null,
  getShareLink?: () => string,
  chartModels = models,
) {
  const client = new QueryClient()
  client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())

  return render(
    <QueryClientProvider client={client}>
      <ComparisonChart
        models={chartModels}
        sources={{ x: "deepswe", y: "deepswe" }}
        xMetric="cost"
        yMetric="score"
        highlight={highlight}
        getShareLink={getShareLink}
        logMetrics={[]}
        onLogMetricChange={() => {}}
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
  const node = container.querySelector(`[data-ts-key="model-runs-3:${id}"]`)

  expect(node).not.toBeNull()

  return node!
}

describe("comparison chart", () => {
  it("announces the focused effort with app formatting and shows the card", async () => {
    const { container } = renderChart()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)

    const tooltip = document.querySelector<HTMLElement>(".ts-chart-tooltip")!
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
      ...container.querySelectorAll('line[data-ts-key^="point-guides-1:"][visibility="visible"]'),
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

    const tooltip = document.querySelector<HTMLElement>(".ts-chart-tooltip")

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
    const tooltipShown = () => tooltipText().includes("Alpha")
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
    expect(opacity('[data-ts-key="model-labels-4:alpha:name"]')).toBe(1)
    expect(opacity('[data-ts-key="model-labels-4:beta:name"]')).toBeLessThan(1)
  })

  it("keeps the full axis notes in the chart's accessible description", () => {
    const { container } = renderChart()
    const description = container.querySelector("svg.ts-chart desc")?.textContent ?? ""

    expect(description).toContain(
      "Horizontal axis: Task cost · $/task (mean cost per evaluated task).",
    )
    expect(description).toContain("Vertical axis: Score · % (DeepSWE")
  })

  it("hides the Pareto frontier until the reader toggles it on, and back off", async () => {
    const { container } = renderChart()
    const toggle = screen.getByRole("button", { name: "Pareto frontier" })
    const curve = () => container.querySelector('[data-ts-key="pareto-frontier-2:line"]')
    const description = () => container.querySelector("svg.ts-chart desc")?.textContent ?? ""
    // Beta sits off the frontier, so it is muted while the frontier shows.
    const beta = () => Number(marker(container, "beta-unknown-unknown").getAttribute("opacity"))

    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(curve()).toBeNull()
    expect(description()).not.toContain("Pareto frontier")
    expect(beta()).toBe(1)

    await act(async () => fireEvent.click(toggle))
    await settle()

    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(curve()).not.toBeNull()
    expect(description()).toContain("Pareto frontier")
    expect(beta()).toBeLessThan(1)

    await act(async () => fireEvent.click(toggle))
    await settle()

    expect(curve()).toBeNull()
  })

  it("starts a crowded axis linear, and flips it to log", async () => {
    const crowded = [0.05, 0.1, 0.2, 0.4, 60].map((costPerTask, index) =>
      makeModel({ model: `m${index}`, costPerTask, score: 20 + index * 10 }),
    )
    const client = new QueryClient()
    client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())
    const onLogMetricChange = vi.fn()
    // The page keeps the choice in its link; this stands in for it.
    function Page() {
      const [logMetrics, setLogMetrics] = useState<Array<Metric>>([])

      return (
        <ComparisonChart
          models={crowded}
          sources={{ x: "deepswe", y: "deepswe" }}
          xMetric="cost"
          yMetric="score"
          logMetrics={logMetrics}
          onLogMetricChange={(metric, log) => {
            onLogMetricChange(metric, log)
            setLogMetrics(log ? [metric] : [])
          }}
        />
      )
    }
    const { container } = render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>,
    )
    const toggle = screen.getByRole("button", { name: "Log scale for Task cost" })

    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(container.textContent).not.toContain("log scale")
    // Score is no ratio metric, so it never gets a switch.
    expect(screen.queryByRole("button", { name: /Log scale for Score/ })).toBeNull()

    await act(async () => fireEvent.click(toggle))
    await settle()

    expect(onLogMetricChange).toHaveBeenCalledWith("cost", true)
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(container.textContent).toContain("log scale")
  })

  it("offers log on a narrow axis without turning it on", () => {
    renderChart()

    expect(
      screen.getByRole("button", { name: "Log scale for Task cost" }).getAttribute("aria-pressed"),
    ).toBe("false")
  })

  it("says a highlighted model, not the frontier, keeps its emphasis", async () => {
    const { container } = renderChart("beta")
    const toggle = screen.getByRole("button", { name: "Pareto frontier" })

    await act(async () => fireEvent.click(toggle))
    const description = container.querySelector("svg.ts-chart desc")?.textContent ?? ""

    expect(description).toContain("Pareto frontier")
    expect(description).toContain("is highlighted, so every other model is muted")
    expect(description).not.toContain("Variants off it are muted")

    // The setting outlives the test, so put it back.
    await act(async () => fireEvent.click(toggle))
  })

  it("ignores a highlight for a model that has no plotted points", () => {
    const opacities = (highlight: string | null = null) => {
      const { container, unmount } = renderChart(highlight)
      const read = (id: string) => marker(container, id).getAttribute("opacity")
      const values = [read("alpha-on-high"), read("beta-unknown-unknown")]

      unmount()
      return values
    }

    expect(opacities("gamma")).toEqual(opacities())
  })
})

/** The tooltip body's text, wherever the chart's tooltip portal put it. */
const tooltipText = () => document.querySelector(".ts-chart-tooltip__body")?.textContent ?? ""

const viewButton = (name: string) => screen.getByRole("button", { name })

/** A bar's box, read back from its rounded path: left, right, top and bottom edges. */
function barBox(container: HTMLElement, id: string) {
  const path = container.querySelector(`[data-ts-key="effort-bars-0:${id}"]`)
  const d = path?.getAttribute("d") ?? ""
  const xs = [...d.matchAll(/[MHL]([\d.]+)/g)].map((match) => Number(match[1]))
  const ys = [...d.matchAll(/[MV](?:[\d.]+,)?([\d.]+)/g)].map((match) => Number(match[1]))

  expect(path).not.toBeNull()

  return {
    left: Math.min(...xs) - 3,
    right: Math.max(...xs) + 3,
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}

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
          logMetrics={[]}
          onLogMetricChange={() => {}}
        />
      </QueryClientProvider>,
    )
  }

  it("switches to one group of bars per model and can go back to the scatter", async () => {
    const { container } = renderPriced()
    const bars = () => container.querySelectorAll('path[data-ts-key^="effort-bars-0:alpha-"]')

    expect(viewButton("Bars").getAttribute("aria-pressed")).toBe("true")
    expect(bars()).not.toHaveLength(0)
    expect(container.textContent).toContain("Models, sorted by token price")
    expect(screen.getByRole("img", { name: /^Bar chart of 2 models/ })).toBeTruthy()

    await act(async () => fireEvent.click(viewButton("Scatter")))

    expect(viewButton("Scatter").getAttribute("aria-pressed")).toBe("true")
    expect(bars()).toHaveLength(0)
    expect(screen.getByRole("img", { name: /^2D scatter plot/ })).toBeTruthy()
    // Token price does not trade off against Score the way task cost does.
    expect(screen.queryByRole("button", { name: "Pareto frontier" })).toBeNull()
  })

  it("offers no view switch when efforts spread along both axes", () => {
    renderPriced("cost")

    expect(screen.queryByRole("group", { name: "Chart view" })).toBeNull()
  })

  it("offers no log switch while bars stand on zero", async () => {
    renderPriced()

    expect(screen.queryByRole("button", { name: /^Log scale for/ })).toBeNull()

    await act(async () => fireEvent.click(viewButton("Scatter")))
    expect(screen.getByRole("button", { name: "Log scale for Token price" })).toBeTruthy()
  })

  it("describes the displayed bar axes, then restores the scatter description", async () => {
    const { container } = renderPriced()
    const description = () => container.querySelector("svg.ts-chart desc")?.textContent ?? ""

    expect(description()).toContain("Vertical axis: Score")
    expect(description()).toContain("Horizontal axis: one group of bars per model configuration")
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
          logMetrics={[]}
          onLogMetricChange={() => {}}
        />
      </QueryClientProvider>
    )
    const { rerender } = render(chart(false))

    await act(async () => fireEvent.click(viewButton("Scatter")))
    rerender(chart(true))
    expect(viewButton("Bars").getAttribute("aria-pressed")).toBe("true")
    await act(async () => fireEvent.click(viewButton("Scatter")))
    await act(async () => fireEvent.click(viewButton("Bars")))
    rerender(chart(false))
    expect(viewButton("Scatter").getAttribute("aria-pressed")).toBe("true")
    rerender(chart(true))
    expect(viewButton("Bars").getAttribute("aria-pressed")).toBe("true")
  })

  it("keeps dense bars readable by scrolling sideways rather than squeezing them", () => {
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
          logMetrics={[]}
          onLogMetricChange={() => {}}
        />
      </QueryClientProvider>,
    )
    const scroll = container.querySelector<HTMLElement>('[data-slot="chart-scroll"]')!
    const host = scroll.querySelector<HTMLElement>(":scope > *")!
    const expected = barsMinWidth(buildPlotData(crowd, { x: "price", y: "score" }))

    expect(scroll.className).toContain("overflow-x-auto")
    expect(host.style.minWidth).toBe(`${expected}px`)
    expect(expected).toBeGreaterThan(1000)
  })

  it("outlines only the focused bar, never the labels around it", async () => {
    const { container } = renderPriced()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!

    await focusPoint(svg, 1)
    await settle()

    const node = (key: string) => container.querySelector(`[data-ts-key="effort-bars-0:${key}"]`)

    expect(node("alpha-on-high")?.getAttribute("stroke")).toBe("var(--foreground)")
    expect(node("alpha-on-high")?.getAttribute("stroke-width")).toBe("1.5")
    expect(node("alpha-on-low")?.getAttribute("stroke")).toBeNull()
    expect(node("alpha-on-high:value")?.getAttribute("stroke")).toBeNull()
    expect(node("title")?.getAttribute("stroke")).toBeNull()
  })

  it("fades other groups' logos with their bars while a bar has focus", async () => {
    const client = new QueryClient()
    client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())
    const logoUrl = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E"
    const { container } = render(
      <QueryClientProvider client={client}>
        <ComparisonChart
          models={priced.map((model) => ({ ...model, logoUrl }))}
          sources={{ x: "artificialAnalysis", y: "deepswe" }}
          xMetric="price"
          yMetric="score"
          logMetrics={[]}
          onLogMetricChange={() => {}}
        />
      </QueryClientProvider>,
    )
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
    const logo = (model: string) => container.querySelector(`[data-ts-key$=":${model}:logo"]`)
    const opacity = (model: string) => Number(logo(model)?.getAttribute("opacity") ?? 1)

    expect(logo("alpha")).not.toBeNull()

    await focusPoint(svg, 1)
    await settle()

    expect(opacity("alpha")).toBe(1)
    expect(opacity("beta")).toBeLessThan(1)
    // The focused bar's outline stays on the bar.
    expect(logo("alpha")?.getAttribute("stroke")).toBeNull()
  })

  it("inspects a bar only while the pointer is on it, with its original values", async () => {
    const { container } = renderPriced()
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart")!
    const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number)
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width, height })
    const low = barBox(container, "alpha-on-low")
    const high = barBox(container, "alpha-on-high")
    const move = (clientX: number, clientY: number) =>
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

    // The gap between two efforts' bars belongs to neither.
    await move((low.right + high.left) / 2, low.bottom - 2)
    expect(tooltipText()).not.toContain("Alpha")
    await move((low.left + low.right) / 2, (low.top + low.bottom) / 2)
    expect(tooltipText()).toContain("Alpha")
    expect(tooltipText()).toContain("40%")
  })

  /**
   * The bar chart scrolled so `barId`'s top sits just above the viewport's bottom edge;
   * returns where the card was placed.
   */
  async function cardNearViewportBottom(barId: string, surface: { width: number; height: number }) {
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
      const box = barBox(container, barId)
      const x = (box.left + box.right) / 2
      const y = box.top + 2

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

      return { viewport, card, barTop: box.top - scrolled, top, left, hidden: element.hidden }
    } finally {
      for (const spy of restore) spy.mockRestore()
    }
  }

  it("keeps a bar's card on screen when the chart is scrolled, on a phone", async () => {
    const { viewport, card, barTop, top, left, hidden } = await cardNearViewportBottom(
      "beta-on-low",
      { width: 360, height: 1230 },
    )

    expect(hidden).toBe(false)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + card.height).toBeLessThanOrEqual(viewport.height)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + card.width).toBeLessThanOrEqual(viewport.width)
    // No room below the bar's top, so the card opens above it rather than past the screen edge.
    expect(top + card.height).toBeLessThanOrEqual(barTop)
  })

  it("keeps a bar's card on screen when the chart is scrolled, on desktop", async () => {
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

async function chooseShareItem(item: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
  })
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(item) }))
  })
}

/** jsdom has no clipboard or blob URLs, so a test lends them and puts back what was there. */
function lend(target: object, key: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(target, key)

  Object.defineProperty(target, key, { value, configurable: true })

  return () => {
    if (original) Object.defineProperty(target, key, original)
    else Reflect.deleteProperty(target, key)
  }
}

describe("share menu", () => {
  it("copies the page's link to this comparison and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const restore = lend(navigator, "clipboard", { writeText })

    try {
      renderChart(null, () => "https://example.test/?models=alpha")
      await chooseShareItem("Copy link")

      expect(writeText).toHaveBeenCalledWith("https://example.test/?models=alpha")
      expect(await screen.findByRole("button", { name: "Link copied" })).not.toBeNull()
    } finally {
      restore()
    }
  })

  it("reports a refused clipboard instead of claiming success", async () => {
    const restore = lend(navigator, "clipboard", {
      writeText: () => Promise.reject(new Error("denied")),
    })

    try {
      renderChart(null, () => "https://example.test/")
      await chooseShareItem("Copy link")

      expect(await screen.findByRole("button", { name: "Couldn't copy link" })).not.toBeNull()
    } finally {
      restore()
    }
  })

  it("downloads the plotted values as CSV", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:csv")
    const filenames: Array<string> = []
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLElement) {
        if (this instanceof HTMLAnchorElement) filenames.push(this.download)
      })

    const restoreCreate = lend(URL, "createObjectURL", createObjectURL)
    const restoreRevoke = lend(URL, "revokeObjectURL", () => {})

    try {
      renderChart()
      await chooseShareItem("Download data")

      expect(filenames).toEqual(["llm-graphs-score-vs-cost.csv"])
      expect(await createObjectURL.mock.calls[0][0].text()).toContain("Alpha,Alpha,low,2,40")
      expect(await screen.findByRole("button", { name: "CSV saved" })).not.toBeNull()
    } finally {
      click.mockRestore()
      restoreCreate()
      restoreRevoke()
    }
  })

  it("exports a standalone SVG that carries its logo masks and drops focus decoration", async () => {
    const logoUrl = "data:image/svg+xml,%3Csvg%2F%3E"
    const { container } = renderChart(null, undefined, [
      ...models,
      { ...makeModel({ model: "gamma", score: 70, costPerTask: 4 }), logoUrl },
    ])
    const frame = container.querySelector<HTMLElement>("[data-chart-frame]")!
    const { markup, width, height } = await standaloneChartSvg(frame, 2)
    const exported = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement
    const logo = exported.querySelector('rect[class^="chart-logo-"]')!
    const maskId = `${logo.getAttribute("class")}-mask`
    const [, , viewWidth, viewHeight] = exported.getAttribute("viewBox")!.split(" ").map(Number)

    expect([width, height]).toEqual([viewWidth, viewHeight])
    expect(exported.getAttribute("width")).toBe(String(viewWidth * 2))
    expect(exported.getAttribute("height")).toBe(String(viewHeight * 2))
    expect(exported.querySelector(`mask[id="${maskId}"] image`)?.getAttribute("href")).toBe(logoUrl)
    expect(exported.querySelector("style")?.textContent).toContain(`mask:url(#${maskId})`)
    expect(exported.querySelectorAll("[data-ts-focus-layer]")).toHaveLength(0)
    expect(exported.textContent).toContain("Gamma")
  })
})
