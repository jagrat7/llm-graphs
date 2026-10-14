import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense, useMemo, useState } from "react"
import { z } from "zod"

import type { AxisKey, AxisSetting } from "#/ui/components/axis-controls"
import type { MorphPhase } from "#/ui/components/comparison-chart-3d"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"

import { AxisControls } from "#/ui/components/axis-controls"
import { ChartSkeleton } from "#/ui/components/chart-skeleton"
import { DataError, DataState } from "#/ui/components/data-state"
import { ModelPicker } from "#/ui/components/model-picker"
import { PageShell } from "#/ui/components/page-shell"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { METRICS, METRIC_CONFIG } from "#/ui/lib/metrics"
import {
  axisSettings,
  axisBindings,
  AXIS_SOURCE_KEY,
  unavailableMetrics,
  compatibleComparison,
  hasMeaningfulComparison,
} from "#/ui/lib/graph-state"
import { buildPlotData, plotQuality } from "#/ui/lib/comparison-plot-data"
import { Alert, AlertTitle } from "#/ui/components/ui/alert"
import { Button } from "#/ui/components/ui/button"
import { defaultPicks, offeredVariants } from "#/ui/lib/model-view"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { useModelSnapshot } from "#/ui/lib/use-model-snapshot"
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
const sourceSchema = z.string().optional().catch(undefined)
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
  validateSearch: (search) => {
    const parsed = compareSearchSchema.parse(search)
    // Existing links explicitly selecting AA's old Cost meant token pricing.
    for (const axis of ["x", "y", "z"] as const) {
      if (parsed[axis] === "cost" && parsed[AXIS_SOURCE_KEY[axis]] === "artificialAnalysis") {
        parsed[axis] = "price"
      }
    }
    return parsed
  },
  component: ComparePage,
})

function ComparePage() {
  const info = useProvidersInfo()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const reduceMotion = useReducedMotion()
  const axes = axisSettings(search, info)
  const unavailable = unavailableMetrics(axes, info)
  const { data: snapshot, isPending, isError } = useModelSnapshot()
  // Changing an axis source re-filters the page-load snapshot; nothing is refetched.
  const data = useMemo(() => {
    if (!snapshot) return undefined

    const viewAxes = axisSettings(search, info)
    const models = offeredVariants(snapshot, axisBindings(viewAxes, info))
    const scoreSource =
      Object.values(viewAxes).find((axis) => axis.metric === "score")?.source ?? null

    return {
      models,
      defaultModels: defaultPicks(
        snapshot,
        models,
        scoreSource,
        info,
        axisBindings(viewAxes, info).map((binding) => binding.metric),
      ),
    }
  }, [snapshot, info, search])
  // Distinguishes "user just added Z" (animate the cube open) from a deep link (start solved).
  const [morphPhase, setMorphPhase] = useState<MorphPhase>("instant")

  function updateSearch(update: Partial<typeof search>) {
    void navigate({
      search: (previous) => ({ ...previous, ...update }),
      replace: true,
    })
  }

  function handleSourceChange(axis: AxisKey, source: ProviderName) {
    const next = { ...search, [AXIS_SOURCE_KEY[axis]]: source }
    const compatible = snapshot ? compatibleComparison(next, info, snapshot) : next
    setMorphPhase("instant")
    updateSearch({
      ...compatible,
      z: compatible.z,
      xSource: compatible.xSource,
      ySource: compatible.ySource,
      zSource: compatible.zSource,
      models: undefined,
    })
  }

  const unavailableChoices = useMemo(() => {
    const choices = (axis: AxisKey) =>
      snapshot
        ? METRICS.filter((metric) => {
            if (search[axis] === metric) return false
            const candidate = { ...search, [axis]: metric, [AXIS_SOURCE_KEY[axis]]: undefined }
            return !hasMeaningfulComparison(candidate, info, snapshot)
          })
        : []
    return { x: choices("x"), y: choices("y"), z: choices("z") }
  }, [search, info, snapshot])

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
  const quality = plotQuality(
    buildPlotData(selectedModels, { x: search.x, y: search.y, z: search.z }),
  )
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
        unavailableMetrics={unavailableChoices}
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
            unavailable.length > 0
              ? `${unavailable.map(({ metric }) => METRIC_CONFIG[metric!].label).join(" and ")} unavailable for this score benchmark`
              : data.models.length === 0
                ? "No model configurations have all selected metrics"
                : selected.length === 0
                  ? "Select models to compare"
                  : "No selected models are available"
          }
        >
          <p className="text-muted-foreground mx-auto mb-3 max-w-sm text-sm">
            {unavailable.length > 0
              ? "This benchmark does not publish these measurements. Compare token price instead, or choose another score source."
              : "Only matching measured configurations can be compared. Try different metrics or restore the default comparison."}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              updateSearch(
                unavailable.length > 0
                  ? {
                      x: "price",
                      y: "score",
                      z: undefined,
                      xSource: undefined,
                      ySource:
                        Object.values(axes).find((axis) => axis.metric === "score")?.source ??
                        undefined,
                      zSource: undefined,
                      models: undefined,
                    }
                  : {
                      x: "cost",
                      y: "score",
                      z: undefined,
                      xSource: undefined,
                      ySource: undefined,
                      zSource: undefined,
                      models: undefined,
                    },
              )
            }
          >
            {unavailable.length > 0 ? "Compare token price" : "Restore default comparison"}
          </Button>
          <ModelPicker
            models={data.models}
            selected={selected}
            onChange={(models) => updateSearch({ models })}
            className="mx-auto max-w-sm"
          />
        </DataState>
      ) : null}
      {data && selectedModels.length > 0 && !quality.meaningful ? (
        <Alert className="mb-3">
          <AlertTitle>
            {quality.flatAxes.length > 0
              ? `No variation on ${quality.flatAxes.map((axis) => `${axis.toUpperCase()} (${METRIC_CONFIG[search[axis]!].label})`).join(" and ")}. Add models with different measured values or change metrics.`
              : "Select at least two models for a meaningful comparison."}
          </AlertTitle>
        </Alert>
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
