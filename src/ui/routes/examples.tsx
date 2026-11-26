import { RiLineChartLine } from "@remixicon/react"
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import type { PickableModel } from "#/ui/lib/model-view"

import { api, type ModelExamples, type XPost } from "#/server/api"
import { CategoryIcon, CategoryTabs } from "#/ui/components/category-tabs"
import { DataState } from "#/ui/components/data-state"
import { ModelLogo } from "#/ui/components/model-logo"
import { ModelPicker } from "#/ui/components/model-picker"
import { PageShell } from "#/ui/components/page-shell"
import { SourceLogo } from "#/ui/components/source-logo"
import { buttonVariants } from "#/ui/components/ui/button"
import { X_POST_ROW_CLASS, XPostCard } from "#/ui/components/x-post-card"
import { APP_NAME } from "#/ui/lib/app-meta"
import { CATEGORY_GRAPHS, categoryGraphSearch, type CategoryKey } from "#/ui/lib/category-graphs"
import { axisSettings } from "#/ui/lib/graph-state"
import { CHECK_ROW_CLASS } from "#/ui/lib/layout-styles"
import { formatMetric, METRIC_CONFIG, metricAxisLabel } from "#/ui/lib/metrics"
import { logoDataUrl, vendorColor } from "#/ui/lib/model-view"
import { sourceLabel } from "#/ui/lib/sources"
import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

const examplesQuery = queryOptions({
  queryKey: ["x-posts", "examples"],
  queryFn: () => api.xPosts.examples(),
  staleTime: 5 * 60 * 1000,
})

const CATEGORY_KEYS: ReadonlyArray<string> = CATEGORY_GRAPHS.map((graph) => graph.key)

function isCategory(value: unknown): value is CategoryKey {
  return typeof value === "string" && CATEGORY_KEYS.includes(value)
}

const examplesSearchSchema = z.object({
  category: z.catch(
    z.pipe(
      z.transform((value: unknown) => (isCategory(value) ? value : undefined)),
      z.optional(z.custom<CategoryKey>(isCategory)),
    ),
    undefined,
  ),
  models: z.catch(
    z.pipe(
      z.transform((value: unknown) => (typeof value === "string" ? [value] : value)),
      z.optional(z.array(z.string())),
    ),
    undefined,
  ),
})

export const Route = createFileRoute("/examples")({
  validateSearch: (search) => examplesSearchSchema.parse(search),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(examplesQuery)
  },
  head: () => ({
    meta: [
      { title: `Examples on X — ${APP_NAME}` },
      // X refuses a video request that names another site as its referrer.
      { name: "referrer", content: "same-origin" },
    ],
  }),
  component: ExamplesPage,
})

type ExampleModel = PickableModel & Pick<ModelExamples["models"][number], "best">
type ExampleGroup = ModelExamples["groups"][number]

const UNKNOWN_MODEL = { logoUrl: null, chartColor: vendorColor({ hue: null }) }

function shownModels(group: ExampleGroup, models: ReadonlyMap<string, ExampleModel>) {
  const names = group.label.split(" vs ")
  const oneNameEach = names.length === group.models.length

  return names.map((displayName, index) => ({
    ...(models.get(group.models[oneNameEach ? index : 0]) ?? UNKNOWN_MODEL),
    displayName,
  }))
}

function ExamplesPage() {
  const { data: examples } = useSuspenseQuery(examplesQuery)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const options: Array<ExampleModel> = (examples?.models ?? []).map((model) => ({
    model: model.id,
    displayName: model.name,
    vendor: model.vendor,
    releaseDate: model.releaseDate,
    chartColor: vendorColor(model),
    logoUrl: logoDataUrl(model.logo ?? undefined),
    best: model.best,
  }))
  const models = new Map(options.map((option) => [option.model, option]))
  const posts = new Map((examples?.posts ?? []).map((post) => [post.id, post]))
  const picked = (search.models ?? []).filter((id) => models.has(id))
  const withPosts = (examples?.groups ?? []).filter((group) => group.posts.length > 0)

  const groups = withPosts.filter(
    (group) => picked.length === 0 || group.models.some((model) => picked.includes(model)),
  )
  const shown = CATEGORY_GRAPHS.filter(
    (graph) =>
      (search.category == null || search.category === graph.key) &&
      groups.some((group) => group.category === graph.key),
  )
  return (
    <PageShell className="flex flex-col pt-5 pb-12 max-sm:pt-3">
      <h1 className="sr-only">Examples on X</h1>
      <CategoryTabs
        target="examples"
        only={CATEGORY_GRAPHS.flatMap((graph) =>
          withPosts.some((group) => group.category === graph.key) ? [graph.key] : [],
        )}
        active={search.category ?? null}
        unavailable={CATEGORY_GRAPHS.flatMap((graph) =>
          groups.some((group) => group.category === graph.key) ? [] : [graph.key],
        )}
      />
      <ModelPicker
        models={options}
        selected={picked}
        onChange={(next) =>
          void navigate({
            search: (previous) => ({ ...previous, models: next.length > 0 ? next : undefined }),
            replace: true,
            resetScroll: false,
          })
        }
        shortcut
        placeholder="Filter by model"
        className="mx-auto mb-4 min-h-[calc(var(--control-xl)+var(--chip)+0.5rem)] w-full max-w-md"
      />
      {examples == null ? (
        <DataState className="min-h-80" title="X isn't answering right now." />
      ) : shown.length === 0 ? (
        <DataState className="min-h-80" title="No examples for these models yet.">
          <Link to="/examples" className={cn(buttonVariants({ variant: "outline", size: "xl" }))}>
            All examples
          </Link>
        </DataState>
      ) : (
        shown.map((graph) => (
          <CategoryExamples
            key={graph.key}
            graph={graph}
            groups={groups.filter((group) => group.category === graph.key)}
            ranked={[
              ...new Set(
                withPosts.flatMap((group) => (group.category === graph.key ? group.models : [])),
              ),
            ].flatMap((id) => models.get(id) ?? [])}
            picked={picked}
            models={models}
            posts={posts}
          />
        ))
      )}
    </PageShell>
  )
}

function CategoryExamples({
  graph,
  groups,
  ranked,
  picked,
  models,
  posts,
}: {
  graph: (typeof CATEGORY_GRAPHS)[number]
  groups: ReadonlyArray<ExampleGroup>
  ranked: ReadonlyArray<ExampleModel>
  picked: ReadonlyArray<string>
  models: ReadonlyMap<string, ExampleModel>
  posts: ReadonlyMap<string, XPost>
}) {
  const info = useProvidersInfo()
  const search = categoryGraphSearch(graph, info)
  const source = search ? axisSettings(search, info).y.source : null
  const reading = (model: ExampleModel) =>
    (source ? model.best[source]?.[METRIC_CONFIG[graph.y].dataKey] : null) ?? null
  const headingId = `examples-${graph.key}`

  return (
    <section
      aria-labelledby={headingId}
      className="border-border/60 grid gap-x-10 gap-y-4 border-t py-6 lg:grid-cols-[15rem_minmax(0,1fr)]"
    >
      <div className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="text-title flex items-center gap-2 font-medium">
            <CategoryIcon category={graph.key} className="size-4" />
            {graph.label}
          </h2>
          {search ? (
            <Link
              to="/"
              search={{ ...search, models: ranked.map((model) => model.model) }}
              aria-label={`${graph.label} chart`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ms-auto")}
            >
              <RiLineChartLine aria-hidden="true" />
              Chart
            </Link>
          ) : null}
        </div>
        {source ? (
          <p className="text-muted-foreground text-control mt-3 flex flex-wrap justify-between gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1.5">
              <SourceLogo source={source} className="size-3" />
              {sourceLabel(source, info)}
            </span>
            {metricAxisLabel(graph.y, source, info)}
          </p>
        ) : null}
        <ul className="-mx-1.5 mt-1 grid gap-x-6 sm:max-lg:grid-cols-2">
          {ranked
            .toSorted((left, right) => (reading(right) ?? -Infinity) - (reading(left) ?? -Infinity))
            .map((model) => (
              <li key={model.model}>
                <Link
                  to="/examples"
                  search={(previous) => {
                    const next = picked.includes(model.model)
                      ? picked.filter((id) => id !== model.model)
                      : [...picked, model.model]

                    return { ...previous, models: next.length > 0 ? next : undefined }
                  }}
                  replace
                  resetScroll={false}
                  aria-current={picked.includes(model.model) ? "page" : undefined}
                  className={cn(
                    CHECK_ROW_CLASS,
                    "aria-[current=page]:bg-foreground/10 -outline-offset-2 transition-colors",
                  )}
                >
                  <ModelLogo
                    logoUrl={model.logoUrl}
                    color={model.chartColor}
                    className="size-3.5"
                  />
                  <span className="truncate">{model.displayName}</span>
                  <span className={cn(COUNT_TEXT_CLASS, "ms-auto shrink-0")}>
                    {formatMetric(reading(model), graph.y, source, info)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </div>
      <div className={X_POST_ROW_CLASS}>
        {groups.flatMap((group) =>
          group.posts.flatMap((id) => {
            const post = posts.get(id)

            return post
              ? [<XPostCard key={id} post={post} models={shownModels(group, models)} />]
              : []
          }),
        )}
      </div>
    </section>
  )
}
