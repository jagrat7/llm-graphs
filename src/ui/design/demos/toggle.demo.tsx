import { RiPushpinLine } from "@remixicon/react"

import { Toggle } from "#/ui/components/ui/toggle"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Toggle", components: ["toggle"] }

export default function ToggleDemo() {
  return (
    <Rows>
      <Row label="variant">
        <Toggle aria-label="Pin">
          <RiPushpinLine />
        </Toggle>
        <Toggle variant="outline" defaultPressed>
          <RiPushpinLine data-icon="inline-start" />
          Pinned
        </Toggle>
      </Row>
      <Row label="size">
        <Toggle size="sm" variant="outline">
          sm
        </Toggle>
        <Toggle variant="outline">default</Toggle>
        <Toggle size="lg" variant="outline">
          lg
        </Toggle>
      </Row>
      <Row label="disabled">
        <Toggle variant="outline" disabled>
          Labels
        </Toggle>
      </Row>
    </Rows>
  )
}
