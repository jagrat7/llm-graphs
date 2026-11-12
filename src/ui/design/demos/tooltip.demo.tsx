import { Button } from "#/ui/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/ui/components/ui/tooltip"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Tooltip", components: ["tooltip"] }

export default function TooltipDemo() {
  return (
    <Rows>
      <Row label="hover">
        {(["top", "bottom", "right"] as const).map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger render={<Button variant="outline" />}>side={side}</TooltipTrigger>
            <TooltipContent side={side}>Copy link</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" />}>with kbd</TooltipTrigger>
          <TooltipContent>
            Switch theme
            <kbd data-slot="kbd">D</kbd>
          </TooltipContent>
        </Tooltip>
      </Row>
    </Rows>
  )
}
