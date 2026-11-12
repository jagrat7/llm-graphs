import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "#/ui/components/ui/select"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Select", components: ["select"] }

const METRICS = {
  score: "Intelligence index",
  cost: "Cost per task",
  speed: "Output speed",
  latency: "Time to first token",
}

function Metric({ size }: { size?: "sm" | "default" | "lg" | "xl" }) {
  return (
    <Select items={METRICS} defaultValue="score">
      <SelectTrigger size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Quality</SelectLabel>
          <SelectItem value="score">Intelligence index</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Price and speed</SelectLabel>
          <SelectItem value="cost">Cost per task</SelectItem>
          <SelectItem value="speed">Output speed</SelectItem>
          <SelectItem value="latency">Time to first token</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export default function SelectDemo() {
  return (
    <Rows>
      <Row label="size">
        <Metric size="sm" />
        <Metric />
        <Metric size="lg" />
        <Metric size="xl" />
      </Row>
      <Row label="disabled">
        <Select disabled defaultValue="cost" items={METRICS}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      </Row>
    </Rows>
  )
}
