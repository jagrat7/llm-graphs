import { Input } from "#/ui/components/ui/input"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Input", components: ["input"] }

export default function InputDemo() {
  return (
    <Rows>
      <Row label="default">
        <Input placeholder="Search models" className="max-w-64" />
      </Row>
      <Row label="filled">
        <Input defaultValue="claude" className="max-w-64" />
      </Row>
      <Row label="invalid">
        <Input aria-invalid defaultValue="-3" className="max-w-64" />
      </Row>
      <Row label="disabled">
        <Input disabled placeholder="Search models" className="max-w-64" />
      </Row>
    </Rows>
  )
}
