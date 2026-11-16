import { expect, test } from "vitest"

import { ProvidersService } from "#/server/services/providers"
import { activeCategoryGraph, CATEGORY_GRAPHS, categoryGraphSearch } from "./category-graphs"
import { axisSettings } from "./graph-state"

const info = ProvidersService.info()

test("every category opens a graph read from one of its own benchmarks", () => {
  for (const graph of CATEGORY_GRAPHS) {
    const search = categoryGraphSearch(graph, info)

    expect(search, graph.key).not.toBeNull()
    expect(info.sources[axisSettings(search!, info).y.source!].category).toBe(graph.category)
  }
})

test("coding opens on the default score benchmark", () => {
  expect(categoryGraphSearch(CATEGORY_GRAPHS[0], info)?.ySource).toBe(info.metricProviders.score[0])
})

test("a category's graph lights its own tab", () => {
  for (const graph of CATEGORY_GRAPHS) {
    const axes = axisSettings(categoryGraphSearch(graph, info)!, info)

    expect(activeCategoryGraph(axes, info)).toBe(graph.key)
  }
})

test("the tab stays lit on another benchmark of the category, and with another X", () => {
  const axes = axisSettings({ x: "duration", y: "score", ySource: "deepswe" }, info)

  expect(activeCategoryGraph(axes, info)).toBe("coding")
})

test("a chart no category describes lights no tab", () => {
  const axes = axisSettings({ x: "price", y: "score", ySource: "artificialAnalysis" }, info)

  expect(activeCategoryGraph(axes, info)).toBeNull()
})
