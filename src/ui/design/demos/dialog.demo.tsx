import { Button } from "#/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Dialog", components: ["dialog"] }

export default function DialogDemo() {
  return (
    <Rows>
      <Row label="header close">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Sources</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Where the numbers come from</DialogTitle>
              <DialogDescription>
                Every score on the chart links back to its source.
              </DialogDescription>
            </DialogHeader>
            <p>Scores, prices and speeds are fetched once a day.</p>
          </DialogContent>
        </Dialog>
      </Row>
      <Row label="footer">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Remove all</DialogTrigger>
          <DialogContent>
            <DialogHeader showCloseButton={false}>
              <DialogTitle>Remove every model?</DialogTitle>
              <DialogDescription>The chart will be empty until you pick again.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="destructive" />}>Remove all</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>
      <Row label="corner close">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Headerless</DialogTrigger>
          <DialogContent showCornerCloseButton>
            <DialogTitle>Copied</DialogTitle>
            <p>The chart's link is on your clipboard.</p>
          </DialogContent>
        </Dialog>
      </Row>
    </Rows>
  )
}
