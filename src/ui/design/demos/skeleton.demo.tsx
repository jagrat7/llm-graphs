import { Skeleton } from "#/ui/components/ui/skeleton"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Skeleton", components: ["skeleton"] }

export default function SkeletonDemo() {
  return (
    <Rows>
      <Row label="row">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-40 rounded-sm" />
        <Skeleton className="h-3 w-16 rounded-sm" />
      </Row>
      <Row label="block">
        <Skeleton className="h-24 w-64" />
      </Row>
    </Rows>
  )
}
