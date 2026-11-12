import { RiLinkM, RiImageLine, RiMarkdownLine } from "@remixicon/react"

import { Button } from "#/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#/ui/components/ui/dropdown-menu"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Dropdown menu", components: ["dropdown-menu"] }

export default function DropdownMenuDemo() {
  return (
    <Rows>
      <Row label="actions">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>Share</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Share this chart</DropdownMenuLabel>
              <DropdownMenuItem>
                <RiLinkM />
                Copy link
                <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <RiImageLine />
                Copy image
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RiMarkdownLine />
                  Copy as
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Markdown table</DropdownMenuItem>
                  <DropdownMenuItem>CSV</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Reset the chart</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
      <Row label="choices">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>Settings</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              <DropdownMenuCheckboxItem defaultChecked>Pareto frontier</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Model names</DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Scale</DropdownMenuLabel>
              <DropdownMenuRadioGroup defaultValue="log">
                <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="log">Log</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
    </Rows>
  )
}
