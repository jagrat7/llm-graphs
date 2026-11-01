import { RiEqualizer2Line } from "@remixicon/react"
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
import SettingsProviders from "#/ui/components/settings-providers"
import { SettingsSection } from "#/ui/components/settings-section"
import { DEFAULT_SETTINGS, isDefaultSettings, useSetting, useSettings } from "#/ui/lib/settings"

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

type SwitchSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

/** A row whose control is one on/off setting. */
function SettingSwitch({
  setting,
  label,
  description,
}: {
  setting: SwitchSetting
  label: string
  description: string
}) {
  const [checked, setChecked] = useSetting(setting)
  const id = `settings-${setting}`

  return (
    <SettingRow id={id} label={label} description={description}>
      <Switch id={id} checked={checked} onCheckedChange={setChecked} />
    </SettingRow>
  )
}

/** Preferences that outlive one comparison: how the chart draws, and which providers it shows. */
export default function SettingsMenu() {
  const [settings, setSettings] = useSettings()
  const isDefault = isDefaultSettings(settings)

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
              <SettingSwitch
                setting="paretoFrontier"
                label="Pareto frontier"
                description="Draw the frontier when a scatter opens"
              />
              <SettingSwitch
                setting="logScale"
                label="Log scale"
                description="Open every axis that allows it on a log scale"
              />
              <SettingSwitch
                setting="vendorLogos"
                label="Provider logos"
                description="Mark points with their lab's logo instead of a dot"
              />
              <SettingSwitch
                setting="paperGrid"
                label="Gridlines detail"
                description="Control the labelled gridlines look, low or graph paper like"
              />
            </div>
          </SettingsSection>

          <SettingsProviders />
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
