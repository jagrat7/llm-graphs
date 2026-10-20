import { RiEqualizer2Line, RiSearchLine } from "@remixicon/react"
import { useQuery } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { RESET } from "jotai/utils"
import { useMemo, useState } from "react"

import type { Settings } from "#/ui/lib/settings"

import { ModelLogo } from "#/ui/components/model-logo"
import { Button } from "#/ui/components/ui/button"
import { Checkbox } from "#/ui/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/ui/components/ui/input-group"
import { Switch } from "#/ui/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "#/ui/components/ui/toggle-group"
import {
  isDefaultSettings,
  OPENING_MODEL_COUNTS,
  providerOptions,
  settingsAtom,
} from "#/ui/lib/settings"
import { orpc } from "#/ui/lib/orpc-client"

const EFFORT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "highest", label: "Highest only" },
] as const satisfies ReadonlyArray<{ value: Settings["effortLevels"]; label: string }>

const OPENING_OPTIONS = OPENING_MODEL_COUNTS.map((count) => ({ value: count, label: `${count}` }))

function SettingsSection({
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
            <p className="text-muted-foreground min-w-0 text-xs">{description}</p>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

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
        <label id={`${id}-label`} htmlFor={id} className="text-foreground block text-sm">
          {label}
        </label>
        {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
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
        <ToggleGroupItem
          key={option.value}
          value={String(option.value)}
          className="h-11 px-3 sm:h-7"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/**
 * Preferences that outlive one comparison. Turning a provider off takes its models out of
 * the picker, the opening selection, and the chart; turning it back on restores any picks.
 */
export default function SettingsMenu() {
  const [settings, setSettings] = useAtom(settingsAtom)
  // Never stale, like the compare route's copy, so this reads that cache entry instead of refetching.
  const { data: snapshot } = useQuery(
    orpc.models.snapshot.queryOptions({ staleTime: Infinity, gcTime: Infinity }),
  )
  const providers = useMemo(() => (snapshot ? providerOptions(snapshot) : []), [snapshot])
  const [query, setQuery] = useState("")

  const hidden = new Set(settings.hiddenProviders)
  const shownCount = providers.filter((provider) => !hidden.has(provider.vendor)).length
  const needle = query.trim().toLowerCase()
  const matching = needle
    ? providers.filter((provider) => provider.label.toLowerCase().includes(needle))
    : providers
  const isDefault = isDefaultSettings(settings)

  function update(change: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...change }))
  }

  function toggleProvider(vendor: string, shown: boolean) {
    setSettings((current) => ({
      ...current,
      hiddenProviders: shown
        ? current.hiddenProviders.filter((each) => each !== vendor)
        : [...new Set([...current.hiddenProviders, vendor])],
    }))
  }

  return (
    <Dialog onOpenChange={(open) => !open && setQuery("")}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            className="text-muted-foreground aria-expanded:bg-foreground/12 aria-expanded:text-foreground min-h-11 w-11 sm:min-h-8 sm:w-8"
          >
            <RiEqualizer2Line aria-hidden="true" />
          </Button>
        }
      />
      {/* The body scrolls between a fixed header and footer, never the page behind. */}
      <DialogContent className="flex max-h-[min(52rem,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-border/60 border-b px-6 pe-14 pt-5 pb-4">
          <DialogTitle className="text-base">Settings</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
          <SettingsSection title="Chart">
            <div className="divide-border/60 divide-y">
              <SettingRow
                id="settings-starting-models"
                label="Starting models"
                description="How many top models the chart opens on, until you pick your own"
              >
                <Segmented
                  labelId="settings-starting-models-label"
                  value={settings.openingModels}
                  options={OPENING_OPTIONS}
                  onChange={(openingModels) => update({ openingModels })}
                />
              </SettingRow>
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

          <SettingsSection
            title="Providers"
            description={providers.length > 0 ? `${shownCount} of ${providers.length}` : undefined}
            action={
              providers.length > 0 ? (
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={shownCount === providers.length}
                    onClick={() => update({ hiddenProviders: [] })}
                    className="text-muted-foreground h-11 px-2 sm:h-7"
                  >
                    Select all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={shownCount === 0}
                    onClick={() =>
                      update({ hiddenProviders: providers.map((provider) => provider.vendor) })
                    }
                    className="text-muted-foreground h-11 px-2 sm:h-7"
                  >
                    Deselect all
                  </Button>
                </div>
              ) : null
            }
          >
            <InputGroup className="h-11 sm:h-8">
              <InputGroupAddon>
                <RiSearchLine aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search providers"
                aria-label="Search providers"
              />
            </InputGroup>

            <ul className="-mx-1.5 mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              {snapshot == null ? (
                <li className="text-muted-foreground col-span-full px-1.5 py-2 text-xs">
                  Loading providers…
                </li>
              ) : matching.length === 0 ? (
                <li className="text-muted-foreground col-span-full px-1.5 py-2 text-xs">
                  No providers match
                </li>
              ) : (
                matching.map((provider) => {
                  const shown = !hidden.has(provider.vendor)

                  return (
                    <li key={provider.vendor}>
                      <label className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm sm:min-h-8">
                        <Checkbox
                          checked={shown}
                          onCheckedChange={(next) => toggleProvider(provider.vendor, next)}
                        />
                        <ModelLogo
                          logoUrl={provider.logoUrl}
                          className={shown ? "size-3.5" : "size-3.5 opacity-40"}
                        />
                        <span className={shown ? "truncate" : "text-muted-foreground truncate"}>
                          {provider.label}
                        </span>
                        <span className="text-muted-foreground/70 ms-auto text-xs tabular-nums">
                          {provider.modelCount}
                          <span className="sr-only"> models</span>
                        </span>
                      </label>
                    </li>
                  )
                })
              )}
            </ul>
          </SettingsSection>
        </div>

        <DialogFooter className="border-border/60 border-t px-6 py-4 sm:justify-between">
          <Button variant="ghost" disabled={isDefault} onClick={() => setSettings(RESET)}>
            Reset to defaults
          </Button>
          <DialogClose render={<Button className="px-4" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
