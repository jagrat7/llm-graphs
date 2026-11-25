import { RiLineChartLine } from "@remixicon/react"
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import type { PickableModel } from "#/ui/lib/model-view"

import { api, type ModelExamples } from "#/server/api"
import { CategoryTabs } from "#/ui/components/category-tabs"
import { DataState } from "#/ui/components/data-state"
import { ModelPicker } from "#/ui/components/model-picker"
import { PageShell } from "#/ui/components/page-shell"
import { buttonVariants } from "#/ui/components/ui/button"
import { XPostCard } from "#/ui/components/x-post-card"
import { APP_NAME } from "#/ui/lib/app-meta"
import { CATEGORY_GRAPHS, categoryGraphSearch, type CategoryKey } from "#/ui/lib/category-graphs"
import { logoDataUrl, vendorColor } from "#/ui/lib/model-view"
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
  head: () => ({ meta: [{ title: `Examples on X — ${APP_NAME}` }] }),
  component: ExamplesPage,
})

function ExamplesPage() {
  const { data: examples } = useSuspenseQuery(examplesQuery)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const options: Array<PickableModel> = (examples?.models ?? []).map((model) => ({
    model: model.id,
    displayName: model.name,
    vendor: model.vendor,
    releaseDate: model.releaseDate,
    chartColor: vendorColor(model),
    logoUrl: logoDataUrl(model.logo ?? undefined),
  }))
  const picked = (search.models ?? []).filter((id) => options.some((option) => option.model === id))
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
    <PageShell className="flex flex-col gap-10 pt-5 pb-12 max-sm:pt-3">
      <h1 className="sr-only">Examples on X</h1>
      <div className="flex flex-col">
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
          onChange={(models) =>
            void navigate({
              search: (previous) => ({
                ...previous,
                models: models.length > 0 ? models : undefined,
              }),
              replace: true,
              resetScroll: false,
            })
          }
          shortcut
          placeholder="Filter by model"
          className="mx-auto w-full max-w-md"
        />
      </div>
      {examples == null ? (
        <DataState className="min-h-80" title="X isn't answering right now." />
      ) : shown.length === 0 ? (
        <DataState className="min-h-80" title="No examples for these models yet." />
      ) : (
        shown.map((graph) => (
          <CategoryExamples
            key={graph.key}
            graph={graph}
            examples={examples}
            groups={groups.filter((group) => group.category === graph.key)}
            compare={withPosts.flatMap((group) =>
              group.category === graph.key ? group.models : [],
            )}
          />
        ))
      )}
    </PageShell>
  )
}

function CategoryExamples({
  graph,
  examples,
  groups,
  compare,
}: {
  graph: (typeof CATEGORY_GRAPHS)[number]
  examples: ModelExamples
  groups: ModelExamples["groups"]
  compare: ReadonlyArray<string>
}) {
  const info = useProvidersInfo()
  const search = categoryGraphSearch(graph, info)
  const posts = new Map(examples.posts.map((post) => [post.id, post]))

  return (
    <section aria-labelledby={`examples-${graph.key}`} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`examples-${graph.key}`} className="text-lg font-medium">
          {graph.label}
        </h2>
        {search ? (
          <Link
            to="/"
            search={{ ...search, models: [...new Set(compare)] }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <RiLineChartLine aria-hidden="true" />
            Compare on the chart
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {groups.flatMap((group) =>
          group.posts.flatMap((id) => {
            const post = posts.get(id)
            return post ? [<XPostCard key={id} post={post} label={group.label} />] : []
          }),
        )}
      </div>
    </section>
  )
}
