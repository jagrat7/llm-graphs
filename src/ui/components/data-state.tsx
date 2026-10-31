import { RiErrorWarningLine } from "@remixicon/react"

import { Alert, AlertTitle } from "#/ui/components/ui/alert"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "#/ui/components/ui/empty"
import { cn } from "#/ui/lib/utils"

/** Both states occupy the frame the real content would fill, so the page never jumps. */
const FRAME_CLASS = "border-border flex items-center justify-center border-y px-4"

/**
 * Nothing to show yet. `title` is the headline; `children` carries whatever
 * action recovers from it (usually a model picker).
 */
export function DataState({
  title,
  children,
  className,
}: {
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={cn(FRAME_CLASS, "rounded-none", className)}>
      <EmptyHeader>
        <EmptyTitle className="font-normal">{title}</EmptyTitle>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

/** The request failed. Loud enough to notice, quiet enough not to shout. */
export function DataError({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <Alert variant="destructive" className="w-fit border-none">
        <RiErrorWarningLine aria-hidden="true" />
        <AlertTitle>{children}</AlertTitle>
      </Alert>
    </div>
  )
}
