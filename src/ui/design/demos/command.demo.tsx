import { RiBarChartLine, RiLineChartLine, RiSettings3Line } from "@remixicon/react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "#/ui/components/ui/command"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Command", components: ["command"] }

export default function CommandDemo() {
  return (
    // Starts on an item: with none, cmdk selects the first and scrolls it into view, which
    // scrolls the whole design page down to this demo on load.
    <Command defaultValue="Scatter" className="max-w-sm rounded-lg border">
      <CommandInput placeholder="Search models" />
      <CommandList>
        <CommandEmpty>No model matches.</CommandEmpty>
        <CommandGroup heading="Views">
          <CommandItem>
            <RiLineChartLine />
            Scatter
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <RiBarChartLine />
            Bars
            <CommandShortcut>B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <RiSettings3Line />
            Providers
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
