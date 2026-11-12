import { Textarea } from "#/ui/components/ui/textarea"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Textarea", components: ["textarea"] }

export default function TextareaDemo() {
  return (
    <Rows>
      <Row label="default">
        <Textarea placeholder="Paste a chart link" className="max-w-72" />
      </Row>
      <Row label="invalid">
        <Textarea aria-invalid defaultValue="not a link" className="max-w-72" />
      </Row>
      <Row label="disabled">
        <Textarea disabled placeholder="Paste a chart link" className="max-w-72" />
      </Row>
    </Rows>
  )
}
