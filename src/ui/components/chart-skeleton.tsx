import { Skeleton } from "#/ui/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/ui/components/ui/table"
import { CHART_FRAME_CLASS, TABLE_CELL_CLASS, TABLE_WIDTH_CLASS } from "#/ui/lib/layout-styles"

const CHART_GRID_LINES = 4
const TABLE_SKELETON_ROWS = 10
const HEADER_WIDTHS = ["w-40", "w-40", "w-20", "w-20", "w-20", "w-16"]

export function ChartSkeleton() {
  return (
    <div
      data-chart-frame="loading"
      className={`relative w-full ${CHART_FRAME_CLASS}`}
      aria-label="Loading comparison chart"
      role="status"
    >
      <div className="border-border absolute top-10 right-10 bottom-10 left-20 overflow-hidden border-b border-l">
        <Skeleton className="absolute inset-0 rounded-none opacity-70" />
        {Array.from({ length: CHART_GRID_LINES }, (_, index) => (
          <div
            key={index}
            className="bg-border absolute right-0 left-0 h-px"
            style={{ top: `${(index + 1) * 20}%` }}
          />
        ))}
      </div>
      <Skeleton className="absolute bottom-2 left-1/2 h-3 w-24 -translate-x-1/2 rounded-sm opacity-70" />
      <Skeleton className="absolute top-1/2 left-2 h-24 w-3 -translate-y-1/2 rounded-sm opacity-70" />
      <span className="sr-only">Loading model data</span>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div data-table-frame="loading" aria-label="Loading leaderboard" role="status">
      <Table
        aria-hidden="true"
        containerClassName="border-border border-y lg:overflow-x-visible"
        className={`${TABLE_WIDTH_CLASS} border-collapse`}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {HEADER_WIDTHS.map((width, index) => (
              <TableHead key={index} className={TABLE_CELL_CLASS}>
                <Skeleton className={`h-3 rounded-sm opacity-70 ${width}`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: TABLE_SKELETON_ROWS }, (_, rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-transparent">
              <TableCell className={TABLE_CELL_CLASS}>
                <Skeleton className="h-3 w-40 rounded-sm opacity-70" />
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <div className="ml-auto flex w-40 items-center gap-3">
                  <Skeleton className="h-3 w-12 rounded-sm opacity-70" />
                  <Skeleton className="h-1.5 flex-1 rounded-full opacity-70" />
                </div>
              </TableCell>
              {Array.from({ length: 4 }, (_unused, cellIndex) => (
                <TableCell key={cellIndex} className={TABLE_CELL_CLASS}>
                  <Skeleton className="ml-auto h-3 w-16 rounded-sm opacity-70" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading leaderboard rows</span>
    </div>
  )
}
