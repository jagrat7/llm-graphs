import type { CSSProperties } from "react"

import { RiArrowDownSLine, RiCloseLine, RiSearchLine } from "@remixicon/react"
import { useEffect, useId, useMemo, useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { ModelLogo } from "#/ui/components/model-logo"
import { Button } from "#/ui/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "#/ui/components/ui/combobox"
import { InputGroupAddon } from "#/ui/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "#/ui/components/ui/popover"
import { Skeleton } from "#/ui/components/ui/skeleton"
import { cn } from "#/ui/lib/utils"

type DotStyle = CSSProperties & { "--dot": string }

/**
 * Pack the picker's width with chips before collapsing the rest into a count —
 * empty space on the last row is worse than one more badge. Three rows of chips
 * lands the picker at the same height as the three axis rows opposite it, so
 * neither side of the strip pushes the chart down on its own.
 */
const VISIBLE_CHIP_LIMIT = 11

/**
 * The chips are loose badges below the search bar, not a field of their own. The
 * registry dresses `ComboboxChips` as an input surface, so the box comes off and
 * only the wrapping row survives.
 */
const CHIPS_RESET_CLASS =
  "min-h-0 rounded-none border-0 bg-transparent p-0 focus-within:border-transparent focus-within:ring-0 has-data-[slot=combobox-chip]:px-0 dark:bg-transparent"

/** Uneven on purpose: model names differ in length, so equal blocks read as fake. */
const SKELETON_CHIP_WIDTHS = [
  "w-24",
  "w-32",
  "w-20",
  "w-28",
  "w-16",
  "w-24",
  "w-20",
  "w-28",
  "w-16",
  "w-32",
  "w-20",
]

/**
 * Mirrors `ComboboxChip`'s surface. The overflow list is portalled outside
 * `ComboboxChips`, so those badges can't be real chips — they only have to look
 * like them.
 */
const CHIP_SURFACE_CLASS =
  "bg-muted-foreground/10 text-foreground flex w-fit items-center gap-1 rounded-[calc(var(--radius-sm)-2px)] px-1.5 font-medium whitespace-nowrap"

/** The chart keys its series by family colour, so these dots are its legend. */
function ModelDot({ model }: { model: Model }) {
  const dotStyle: DotStyle = { "--dot": model.chartColor }

  return (
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full bg-(--dot)"
      style={dotStyle}
    />
  )
}

type ModelPickerProps = {
  models: Array<Model>
  selected: Array<string>
  onChange: (models: Array<string>) => void
  className?: string
  disabled?: boolean
}

export function ModelPicker({
  models,
  selected,
  onChange,
  className,
  disabled = false,
}: ModelPickerProps) {
  const inputId = useId()
  const anchor = useComboboxAnchor()
  const [moreOpen, setMoreOpen] = useState(false)
  const options = useMemo(
    () =>
      Array.from(new Map(models.map((model) => [model.model, model])).values()).toSorted(
        (left, right) => left.displayName.localeCompare(right.displayName),
      ),
    [models],
  )
  const selectedSet = new Set(selected)
  const value = options.filter((option) => selectedSet.has(option.model))
  const hidden = value.slice(VISIBLE_CHIP_LIMIT)
  // No models yet and the controls are locked: the request is still in flight.
  const isLoading = disabled && models.length === 0

  // Emptying the list from inside the popover unmounts its own trigger, so hand
  // focus back to the search bar rather than dropping it on the document.
  useEffect(() => {
    if (hidden.length > 0 || !moreOpen) return

    setMoreOpen(false)
    document.getElementById(inputId)?.focus()
  }, [hidden.length, moreOpen, inputId])

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        Models
      </label>
      <Combobox
        items={options}
        multiple
        value={value}
        onValueChange={(next: Array<Model>) => onChange(next.map((model) => model.model))}
        itemToStringLabel={(model: Model) => model.displayName}
        isItemEqualToValue={(item: Model, candidate: Model) => item.model === candidate.model}
        /* In multi-select Base UI treats the *last* value as the selected index and
           opens scrolled to it — alphabetical order made that a jump to the bottom.
           Highlighting the first item instead keeps the list where it starts. */
        autoHighlight
        disabled={disabled}
      >
        {/* The popup anchors to whatever it is told to; left alone it takes the
            `input`, which the leading icon insets from the bar's own edge. */}
        <div ref={anchor} className="w-full">
          <ComboboxInput
            id={inputId}
            placeholder="Search models"
            showTrigger={false}
            disabled={disabled}
            className="min-h-11 w-full sm:min-h-9"
          >
            <InputGroupAddon align="inline-start">
              <RiSearchLine aria-hidden="true" className="text-muted-foreground size-3.5" />
            </InputGroupAddon>
          </ComboboxInput>
        </div>
        {isLoading ? (
          <div aria-hidden="true" className="flex flex-wrap gap-1">
            {SKELETON_CHIP_WIDTHS.map((width, index) => (
              <Skeleton
                key={`${width}-${index}`}
                className={cn(
                  "h-8 text-sm sm:h-6 sm:text-xs rounded-[calc(var(--radius-sm)-2px)]",
                  width,
                )}
              />
            ))}
          </div>
        ) : null}
        {value.length > 0 ? (
          <ComboboxChips className={CHIPS_RESET_CLASS}>
            <ComboboxValue>
              {(shown: Array<Model>) => (
                <>
                  {/* Chips remove by render index, so they have to stay in value order —
                      taking the head keeps every visible chip pointing at its own model. */}
                  {shown.slice(0, VISIBLE_CHIP_LIMIT).map((model) => (
                    <ComboboxChip key={model.model} className="h-8 text-sm sm:h-6 sm:text-xs">
                      <ModelDot model={model} />
                      {model.displayName}
                    </ComboboxChip>
                  ))}
                </>
              )}
            </ComboboxValue>
            {hidden.length > 0 ? (
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                {/* Carries the chips' fill so it reads as a control among them
                    rather than as a caption sitting at the end of the row. */}
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Show ${hidden.length} more selected models`}
                      className="h-8 text-sm sm:h-6 sm:text-xs"
                    />
                  }
                >
                  {hidden.length} more
                  <RiArrowDownSLine aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2">
                  <ul className="flex flex-wrap gap-1">
                    {hidden.map((model) => (
                      <li
                        key={model.model}
                        className={cn(CHIP_SURFACE_CLASS, "h-8 text-sm sm:h-6 sm:text-xs")}
                      >
                        <ModelDot model={model} />
                        {model.displayName}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${model.displayName}`}
                          className="-mr-1 opacity-50 hover:opacity-100"
                          onClick={() => onChange(selected.filter((id) => id !== model.model))}
                        >
                          <RiCloseLine aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            ) : null}
          </ComboboxChips>
        ) : null}
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No models found.</ComboboxEmpty>
          <ComboboxList className="max-h-48">
            <ComboboxCollection>
              {(model: Model) => (
                <ComboboxItem
                  key={model.model}
                  value={model}
                  className="group/mark min-h-11 text-sm sm:min-h-8"
                >
                  <ModelLogo logoUrl={model.logoUrl} className="text-muted-foreground size-3.5" />
                  <span className="truncate">{model.displayName}</span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
