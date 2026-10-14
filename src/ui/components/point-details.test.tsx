// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Model } from "#/ui/lib/model-view"

import { ProvidersService } from "#/server/services/providers"
import { PointDetails } from "#/ui/components/point-details"
import { buildPlotData } from "#/ui/lib/comparison-plot-data"
import { metricRecord } from "#/ui/lib/metrics"
import { providersInfoQueryOptions } from "#/ui/lib/use-providers-info"

afterEach(cleanup)

function renderCard(updated: { score: string; costPerTask: string }) {
  const model: Model = {
    ...metricRecord<number | null>(() => null),
    model: "alpha",
    displayName: "Alpha",
    vendor: "alpha",
    releaseDate: null,
    chartColor: "oklch(0.62 0.15 339)",
    logoUrl: null,
    mode: "on",
    level: "high",
    effort: "high",
    effortOrder: 3,
    score: 60,
    costPerTask: 6,
    sources: {
      ...metricRecord<Model["sources"]["score"]>(() => null),
      score: "deepswe",
      costPerTask: "deepswe",
    },
    measurements: {
      score: { label: "Pass rate", updatedAt: `${updated.score}T00:00:00Z` },
      costPerTask: { label: "Cost", updatedAt: `${updated.costPerTask}T00:00:00Z` },
    },
  }
  const data = buildPlotData([model], { x: "cost", y: "score" })
  const client = new QueryClient()
  client.setQueryData(providersInfoQueryOptions.queryKey, ProvidersService.info())

  return render(
    <QueryClientProvider client={client}>
      <PointDetails axes={data.axes} metrics={data.metrics} point={data.points[0]} />
    </QueryClientProvider>,
  )
}

describe("point details", () => {
  it("states a date every measurement shares once, not under each row", () => {
    renderCard({ score: "2026-10-01", costPerTask: "2026-10-01" })

    expect(screen.getAllByText(/^Updated /)).toHaveLength(1)
    expect(screen.getByText("Updated 2026-10-01")).toBeTruthy()
  })

  it("keeps each row's date when they differ", () => {
    renderCard({ score: "2026-10-01", costPerTask: "2026-09-12" })

    expect(screen.getAllByText(/^Updated /).map((node) => node.textContent)).toEqual([
      "Updated 2026-09-12",
      "Updated 2026-10-01",
    ])
  })
})
