import { Separator } from "#/ui/components/ui/separator"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Separator", components: ["separator"] }

export default function SeparatorDemo() {
  return (
    <Rows>
      <Row label="horizontal" className="block">
        <div className="text-control grid max-w-64 gap-2">
          <span>Artificial Analysis</span>
          <Separator />
          <span>models.dev</span>
        </div>
      </Row>
      <Row label="vertical">
        <div className="text-control flex h-5 items-center gap-3">
          <span>Scatter</span>
          <Separator orientation="vertical" />
          <span>Bars</span>
          <Separator orientation="vertical" />
          <span>3D</span>
        </div>
      </Row>
    </Rows>
  )
}
