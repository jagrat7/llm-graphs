import { Button } from "#/ui/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/ui/components/ui/card"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Card", components: ["card"] }

export default function CardDemo() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Intelligence index</CardTitle>
        <CardDescription>Artificial Analysis, updated daily</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            Change
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        A composite of ten evaluations, from reasoning and maths to coding and long context.
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">
          Open source
        </Button>
      </CardFooter>
    </Card>
  )
}
