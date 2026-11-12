import { RiArrowRightLine, RiDeleteBinLine, RiSearchLine, RiShareLine } from "@remixicon/react"

import { Button } from "#/ui/components/ui/button"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Button", components: ["button"] }

export default function ButtonDemo() {
  return (
    <Rows>
      <Row label="variant">
        <Button>Compare</Button>
        <Button variant="outline">Import</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Sources</Button>
        <Button variant="destructive">Remove all</Button>
        <Button variant="link">models.dev</Button>
      </Row>
      <Row label="size">
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button>default</Button>
        <Button size="lg">lg</Button>
        <Button size="xl">xl</Button>
      </Row>
      <Row label="icon">
        <Button variant="outline">
          <RiShareLine data-icon="inline-start" />
          Share
        </Button>
        <Button variant="outline">
          Open chart
          <RiArrowRightLine data-icon="inline-end" />
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Search">
          <RiSearchLine />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Search">
          <RiSearchLine />
        </Button>
        <Button size="icon" variant="outline" aria-label="Search">
          <RiSearchLine />
        </Button>
        <Button size="icon-lg" variant="ghost" aria-label="Search">
          <RiSearchLine />
        </Button>
        <Button size="icon-xl" variant="destructive" aria-label="Remove all models">
          <RiDeleteBinLine />
        </Button>
      </Row>
      <Row label="disabled">
        <Button disabled>Compare</Button>
        <Button variant="outline" disabled>
          Import
        </Button>
      </Row>
    </Rows>
  )
}
