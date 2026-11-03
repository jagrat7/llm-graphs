import { RiDownload2Line, RiGithubFill } from "@remixicon/react"

import { Button, buttonVariants } from "#/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"
import { cn } from "#/ui/lib/utils"

/** Where people ask for importing; a prefilled issue, so asking takes one click. */
const IMPORT_FEATURE_REQUEST_URL =
  "https://github.com/jagrat7/llm-graphs/issues/new?title=Import%20charts"

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
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-foreground text-lg font-medium">Soon™</p>
          <DialogDescription>Want this feature?</DialogDescription>
          <a
            href={IMPORT_FEATURE_REQUEST_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 gap-1.5")}
          >
            <RiGithubFill aria-hidden="true" />
            Spam me on GitHub
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
