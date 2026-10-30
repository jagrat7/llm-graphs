import { RiEqualizer2Line } from "@remixicon/react"
import { lazy, Suspense } from "react"

import type { Settings } from "#/ui/lib/settings"

import { Button } from "#/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"
import { Switch } from "#/ui/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"
import { SettingsSection } from "#/ui/components/settings-section"
import { DEFAULT_SETTINGS, isDefaultSettings, useSettings } from "#/ui/lib/settings"

const SettingsProviders = lazy(() => import("#/ui/components/settings-providers"))

const EFFORT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "highest", label: "Highest only" },
] as const satisfies ReadonlyArray<{ value: Settings["effortLevels"]; label: string }>

/**
 * Label, and any description, on the left, the control on the right, as one row of a form.
 * The control takes `id`; a group control is labelled by `${id}-label` instead.
 */
function SettingRow({
  id,
  label,
  description,
  children,
}: {
  id: string
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="text-foreground text-field block">
          {label}
        </label>
        {description ? (
          <p className="text-muted-foreground text-control mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented<T extends string | number>({
  labelId,
  value,
  options,
  onChange,
}: {
  labelId: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup
      aria-labelledby={labelId}
      variant="outline"
      spacing={0}
      value={[String(value)]}
      onValueChange={(values) => {
        const next = options.find((option) => String(option.value) === values[0])
        if (next) onChange(next.value)
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={String(option.value)} className="px-3">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Preferences that outlive one comparison: how the chart draws, and which providers it shows. */
export default function SettingsMenu() {
  const [settings, setSettings] = useSettings()
  const isDefault = isDefaultSettings(settings)

  function update(change: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...change }))
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Settings"
            className="text-muted-foreground aria-expanded:bg-foreground/12 aria-expanded:text-foreground"
          >
            <RiEqualizer2Line aria-hidden="true" />
          </Button>
        }
      />
      {/* The body scrolls between a fixed header and footer, never the page behind. */}
      <DialogContent className="flex max-h-[min(52rem,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-border/60 border-b px-6 py-3.5">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
          <SettingsSection title="Chart">
            <div className="divide-border/60 divide-y">
              <SettingRow
                id="settings-effort-levels"
                label="Effort levels"
                description="Plot every reasoning effort a model ran at, or only its highest"
              >
                <Segmented
                  labelId="settings-effort-levels-label"
                  value={settings.effortLevels}
                  options={EFFORT_OPTIONS}
                  onChange={(effortLevels) => update({ effortLevels })}
                />
              </SettingRow>
              <SettingRow
                id="settings-pareto-frontier"
                label="Pareto frontier"
                description="Draw the frontier when a scatter opens"
              >
                <Switch
                  id="settings-pareto-frontier"
                  checked={settings.paretoFrontier}
                  onCheckedChange={(paretoFrontier) => update({ paretoFrontier })}
                />
              </SettingRow>
              <SettingRow
                id="settings-provider-logos"
                label="Provider logos"
                description="Mark points with their lab's logo instead of a dot"
              >
                <Switch
                  id="settings-provider-logos"
                  checked={settings.vendorLogos}
                  onCheckedChange={(vendorLogos) => update({ vendorLogos })}
                />
              </SettingRow>
            </div>
          </SettingsSection>

          {/* Loaded when the dialog first opens: the list derives from the whole model snapshot,
              which a closed dialog in the app bar has no reason to read. */}
          <Suspense
            fallback={
              <SettingsSection title="Providers">
                <p className="text-muted-foreground text-control py-2">Loading providers…</p>
              </SettingsSection>
            }
          >
            <SettingsProviders />
          </Suspense>
        </div>

        <DialogFooter className="border-border/60 border-t px-6 py-4 sm:justify-between">
          {/* Meets the column's edge once the footer is a row, as the provider actions do. */}
          <Button
            variant="ghost"
            size="lg"
            disabled={isDefault}
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="sm:-ms-2.5"
          >
            Reset to defaults
          </Button>
          <DialogClose render={<Button size="lg" className="px-4" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
