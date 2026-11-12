import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "#/ui/components/ui/table"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Table", components: ["table"] }

const ROWS = [
  { model: "GPT-5 (high)", score: 68, cost: "$3.44" },
  { model: "Claude Opus 4.5", score: 70, cost: "$5.10" },
  { model: "Gemini 3 Pro", score: 73, cost: "$2.80" },
]

export default function TableDemo() {
  return (
    <Table>
      <TableCaption>Leaderboard, three models</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Intelligence</TableHead>
          <TableHead className="text-right">Cost per task</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.model}>
            <TableCell>{row.model}</TableCell>
            <TableCell className="text-right font-mono">{row.score}</TableCell>
            <TableCell className="text-right font-mono">{row.cost}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Median</TableCell>
          <TableCell className="text-right font-mono">70</TableCell>
          <TableCell className="text-right font-mono">$3.44</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
