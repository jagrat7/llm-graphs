// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { groupByVendor, ModelChecklist } from "#/ui/components/model-checklist"
import { metricRecord } from "#/ui/lib/metrics"

function makeModel(model: string, vendor: string | null, releaseDate: string | null): Model {
  return {
    ...metricRecord<number | null>(() => null),
    model,
    displayName: model,
    vendor,
    releaseDate,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: "unknown",
    level: "unknown",
    effort: "default",
    effortOrder: 0,
    sources: metricRecord<Model["sources"]["score"]>(() => null),
  }
}

describe("groupByVendor", () => {
  it("puts the busiest vendors first and vendorless models last", () => {
    const groups = groupByVendor([
      makeModel("stray", null, null),
      makeModel("mistral", "mistral", "2026-01-01"),
      makeModel("gpt-a", "openai", "2026-01-01"),
      makeModel("gpt-b", "openai", "2026-02-01"),
      makeModel("ds", "deepseek", "2026-01-01"),
    ])

    expect(groups.map((group) => group.label)).toEqual(["OpenAI", "DeepSeek", "Mistral", "Other"])
  })

  it("pins the headline labs ahead of busier vendors", () => {
    const groups = groupByVendor([
      makeModel("ds-a", "deepseek", null),
      makeModel("ds-b", "deepseek", null),
      makeModel("kimi", "moonshotai", null),
      makeModel("glm", "zhipuai", null),
      makeModel("gemini", "google", null),
      makeModel("gpt", "openai", null),
      makeModel("grok", "xai", null),
      makeModel("claude", "anthropic", null),
    ])

    expect(groups.map((group) => group.key)).toEqual([
      "anthropic",
      "openai",
      "xai",
      "zhipuai",
      "moonshotai",
      "google",
      "deepseek",
    ])
  })

  it("lists each vendor's newest release first, undated models last", () => {
    const [openai] = groupByVendor([
      makeModel("old", "openai", "2025-01-01"),
      makeModel("undated", "openai", null),
      makeModel("new", "openai", "2026-06-01"),
    ])

    expect(openai.models.map((model) => model.model)).toEqual(["new", "old", "undated"])
  })
})

function vendorHeadings() {
  return screen.getAllByRole("heading").map((heading) => heading.textContent)
}

describe("model checklist providers", () => {
  afterEach(cleanup)

  const vendors = [
    "anthropic",
    "openai",
    "xai",
    "zhipuai",
    "moonshotai",
    "google",
    "deepseek",
    "mistral",
  ]
  const groups = groupByVendor(vendors.map((vendor) => makeModel(vendor, vendor, null)))

  it("opens on six providers and reveals the rest on request", () => {
    render(<ModelChecklist groups={groups} selected={new Set()} onToggle={() => {}} />)

    expect(vendorHeadings()).toEqual([
      "Anthropic",
      "OpenAI",
      "xAI",
      "Zhipu AI",
      "Moonshot AI",
      "Google",
    ])

    fireEvent.click(screen.getByRole("button", { name: "2 more providers" }))

    expect(vendorHeadings()).toHaveLength(8)
    expect(screen.getByRole("button", { name: "Fewer providers" })).toHaveProperty(
      "ariaExpanded",
      "true",
    )
  })

  it("keeps a provider with a selected model in view", () => {
    render(<ModelChecklist groups={groups} selected={new Set(["mistral"])} onToggle={() => {}} />)

    expect(vendorHeadings()).toContain("Mistral1 selected")
    expect(screen.getByRole("button", { name: "1 more provider" })).toBeTruthy()
  })
})

describe("model checklist kept rows", () => {
  afterEach(cleanup)

  it("keeps an unchecked row and its vendor in place until the list closes", () => {
    const groups = groupByVendor([
      ...["anthropic", "openai", "xai", "zhipuai", "moonshotai", "google"].map((vendor) =>
        makeModel(vendor, vendor, null),
      ),
      makeModel("ds-1", "deepseek", "2026-04-01"),
      makeModel("ds-2", "deepseek", "2026-03-01"),
      makeModel("ds-3", "deepseek", "2026-02-01"),
      makeModel("ds-old", "deepseek", "2026-01-01"),
    ])
    const element = (selected: Array<string>) => (
      <ModelChecklist groups={groups} selected={new Set(selected)} onToggle={() => {}} />
    )
    const view = render(element(["ds-old"]))

    fireEvent.click(screen.getByRole("checkbox", { name: "ds-old" }))
    view.rerender(element([]))

    expect(screen.getByRole("checkbox", { name: "ds-old" })).toHaveProperty("ariaChecked", "false")
    expect(screen.getByRole("heading", { name: "DeepSeek" })).toBeTruthy()
  })
})
