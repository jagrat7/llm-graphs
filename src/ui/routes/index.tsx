import type { QueryClient } from "@tanstack/react-query"

import { queryOptions, useQuery } from "@tanstack/react-query"
import { ClientOnly, createFileRoute, useRouter } from "@tanstack/react-router"
import { createIsomorphicFn } from "@tanstack/react-start"
import { lazy, Suspense, useMemo, useState } from "react"
// The browser parses search params with this, so it uses zod's tree-shakeable build.
import { z } from "zod/mini"

import type { AxisKey, AxisSetting } from "#/ui/components/axis-controls"
import type { MorphPhase } from "#/ui/components/comparison-chart-3d"
import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName, ProvidersInfo } from "#/server/api"
import type { GraphSearch } from "#/ui/lib/graph-state"
import type { PickedModels } from "#/ui/lib/picked-models"
import type { ComparisonSettings } from "#/ui/lib/comparison-view"

import { AxisControls } from "#/ui/components/axis-controls"
import { ChartSkeleton } from "#/ui/components/chart-skeleton"
import { ComparisonChart } from "#/ui/components/comparison-chart"
import { DataError, DataState } from "#/ui/components/data-state"
import { ModelPicker } from "#/ui/components/model-picker"
import { PageShell } from "#/ui/components/page-shell"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { METRICS, METRIC_CONFIG } from "#/ui/lib/metrics"
import {
  axisSettings,
  AXIS_SOURCE_KEY,
  unavailableMetrics,
  compatibleComparison,
  hasMeaningfulComparison,
  scoreSourceOf,
  shareSources,
  upgradeLegacySearch,
} from "#/ui/lib/graph-state"
import { buildPlotData, plotQuality } from "#/ui/lib/comparison-plot-data"
import { Alert, AlertTitle } from "#/ui/components/ui/alert"
import { Button } from "#/ui/components/ui/button"
import { comparisonModels, comparisonSlice } from "#/ui/lib/comparison-view"
import { readPickedModels, savePickedModels, usePickedModels } from "#/ui/lib/picked-models"
import { highestEffortOnly, useSettings } from "#/ui/lib/settings"
import { providersInfoQueryOptions, useProvidersInfo } from "#/ui/lib/use-providers-info"
import { api } from "#/server/api"
import { fetchModelSnapshot } from "#/ui/lib/model-snapshot"
import { useReducedMotion } from "#/ui/lib/use-reduced-motion"

// three.js is the largest chunk in the app and only `?z=` needs it, so it loads on demand.
const ComparisonChart3D = lazy(() =>
  import("#/ui/components/comparison-chart-3d").then((module) => ({
    default: module.ComparisonChart3D,
  })),
)

/** Every model and its metrics. Never stale, so the data on screen only changes on reload. */
const snapshotQuery = queryOptions({
  queryKey: ["models", "snapshot"],
  queryFn: () => fetchModelSnapshot(),
  staleTime: Infinity,
  gcTime: Infinity,
})

type ComparisonRequest = {
  info: ProvidersInfo
  search: GraphSearch
  picks: PickedModels
  settings: ComparisonSettings
}

/**
 * The server sends only what the first render draws, so the HTML stays small; the browser
 * fetches the whole snapshot once it has hydrated. A browser navigation waits for that fetch,
 * which by then has usually finished.
 */
const loadComparison = createIsomorphicFn()
  .server(async (_queryClient: QueryClient, { info, search, picks, settings }: ComparisonRequest) =>
    comparisonSlice(await api.models.snapshot(), info, search, picks, settings),
  )
  .client(async (queryClient: QueryClient) => {
    await queryClient.query(snapshotQuery)
    return null
  })

const metricSchema = z.enum(METRICS)
const sourceSchema = z.catch(z.optional(z.string()), undefined)
const compareSearchSchema = z.object({
  x: z.catch(metricSchema, "cost"),
  xSource: sourceSchema,
  y: z.catch(metricSchema, "score"),
  ySource: sourceSchema,
  /** Absent while the chart is two-dimensional; present switches it to the cube. */
  z: z.catch(z.optional(metricSchema), undefined),
  zSource: sourceSchema,
  models: z.catch(
    z.pipe(
      z.transform((value: unknown) => (typeof value === "string" ? [value] : value)),
      z.optional(z.array(z.string())),
    ),
    undefined,
  ),
})

export const Route = createFileRoute("/")({
  validateSearch: (search) => upgradeLegacySearch(compareSearchSchema.parse(search)),
  loaderDeps: ({ search }) => ({ search }),
  // The picks and settings come from the request's cookies, so the first HTML already shows
  // this reader's own comparison. A failure is left to the page's own error state.
  loader: async ({ context, deps: { search } }) => {
    const savedPicks = await readPickedModels()
    const slice = await loadComparison(context.queryClient, {
      info: await context.queryClient.ensureQueryData(providersInfoQueryOptions),
      search,
      picks: search.models ?? savedPicks,
      settings: context.savedSettings,
    }).catch(() => null)

    return { savedPicks, slice }
  },
  component: ComparePage,
})

function ComparePage() {
  const info = useProvidersInfo()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const axes = axisSettings(search, info)
  const unavailable = unavailableMetrics(axes, info)
  const { savedPicks, slice } = Route.useLoaderData()
  // Starts once the page has hydrated: the server never fetches it, so it stays out of the HTML.
  const { data: snapshot, isError } = useQuery(snapshotQuery)
  const [settings, setSettings] = useSettings()
  const { hiddenProviders, vendorLogos, effortLevels } = settings
  // Changing an axis source re-filters the whole snapshot; nothing is refetched. Until it
  // arrives, the server's slice draws the opening chart with the picks it worked out.
  const data = useMemo(() => {
    const comparisonSettings = { hiddenProviders }

    if (snapshot) return comparisonModels(snapshot, info, search, comparisonSettings)
    if (!slice) return undefined

    return {
      models: comparisonModels(slice.snapshot, info, search, comparisonSettings).models,
      defaultModels: slice.defaultModels,
    }
  }, [snapshot, slice, info, search, hiddenProviders])
  const isPending = !data && !isError
  // Distinguishes "user just added Z" (animate the cube open) from a deep link (start solved).
  const [morphPhase, setMorphPhase] = useState<MorphPhase>("instant")
  const [highlightedModel, setHighlightedModel] = useState<string | null>(null)
  // Saved here or in another tab; a shared link's models still override them below.
  const pickedModels = usePickedModels(savedPicks)

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

  // A shared link's models win, then this browser's own picks, then the benchmark's defaults.
  const selected = useMemo(
    () => search.models ?? pickedModels ?? data?.defaultModels ?? [],
    [search.models, pickedModels, data],
  )

  /** Picks are entry ids, so they carry across benchmarks; ones a benchmark lacks wait unseen. */
  function pickModels(models: Array<string>) {
    void savePickedModels(models)
    updateSearch({ models })
  }

  function resetModels() {
    void savePickedModels(null)
    updateSearch({ models: undefined })
  }

  // Memoized so hovering a pill re-renders the page without handing the chart new models.
  const selectedModels = useMemo(() => {
    const ids = new Set(selected)

    const picked = data?.models.filter((model) => ids.has(model.model)) ?? []

    return effortLevels === "highest" ? highestEffortOnly(picked) : picked
  }, [data, selected, effortLevels])
  // Without logos, every point falls back to the plain dot the chart draws for a logoless vendor.
  const chartModels = useMemo(
    () =>
      vendorLogos ? selectedModels : selectedModels.map((model) => ({ ...model, logoUrl: null })),
    [selectedModels, vendorLogos],
  )
  /**
   * Pins the models and sources on screen, so the link keeps showing this comparison
   * after the default picks or default benchmarks move on.
   */
  function shareLink() {
    const location = router.buildLocation({
      to: "/",
      search: {
        ...search,
        ...shareSources(search, info),
        models: selected,
      },
    })

    return new URL(location.href, window.location.origin).href
  }
  const quality = useMemo(
    () => plotQuality(buildPlotData(selectedModels, { x: search.x, y: search.y, z: search.z })),
    [selectedModels, search.x, search.y, search.z],
  )
  // The list can highlight models that are not on the chart; those emphasise nothing.
  const highlight =
    highlightedModel != null && selected.includes(highlightedModel) ? highlightedModel : null
  const controlsDisabled = !data
  const picker = (
    <ModelPicker
      models={data?.models ?? []}
      selected={selected}
      onChange={pickModels}
      onReset={search.models || pickedModels ? resetModels : undefined}
      onHighlightChange={setHighlightedModel}
      disabled={controlsDisabled}
      shortcut
      className="min-[56rem]:w-80"
    />
  )

  /** Why the chart is empty, and the one action that gets it back. */
  function emptyState(): {
    title: string
    hint?: string
    action: string
    onAction: () => void
  } | null {
    if (!data || selectedModels.length > 0) return null

    if (unavailable.length > 0) {
      return {
        title: `${unavailable.map(({ metric }) => METRIC_CONFIG[metric!].label).join(" and ")} unavailable for this score benchmark`,
        hint: "Pick another score source, or compare token price.",
        action: "Compare token price",
        onAction: () =>
          updateSearch({
            x: "price",
            y: "score",
            z: undefined,
            xSource: undefined,
            ySource: scoreSourceOf(axes) ?? undefined,
            zSource: undefined,
          }),
      }
    }

    if (data.models.length === 0 && hiddenProviders.length > 0) {
      return {
        title: "No models from the providers you have on",
        action: "Turn all providers on",
        onAction: () => setSettings((current) => ({ ...current, hiddenProviders: [] })),
      }
    }

    return {
      title:
        data.models.length === 0
          ? "No models have all selected metrics"
          : selected.length === 0
            ? "Select models to compare"
            : "No selected models are available",
      action: "Restore default comparison",
      onAction: () => {
        void savePickedModels(null)
        updateSearch({
          x: "cost",
          y: "score",
          z: undefined,
          xSource: undefined,
          ySource: undefined,
          zSource: undefined,
          models: undefined,
        })
      },
    }
  }
  const empty = emptyState()

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
      {isError && !data ? (
        <DataError className={CHART_HEIGHT_CLASS}>Unable to load model data</DataError>
      ) : null}
      {empty ? (
        <DataState className={CHART_HEIGHT_CLASS} title={empty.title}>
          {empty.hint ? (
            <p className="text-muted-foreground mx-auto mb-3 max-w-sm text-sm">{empty.hint}</p>
          ) : null}
          <Button variant="outline" onClick={empty.onAction}>
            {empty.action}
          </Button>
          {data && data.models.length > 0 ? (
            <ModelPicker
              models={data.models}
              selected={selected}
              onChange={pickModels}
              className="mx-auto max-w-sm"
            />
          ) : null}
        </DataState>
      ) : null}
      {data && selectedModels.length > 0 && !quality.meaningful ? (
        <Alert className="mb-3">
          <AlertTitle>
            {quality.flatAxes.length > 0
              ? `Every model has the same ${quality.flatAxes.map((axis) => METRIC_CONFIG[search[axis]!].label.toLowerCase()).join(" and ")}. Add models or change metrics.`
              : "Select at least two models to compare."}
          </AlertTitle>
        </Alert>
      ) : null}
      {data && selectedModels.length > 0 ? (
        <Suspense fallback={<ChartSkeleton />}>
          {search.z ? (
            <ComparisonChart3D
              models={chartModels}
              metrics={{ x: search.x, y: search.y, z: search.z }}
              sources={{ x: axes.x.source, y: axes.y.source, z: axes.z.source }}
              phase={morphPhase}
              onExitComplete={handleExitComplete}
              getShareLink={shareLink}
            />
          ) : (
            // Sized from its container, which the server can't measure: drawn there, it
            // comes out at a guessed size and jumps once the browser redraws it.
            <ClientOnly fallback={<ChartSkeleton />}>
              <ComparisonChart
                models={chartModels}
                sources={{ x: axes.x.source, y: axes.y.source }}
                xMetric={search.x}
                yMetric={search.y}
                highlight={highlight}
                getShareLink={shareLink}
              />
            </ClientOnly>
          )}
        </Suspense>
      ) : null}
    </PageShell>
  )
}
