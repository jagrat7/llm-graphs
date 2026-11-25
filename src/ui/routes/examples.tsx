import { RiLineChartLine } from "@remixicon/react"
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { api, type ModelExamples } from "#/server/api"
import { DataState } from "#/ui/components/data-state"
import { PageShell } from "#/ui/components/page-shell"
import { buttonVariants } from "#/ui/components/ui/button"
import { XPostCard } from "#/ui/components/x-post-card"
import { APP_NAME } from "#/ui/lib/app-meta"
import { CATEGORY_GRAPHS, categoryGraphSearch } from "#/ui/lib/category-graphs"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

const examplesQuery = queryOptions({
  queryKey: ["x-posts", "examples"],
  queryFn: () => api.xPosts.examples(),
  staleTime: Infinity,
})

export const Route = createFileRoute("/examples")({
  loader: ({ context }) => context.queryClient.ensureQueryData(examplesQuery),
  head: () => ({ meta: [{ title: `Examples on X — ${APP_NAME}` }] }),
  component: ExamplesPage,
})

function ExamplesPage() {
  const { data: examples } = useSuspenseQuery(examplesQuery)

  return (
    <PageShell className="flex flex-col gap-10 pt-6 pb-12 max-sm:pt-4">
      <h1 className="sr-only">Examples on X</h1>
      {examples ? (
        CATEGORY_GRAPHS.map((graph) => (
          <CategoryExamples
            key={graph.key}
            graph={graph}
            examples={examples}
            groups={examples.groups.filter((group) => group.category === graph.key)}
          />
        ))
      ) : (
        <DataState className="min-h-80" title="X isn't answering right now." />
      )}
    </PageShell>
  )
}

function CategoryExamples({
  graph,
  examples,
  groups,
}: {
  graph: (typeof CATEGORY_GRAPHS)[number]
  examples: ModelExamples
  groups: ModelExamples["groups"]
}) {
  const info = useProvidersInfo()
  if (groups.length === 0) return null

  const search = categoryGraphSearch(graph, info)
  const posts = new Map(examples.posts.map((post) => [post.id, post]))

  return (
    <section aria-labelledby={`examples-${graph.key}`} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`examples-${graph.key}`} className="text-lg font-medium">
          {graph.label}
        </h2>
        {search ? (
          <Link
            to="/"
            search={{ ...search, models: groups.flatMap((group) => group.models) }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <RiLineChartLine aria-hidden="true" />
            Compare on the chart
          </Link>
        ) : null}
      </div>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-sm font-medium">{group.label}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {group.posts.flatMap((id) => {
              const post = posts.get(id)
              return post ? [<XPostCard key={id} post={post} />] : []
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
