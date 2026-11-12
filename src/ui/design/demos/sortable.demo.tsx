import { useState } from "react"

import { Sortable, SortableHandle, SortableItem } from "#/ui/components/ui/sortable"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Sortable", components: ["sortable"] }

export default function SortableDemo() {
  const [rows, setRows] = useState(["GPT-5", "Claude Opus 4.5", "Gemini 3 Pro", "Grok 4"])
  const [chips, setChips] = useState(["Cost", "Score", "Speed"])
  return (
    <Rows>
      <Row label="vertical" className="block">
        <Sortable value={rows} onValueChange={setRows} className="max-w-64 gap-1">
          {rows.map((row) => (
            <SortableItem
              key={row}
              value={row}
              className="bg-card text-control flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5"
            >
              {row}
              <SortableHandle className="ml-auto" aria-label={`Move ${row}`} />
            </SortableItem>
          ))}
        </Sortable>
      </Row>
      <Row label="horizontal" className="block">
        <Sortable
          orientation="horizontal"
          value={chips}
          onValueChange={setChips}
          className="w-fit gap-2"
        >
          {chips.map((chip) => (
            <SortableItem key={chip} value={chip}>
              {/* The whole chip is the handle. */}
              <SortableHandle
                className="bg-card text-control text-foreground size-auto rounded-md border px-3 py-1"
                aria-label={`Move ${chip}`}
              >
                {chip}
              </SortableHandle>
            </SortableItem>
          ))}
        </Sortable>
      </Row>
    </Rows>
  )
}
