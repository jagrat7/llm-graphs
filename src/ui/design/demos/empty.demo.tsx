import { RiLineChartLine } from "@remixicon/react"

import { Button } from "#/ui/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/ui/components/ui/empty"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Empty", components: ["empty"] }

export default function EmptyDemo() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiLineChartLine />
        </EmptyMedia>
        <EmptyTitle>No models on the chart</EmptyTitle>
        <EmptyDescription>Pick a few to compare their cost and score.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Pick models</Button>
      </EmptyContent>
    </Empty>
  )
}
