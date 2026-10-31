import { RiSearchLine } from "@remixicon/react"
import { queryOptions, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { ModelLogo } from "#/ui/components/model-logo"
import { SettingsSection } from "#/ui/components/settings-section"
import { Button } from "#/ui/components/ui/button"
import { Checkbox } from "#/ui/components/ui/checkbox"
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/ui/components/ui/input-group"
import { CHECK_ROW_CLASS } from "#/ui/lib/layout-styles"
import { fetchModelSnapshot } from "#/ui/lib/model-snapshot"
import { providerOptions, useSettings } from "#/ui/lib/settings"
import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { cn } from "#/ui/lib/utils"

/**
 * The settings' provider list. Turning a provider off takes its models out of the picker, the
 * opening selection, and the chart; turning it back on restores any picks. Its own module, loaded
 * when the dialog opens, so the app bar never reads the snapshot to build a list no one has opened.
 * The search lives here too, so closing the dialog clears it.
 */
export default function SettingsProviders() {
  const [settings, setSettings] = useSettings()
  // Never stale, like the compare route's copy, so this reads that cache entry instead of refetching.
  const { data: snapshot } = useQuery(
    queryOptions({
      queryKey: ["models", "snapshot"],
      queryFn: () => fetchModelSnapshot(),
      staleTime: Infinity,
      gcTime: Infinity,
    }),
  )
  const providers = useMemo(() => (snapshot ? providerOptions(snapshot) : []), [snapshot])
  const [query, setQuery] = useState("")

  const hidden = new Set(settings.hiddenProviders)
  const shownCount = providers.filter((provider) => !hidden.has(provider.vendor)).length
  const needle = query.trim().toLowerCase()
  const matching = needle
    ? providers.filter((provider) => provider.label.toLowerCase().includes(needle))
    : providers

  function setHidden(hiddenProviders: Array<string>) {
    setSettings((current) => ({ ...current, hiddenProviders }))
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
    <SettingsSection
      title="Providers"
      description={providers.length > 0 ? `${shownCount} of ${providers.length}` : undefined}
      action={
        providers.length > 0 ? (
          // Ghost buttons on the column's edge pull out by their padding, so their labels meet it.
          <div className="-me-2 flex shrink-0 items-center">
            <Button
              variant="ghost"
              disabled={shownCount === providers.length}
              onClick={() => setHidden([])}
              className="text-muted-foreground"
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              disabled={shownCount === 0}
              onClick={() => setHidden(providers.map((provider) => provider.vendor))}
              className="text-muted-foreground"
            >
              Deselect all
            </Button>
          </div>
        ) : null
      }
    >
      <InputGroup>
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
          <li className="text-muted-foreground text-control col-span-full px-1.5 py-2">
            Loading providers…
          </li>
        ) : matching.length === 0 ? (
          <li className="text-muted-foreground text-control col-span-full px-1.5 py-2">
            No providers match
          </li>
        ) : (
          matching.map((provider) => {
            const shown = !hidden.has(provider.vendor)

            return (
              <li key={provider.vendor}>
                <label className={CHECK_ROW_CLASS}>
                  <Checkbox
                    checked={shown}
                    onCheckedChange={(next) => toggleProvider(provider.vendor, next)}
                  />
                  <ModelLogo
                    logoUrl={provider.logoUrl}
                    color={provider.color}
                    className={shown ? "size-3.5" : "size-3.5 opacity-40"}
                  />
                  <span className={shown ? "truncate" : "text-muted-foreground truncate"}>
                    {provider.label}
                  </span>
                  <span className={cn(COUNT_TEXT_CLASS, "text-muted-foreground/70 ms-auto")}>
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
  )
}
