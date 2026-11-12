import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Toggle group", components: ["toggle-group"] }

export default function ToggleGroupDemo() {
  return (
    <Rows>
      <Row label="spaced">
        <ToggleGroup defaultValue={["scatter"]}>
          <ToggleGroupItem value="scatter">Scatter</ToggleGroupItem>
          <ToggleGroupItem value="bars">Bars</ToggleGroupItem>
          <ToggleGroupItem value="3d">3D</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row label="joined">
        <ToggleGroup variant="outline" spacing={0} defaultValue={["log"]}>
          <ToggleGroupItem value="linear">Linear</ToggleGroupItem>
          <ToggleGroupItem value="log">Log</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row label="small">
        <ToggleGroup size="sm" variant="outline" defaultValue={["high"]}>
          <ToggleGroupItem value="low">Low</ToggleGroupItem>
          <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
          <ToggleGroupItem value="high">High</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row label="vertical">
        <ToggleGroup orientation="vertical" variant="outline" spacing={0} defaultValue={["cost"]}>
          <ToggleGroupItem value="cost">Cost</ToggleGroupItem>
          <ToggleGroupItem value="speed">Speed</ToggleGroupItem>
        </ToggleGroup>
      </Row>
    </Rows>
  )
}
