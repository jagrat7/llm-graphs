import { RiCheckLine } from "@remixicon/react"

import { Badge } from "#/ui/components/ui/badge"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Badge", components: ["badge"] }

export default function BadgeDemo() {
  return (
    <Rows>
      <Row label="variant">
        <Badge>New</Badge>
        <Badge variant="secondary">Reasoning</Badge>
        <Badge variant="outline">Open weights</Badge>
        <Badge variant="destructive">Deprecated</Badge>
        <Badge variant="ghost">Ghost</Badge>
        <Badge variant="link">Link</Badge>
      </Row>
      <Row label="icon">
        <Badge variant="secondary">
          <RiCheckLine data-icon="inline-start" />
          Verified
        </Badge>
      </Row>
    </Rows>
  )
}
