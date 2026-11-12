import { Switch } from "#/ui/components/ui/switch"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Switch", components: ["switch"] }

export default function SwitchDemo() {
  return (
    <Rows>
      <Row label="size">
        <Switch size="sm" defaultChecked aria-label="Small" />
        <Switch defaultChecked aria-label="Default" />
      </Row>
      <Row label="states">
        <Switch aria-label="Off" />
        <Switch defaultChecked aria-label="On" />
        <Switch disabled aria-label="Disabled" />
        <Switch disabled defaultChecked aria-label="Disabled, on" />
      </Row>
      <Row label="with label">
        <label className="text-control flex items-center gap-2">
          <Switch defaultChecked />
          Log scale
        </label>
      </Row>
    </Rows>
  )
}
