import { Button } from "#/ui/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "#/ui/components/ui/popover"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Popover", components: ["popover"] }

export default function PopoverDemo() {
  return (
    <Rows>
      <Row label="side">
        {(["bottom", "right"] as const).map((side) => (
          <Popover key={side}>
            <PopoverTrigger render={<Button variant="outline" />}>side={side}</PopoverTrigger>
            <PopoverContent side={side}>
              <PopoverHeader>
                <PopoverTitle>GPT-5 (high)</PopoverTitle>
                <PopoverDescription>Intelligence 68 · $3.44 per task</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        ))}
      </Row>
    </Rows>
  )
}
