/** One group of the settings dialog, ruled off from the next. */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  /** Names the section for assistive tech; the rows' own labels carry it on screen. */
  title: string
  description?: string
  /** Section-wide controls, set against the description's right edge. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="border-border/60 border-b py-4 last:border-b-0">
      {description || action ? (
        <div className="mb-3 flex items-center justify-between gap-4 pt-2">
          {description ? (
            <p className="text-muted-foreground text-control min-w-0">{description}</p>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}
