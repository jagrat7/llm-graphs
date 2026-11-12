import { Checkbox } from "#/ui/components/ui/checkbox"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Checkbox", components: ["checkbox"] }

export default function CheckboxDemo() {
  return (
    <Rows>
      <Row label="states">
        <Checkbox aria-label="Unchecked" />
        <Checkbox defaultChecked aria-label="Checked" />
        <Checkbox disabled aria-label="Disabled" />
        <Checkbox disabled defaultChecked aria-label="Disabled, checked" />
        <Checkbox aria-invalid aria-label="Invalid" />
      </Row>
      <Row label="with label">
        <label className="text-control flex items-center gap-2">
          <Checkbox defaultChecked />
          Show the Pareto frontier
        </label>
      </Row>
    </Rows>
  )
}
