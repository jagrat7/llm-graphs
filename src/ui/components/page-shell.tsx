import { PAGE_COLUMN_CLASS } from "#/ui/lib/layout-styles"
import { cn } from "#/ui/lib/utils"

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <main className={cn(PAGE_COLUMN_CLASS, className)}>{children}</main>
}
