import { RiDownload2Line } from "@remixicon/react"

import { Button } from "#/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"
import { cn } from "#/ui/lib/utils"

/** The chart's import button, beside Share. Importing isn't built yet, so it only says so. */
export function ChartImportButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          // Styled as the share menu's trigger, so the two read as one toolbar.
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:bg-foreground/12! hover:text-foreground aria-expanded:bg-foreground/12 aria-expanded:text-foreground gap-1.5 border-0 [&_svg]:size-3.5!",
              className,
            )}
          />
        }
      >
        <RiDownload2Line aria-hidden="true" />
        Import
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import</DialogTitle>
          <DialogDescription>Soon™</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
