import type { CSSProperties, HTMLAttributes } from "react"

import { useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { ModelLogo } from "#/ui/components/model-logo"
import { Button } from "#/ui/components/ui/button"
import { Checkbox } from "#/ui/components/ui/checkbox"
import { vendorLabel } from "#/ui/lib/model-view"

type DotStyle = CSSProperties & { "--dot": string }

/**
 * A vendor opens on its newest few models. Some benchmarks list hundreds, and a
 * list that long stops being something you scan; the rest sit behind a toggle.
 */
const VENDOR_PREVIEW_COUNT = 3

/** Likewise for vendors: the panel opens on a handful, the long tail sits behind a toggle. */
const PROVIDER_PREVIEW_COUNT = 6

/** The labs most comparisons start from, pinned ahead of the rest in this order. */
const PINNED_VENDORS = ["anthropic", "openai", "xai", "zhipuai", "moonshotai", "google"]

const OTHER_VENDOR = "\u0000other"

export type VendorGroup = {
  key: string
  label: string
  logoUrl: string | null
  /** Newest release first, so the preview shows what people are comparing now. */
  models: Array<Model>
}

function pinRank(key: string) {
  const index = PINNED_VENDORS.indexOf(key)
  return index === -1 ? PINNED_VENDORS.length : index
}

/**
 * Pinned labs first, then the busiest vendors: model count is the closest stable
 * proxy for which labs people come to compare, and a stable order is what makes
 * the list learnable. Models without a vendor share one group at the end.
 */
export function groupByVendor(models: ReadonlyArray<Model>): Array<VendorGroup> {
  const groups = new Map<string, VendorGroup>()

  for (const model of models) {
    const key = model.vendor ?? OTHER_VENDOR
    const group = groups.get(key) ?? {
      key,
      label: model.vendor == null ? "Other" : vendorLabel(model.vendor),
      logoUrl: model.logoUrl,
      models: [],
    }
    group.models.push(model)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    group.models.sort(
      (left, right) =>
        (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "") ||
        left.displayName.localeCompare(right.displayName),
    )
  }

  return [...groups.values()].toSorted(
    (left, right) =>
      Number(left.key === OTHER_VENDOR) - Number(right.key === OTHER_VENDOR) ||
      pinRank(left.key) - pinRank(right.key) ||
      right.models.length - left.models.length ||
      left.label.localeCompare(right.label),
  )
}

type ModelChecklistProps = {
  groups: ReadonlyArray<VendorGroup>
  selected: ReadonlySet<string>
  onToggle: (model: string) => void
  /** Hover and focus wiring for a row, so the chart can emphasise its model. */
  rowProps?: (model: string) => HTMLAttributes<HTMLElement>
}

export function ModelChecklist({ groups, selected, onToggle, rowProps }: ModelChecklistProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [allProviders, setAllProviders] = useState(false)
  // What was on the chart when the list opened, plus anything toggled since. Those
  // rows stay put until the list closes: unchecking one must not pull it, or its
  // vendor, out from under the pointer or keyboard focus.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set(selected))
  const isKept = (model: Model) => kept.has(model.model) || selected.has(model.model)

  function toggle(model: string) {
    setKept((current) => (current.has(model) ? current : new Set(current).add(model)))
    onToggle(model)
  }

  const shownGroups = allProviders
    ? groups
    : groups.filter((group, index) => index < PROVIDER_PREVIEW_COUNT || group.models.some(isKept))
  const hiddenProviderCount = groups.length - shownGroups.length

  return (
    <>
      {/* A grid rather than column flow: every vendor in a row starts on the same
          line whether or not it has a toggle, and the order reads across. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-3">
        {shownGroups.map((group) => {
          const isExpanded = expanded.has(group.key)
          // A selected model never hides behind the toggle: what is on the chart stays checkable.
          const shown = isExpanded
            ? group.models
            : group.models.filter((model, index) => index < VENDOR_PREVIEW_COUNT || isKept(model))
          const hiddenCount = group.models.length - shown.length
          const selectedCount = group.models.filter((model) => selected.has(model.model)).length
          const headingId = `model-checklist-${group.key}`

          return (
            <section key={group.key} aria-labelledby={headingId}>
              <h3
                id={headingId}
                className="text-muted-foreground flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium"
              >
                <ModelLogo logoUrl={group.logoUrl} className="size-3.5" />
                <span className="truncate">{group.label}</span>
                {selectedCount > 0 ? (
                  <span className="text-foreground ms-auto tabular-nums">
                    {selectedCount}
                    <span className="sr-only"> selected</span>
                  </span>
                ) : null}
              </h3>
              <ul>
                {shown.map((model) => {
                  const dotStyle: DotStyle = { "--dot": model.chartColor }

                  return (
                    <li key={model.model}>
                      <label
                        className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm sm:min-h-7 sm:text-xs"
                        {...rowProps?.(model.model)}
                      >
                        {/* The box takes the series colour once checked, so the list
                          keys the chart the same way the chips do. */}
                        <Checkbox
                          checked={selected.has(model.model)}
                          onCheckedChange={() => toggle(model.model)}
                          style={dotStyle}
                          className="data-checked:text-background data-checked:border-(--dot) data-checked:bg-(--dot) dark:data-checked:bg-(--dot)"
                        />
                        <span className="truncate">{model.displayName}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              {hiddenCount > 0 || isExpanded ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={isExpanded}
                  className="text-muted-foreground mt-0.5 h-11 w-full justify-start px-1.5 sm:h-6"
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (isExpanded) next.delete(group.key)
                      else next.add(group.key)
                      return next
                    })
                  }
                >
                  {isExpanded ? "Show fewer" : `${hiddenCount} more`}
                </Button>
              ) : null}
            </section>
          )
        })}
      </div>
      {hiddenProviderCount > 0 || allProviders ? (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={allProviders}
          className="text-muted-foreground h-11 w-full sm:h-7"
          onClick={() => setAllProviders((current) => !current)}
        >
          {allProviders
            ? "Fewer providers"
            : `${hiddenProviderCount} more ${hiddenProviderCount === 1 ? "provider" : "providers"}`}
        </Button>
      ) : null}
    </>
  )
}
