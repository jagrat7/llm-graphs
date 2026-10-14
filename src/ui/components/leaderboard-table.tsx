import type { SortingState } from "@tanstack/react-table"
import type { CSSProperties } from "react"

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { RiArrowDownLine, RiArrowUpDownLine, RiArrowUpLine } from "@remixicon/react"
import { useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { ModelLogo } from "#/ui/components/model-logo"
import { SourceLogo } from "#/ui/components/source-logo"
import { Button } from "#/ui/components/ui/button"
import { Progress } from "#/ui/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/ui/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"
import { BELOW_HEADER_OFFSET_CLASS, TABLE_WIDTH_CLASS } from "#/ui/lib/layout-styles"
import { formatMetric, METRIC_CONFIG } from "#/ui/lib/metrics"
import { sourceLabel as providerLabel } from "#/ui/lib/sources"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

const columnHelper = createColumnHelper<Model>()
const RIGHT_ALIGNED_COLUMN_IDS = new Set([
  "score",
  "costPerTask",
  "tokensPerSecond",
  "durationSeconds",
  "source",
])
/** The first column stays put while the rest scrolls, until the viewport can hold the whole table. */
const STICKY_COLUMN_CLASS = "sticky left-0 z-10 bg-background lg:static"

type BarStyle = CSSProperties & { "--bar": string }

function modelSources(model: Model) {
  return [...new Set(Object.values(model.sources).filter((source) => source != null))]
}

function renderModelCell({ row, getValue }: { row: { original: Model }; getValue: () => string }) {
  const effortLabel = row.original.effort === "default" ? "" : ` [${row.original.effort}]`
  const modelLabel = `${getValue()}${effortLabel}`

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="flex w-48 max-w-48 items-center gap-2 text-left" />}>
        <ModelLogo logoUrl={row.original.logoUrl} className="text-muted-foreground size-3.5" />
        <div className="truncate">
          <span className="text-foreground font-medium">{getValue()}</span>
          {effortLabel ? (
            <span className="text-muted-foreground ml-1.5">{effortLabel.trim()}</span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent>{modelLabel}</TooltipContent>
    </Tooltip>
  )
}

function renderScoreCell({
  row,
  getValue,
}: {
  row: { original: Model }
  getValue: () => number | null
}) {
  const score = getValue()
  const barStyle: BarStyle = { "--bar": row.original.chartColor }

  return (
    <div className="ml-auto flex min-w-40 items-center justify-end gap-3">
      <span className="w-12 text-right">{formatMetric(score, "score")}</span>
      <Progress
        value={Math.max(0, Math.min(100, score ?? 0))}
        aria-label={`Score ${formatMetric(score, "score")}`}
        className="flex-1 [&_[data-slot=progress-indicator]]:bg-(--bar)"
        style={barStyle}
      />
    </div>
  )
}

function RenderSourceCell({ row }: { row: { original: Model } }) {
  const info = useProvidersInfo()
  const sources = modelSources(row.original)

  if (sources.length === 0) {
    return (
      <span aria-label="No source available" className="text-muted-foreground">
        —
      </span>
    )
  }

  const label = sources.map((source) => providerLabel(source, info)).join(" · ")

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={label}
            className="text-muted-foreground inline-flex items-center justify-end gap-1.5"
          />
        }
      >
        {sources.map((source) => (
          <SourceLogo key={source} source={source} className="size-3" />
        ))}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const columns = [
  columnHelper.accessor("displayName", {
    header: "Model",
    cell: renderModelCell,
  }),
  columnHelper.accessor("score", {
    header: "Score",
    sortUndefined: "last",
    cell: renderScoreCell,
  }),
  columnHelper.accessor("costPerTask", {
    header: METRIC_CONFIG.cost.shortLabel,
    sortUndefined: "last",
    cell: ({ getValue }) => formatMetric(getValue(), "cost"),
  }),
  columnHelper.accessor("tokensPerSecond", {
    header: "Tokens/s",
    sortUndefined: "last",
    cell: ({ getValue }) => formatMetric(getValue(), "speed"),
  }),
  columnHelper.accessor("durationSeconds", {
    header: "Duration",
    sortUndefined: "last",
    cell: ({ getValue }) => formatMetric(getValue(), "duration"),
  }),
  columnHelper.display({
    id: "source",
    header: "Source",
    cell: RenderSourceCell,
  }),
]

export function LeaderboardTable({ models }: { models: Array<Model> }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }])
  const table = useReactTable({
    data: models,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table
      data-table-frame="loaded"
      containerClassName="border-border border-y lg:overflow-x-visible"
      className={`${TABLE_WIDTH_CLASS} border-collapse text-left text-sm tabular-nums sm:text-xs`}
    >
      <TableHeader className={`bg-background ${BELOW_HEADER_OFFSET_CLASS} lg:sticky lg:z-20`}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header, index) => {
              const sorted = header.column.getIsSorted()
              const canSort = header.column.getCanSort()
              const rightAligned = RIGHT_ALIGNED_COLUMN_IDS.has(header.id)
              const SortIcon =
                sorted === "asc"
                  ? RiArrowUpLine
                  : sorted === "desc"
                    ? RiArrowDownLine
                    : RiArrowUpDownLine

              return (
                <TableHead
                  key={header.id}
                  scope="col"
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : canSort
                          ? "none"
                          : undefined
                  }
                  className={cn(
                    "text-muted-foreground h-11 px-3 sm:h-10",
                    rightAligned ? "text-right" : null,
                    index === 0 ? cn(STICKY_COLUMN_CLASS, "z-30") : null,
                  )}
                >
                  {canSort ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "min-h-11 sm:min-h-8 -mx-2 px-2 font-medium",
                        rightAligned ? "ml-auto" : null,
                        sorted ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon aria-hidden="true" data-icon="inline-end" />
                    </Button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="group/mark group hover:bg-muted/60">
            {row.getVisibleCells().map((cell, index) => (
              <TableCell
                key={cell.id}
                className={cn(
                  "text-foreground h-11 px-3",
                  RIGHT_ALIGNED_COLUMN_IDS.has(cell.column.id) ? "text-right" : null,
                  index === 0
                    ? cn(
                        STICKY_COLUMN_CLASS,
                        "transition-colors duration-200 ease-out group-hover:bg-muted/60",
                      )
                    : null,
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
