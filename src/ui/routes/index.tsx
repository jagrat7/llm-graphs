import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense, useState } from "react"
import { z } from "zod"

import type { AxisKey, AxisSetting, AxisState } from "#/ui/components/axis-controls"
import type { MorphPhase } from "#/ui/components/comparison-chart-3d"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"

import { AxisControls } from "#/ui/components/axis-controls"
import { ChartSkeleton } from "#/ui/components/chart-skeleton"
import { DataError, DataState } from "#/ui/components/data-state"
import { ModelPicker } from "#/ui/components/model-picker"
import { PageShell } from "#/ui/components/page-shell"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { METRICS, METRIC_CONFIG, resolveSource } from "#/ui/lib/metrics"
import { isSource } from "#/ui/lib/sources"
import { useModels } from "#/ui/lib/use-models"
import { useReducedMotion } from "#/ui/lib/use-reduced-motion"

const ComparisonChart = lazy(() =>
  import("#/ui/components/comparison-chart").then((module) => ({
    default: module.ComparisonChart,
  })),
)
const ComparisonChart3D = lazy(() =>
  import("#/ui/components/comparison-chart-3d").then((module) => ({
    default: module.ComparisonChart3D,
  })),
)

const metricSchema = z.enum(METRICS)
const sourceSchema = z
  .string()
  .refine((value): value is ProviderName => isSource(value))
  .optional()
  .catch(undefined)
const compareSearchSchema = z.object({
  x: metricSchema.catch("cost").default("cost"),
  xSource: sourceSchema,
  y: metricSchema.catch("score").default("score"),
  ySource: sourceSchema,
  /** Absent while the chart is two-dimensional; present switches it to the cube. */
  z: metricSchema.optional().catch(undefined),
  zSource: sourceSchema,
  models: z
    .preprocess(
      (value) => (typeof value === "string" ? [value] : value),
      z.array(z.string()).optional(),
    )
    .catch(undefined),
})

export const Route = createFileRoute("/")({
  validateSearch: (search) => compareSearchSchema.parse(search),
  component: ComparePage,
})

/** Each axis parks its source override under its own search param. */
const AXIS_SOURCE_KEY = { x: "xSource", y: "ySource", z: "zSource" } as const

function axisSetting(metric: Metric | null, source: ProviderName | undefined): AxisSetting {
  return { metric, source: metric == null ? null : resolveSource(metric, source) }
}

function ComparePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const reduceMotion = useReducedMotion()
  const axes: AxisState = {
    x: axisSetting(search.x, search.xSource),
    y: axisSetting(search.y, search.ySource),
    z: axisSetting(search.z ?? null, search.zSource),
  }
  const { data, isPending, isError } = useModels()
  // Distinguishes "user just added Z" (animate the cube open) from a deep link (start solved).
  const [morphPhase, setMorphPhase] = useState<MorphPhase>("instant")

  function updateSearch(update: Partial<typeof search>) {
    void navigate({
      search: (previous) => ({ ...previous, ...update }),
      replace: true,
    })
  }

  function handleSourceChange(axis: AxisKey, source: ProviderName) {
    updateSearch({ [AXIS_SOURCE_KEY[axis]]: source })
  }

  /** Changing a metric drops its source override so the new metric starts on its own default. */
  function handleMetricChange(axis: AxisKey, metric: Metric | null) {
    if (axis === "z") {
      if (metric == null) {
        if (reduceMotion) handleExitComplete()
        else setMorphPhase("out")
        return
      }

      if (search.z == null) setMorphPhase("in")
      updateSearch({ z: metric, zSource: undefined })
      return
    }

    if (metric == null) return
    updateSearch(
      axis === "x" ? { x: metric, xSource: undefined } : { y: metric, ySource: undefined },
    )
  }

  function handleAxisChange(axis: AxisKey, change: Partial<AxisSetting>) {
    if (change.source != null) {
      handleSourceChange(axis, change.source)
      return
    }

    if ("metric" in change) handleMetricChange(axis, change.metric ?? null)
  }

  /** Both axes are filled before the hinge that calls this is offered at all. */
  function handleSwapAxes(first: AxisKey, second: AxisKey) {
    const firstMetric = search[first]
    const secondMetric = search[second]
    if (firstMetric == null || secondMetric == null) return

    const update: Partial<typeof search> = {}
    update[first] = secondMetric
    update[second] = firstMetric
    update[AXIS_SOURCE_KEY[first]] = search[AXIS_SOURCE_KEY[second]]
    update[AXIS_SOURCE_KEY[second]] = search[AXIS_SOURCE_KEY[first]]
    updateSearch(update)
  }

  function handleExitComplete() {
    setMorphPhase("instant")
    updateSearch({ z: undefined, zSource: undefined })
  }

  const selected = search.models ?? data?.defaultModels ?? []
  const selectedModelIds = new Set(selected)
  const selectedModels = data?.models.filter((model) => selectedModelIds.has(model.model)) ?? []
  const controlsDisabled = isPending ? true : isError
  const picker = (
    <ModelPicker
      models={data?.models ?? []}
      selected={selected}
      onChange={(models) => updateSearch({ models })}
      disabled={controlsDisabled}
      className="sm:w-80"
    />
  )

  return (
    <PageShell className="pt-8 pb-6">
      <h1 className="sr-only">Compare language models</h1>
      <AxisControls
        axes={axes}
        onAxisChange={handleAxisChange}
        onSwapAxes={handleSwapAxes}
        disabled={controlsDisabled}
      >
        {picker}
      </AxisControls>
      <p aria-live="polite" className="sr-only">
        {search.z ? `3D chart, depth axis ${METRIC_CONFIG[search.z].label}` : "2D chart, two axes"}
      </p>

      {isPending ? <ChartSkeleton /> : null}
      {isError ? (
        <DataError className={CHART_HEIGHT_CLASS}>Unable to load model data</DataError>
      ) : null}
      {data && selectedModels.length === 0 ? (
        <DataState
          className={CHART_HEIGHT_CLASS}
          title={
            selected.length === 0 ? "Select models to compare" : "No selected models are available"
          }
        >
          <ModelPicker
            models={data.models}
            selected={selected}
            onChange={(models) => updateSearch({ models })}
            className="mx-auto max-w-sm"
          />
        </DataState>
      ) : null}
      {data && selectedModels.length > 0 ? (
        <Suspense fallback={<ChartSkeleton />}>
          {search.z ? (
            <ComparisonChart3D
              models={selectedModels}
              metrics={{ x: search.x, y: search.y, z: search.z }}
              sources={{ x: axes.x.source, y: axes.y.source, z: axes.z.source }}
              phase={morphPhase}
              onExitComplete={handleExitComplete}
            />
          ) : (
            <ComparisonChart
              models={selectedModels}
              sources={{ x: axes.x.source, y: axes.y.source }}
              xMetric={search.x}
              yMetric={search.y}
            />
          )}
        </Suspense>
      ) : null}
    </PageShell>
  )
}
