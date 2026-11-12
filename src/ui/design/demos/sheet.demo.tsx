import { Button } from "#/ui/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "#/ui/components/ui/sheet"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Sheet", components: ["sheet"] }

export default function SheetDemo() {
  return (
    <Rows>
      <Row label="side">
        {(["right", "left", "bottom"] as const).map((side) => (
          <Sheet key={side}>
            <SheetTrigger render={<Button variant="outline" />}>side={side}</SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Models</SheetTitle>
                <SheetDescription>Pick the models to put on the chart.</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <Button>Done</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </Row>
    </Rows>
  )
}
