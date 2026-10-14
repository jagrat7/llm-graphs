import type { CSSProperties, FocusEvent } from "react"

import { RiArrowDownSLine, RiCloseLine, RiSearchLine } from "@remixicon/react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { ModelLogo } from "#/ui/components/model-logo"
import { Button, buttonVariants } from "#/ui/components/ui/button"
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
 * Three rows of chips lands the picker at the same height as the three axis rows
 * opposite it, so neither side of the strip pushes the chart down on its own.
 * Names vary too much in length for a fixed chip count to hold that, so the rows
 * are measured instead.
 */
const CHIP_ROWS = 3

const CHIP_SIZE_CLASS = "h-8 text-sm sm:h-6 sm:text-xs"

/**
 * The chips are loose badges below the search bar, not a field of their own. The
 * registry dresses `ComboboxChips` as an input surface, so the box comes off and
 * only the wrapping row survives.
 */
const CHIPS_RESET_CLASS =
  "min-h-0 rounded-none border-0 bg-transparent p-0 focus-within:border-transparent focus-within:ring-0 has-data-[slot=combobox-chip]:px-0 dark:bg-transparent"

/**
 * Uneven on purpose: model names differ in length, so equal blocks read as fake.
 * Three rows' worth at the picker's desktop width, like the chips they stand in for.
 */
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
]

/**
 * Mirrors `ComboboxChip`'s surface. The overflow list is portalled outside
 * `ComboboxChips`, so those badges can't be real chips — they only have to look
 * like them.
 */
const CHIP_SURFACE_CLASS =
  "bg-muted-foreground/10 text-foreground flex w-fit items-center gap-1 rounded-[calc(var(--radius-sm)-2px)] px-1.5 font-medium whitespace-nowrap"

type ChipFit = {
  /** Width of the row the chips wrap in. */
  available: number
  gap: number
  rows: number
  /** Width of the trigger that stands in for whatever doesn't fit. */
  moreWidth: number
}

/**
 * Pack the rows with chips before collapsing the rest into a count — empty space
 * on the last row is worse than one more badge. Replays `flex-wrap` over measured
 * widths; once anything is left out, the count trigger has to fit on the rows too.
 */
export function countFittingChips(
  widths: ReadonlyArray<number>,
  { available, gap, rows, moreWidth }: ChipFit,
) {
  const fits = (items: ReadonlyArray<number>) => {
    let row = 1
    let used: number | null = null

    for (const width of items) {
      const next: number = used == null ? width : used + gap + width

      // A chip wider than the row still takes a row of its own, as flex does.
      if (used == null || next <= available) {
        used = next
        continue
      }

      row += 1
      used = width
      if (row > rows) return false
    }

    return true
  }

  if (fits(widths)) return widths.length

  let count = widths.length - 1

  while (count > 0 && !fits([...widths.slice(0, count), moreWidth])) count -= 1

  return count
}

/**
 * Reads the ghost row: every selected chip at its natural width, then the count
 * trigger. Widths round up so a sub-pixel miss can only drop a chip, never wrap
 * one onto a fourth row.
 */
function measureFittingChips(ghost: HTMLElement) {
  const row = ghost.firstElementChild

  if (!(row instanceof HTMLElement)) return 0

  const widths = Array.from(row.children, (child) => Math.ceil(child.getBoundingClientRect().width))
  const moreWidth = widths.pop() ?? 0

  return countFittingChips(widths, {
    available: ghost.getBoundingClientRect().width,
    gap: Number.parseFloat(getComputedStyle(row).columnGap) || 0,
    rows: CHIP_ROWS,
    moreWidth,
  })
}

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
  /** Reports the model whose pill is hovered or focused, so the chart can emphasise it. */
  onHighlightChange?: (model: string | null) => void
  className?: string
  disabled?: boolean
}

export function ModelPicker({
  models,
  selected,
  onChange,
  onHighlightChange,
  className,
  disabled = false,
}: ModelPickerProps) {
  const inputId = useId()
  const anchor = useComboboxAnchor()
  const [moreOpen, setMoreOpen] = useState(false)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY)
  const options = useMemo(
    () =>
      Array.from(new Map(models.map((model) => [model.model, model])).values()).toSorted(
        (left, right) => left.displayName.localeCompare(right.displayName),
      ),
    [models],
  )
  const selectedSet = new Set(selected)
  const value = options.filter((option) => selectedSet.has(option.model))
  const hidden = value.slice(visibleCount)
  const hasChips = value.length > 0
  const valueKey = value.map((model) => model.model).join("\n")
  // No models yet and the controls are locked: the request is still in flight.
  const isLoading = disabled && models.length === 0
  // Pointer, list and focus highlights are tracked apart so ending one gesture never
  // clears a highlight another still holds; the pointer wins, then the list, then focus.
  const [hoveredModel, setHoveredModel] = useState<string | null>(null)
  const [listModel, setListModel] = useState<string | null>(null)
  const [focusedModel, setFocusedModel] = useState<string | null>(null)
  const highlightedModel = hoveredModel ?? listModel ?? focusedModel
  const highlightHandlers = (model: string) => ({
    onPointerEnter: () => setHoveredModel(model),
    onPointerLeave: () => setHoveredModel((current) => (current === model ? null : current)),
    onFocus: () => setFocusedModel(model),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      // Moving between a pill and its own remove button is still the same pill.
      if (event.currentTarget.contains(event.relatedTarget)) return

      setFocusedModel((current) => (current === model ? null : current))
    },
  })

  // A removed pill never reports leaving or blurring, so forget it once it is deselected —
  // otherwise selecting it again would bring back a highlight nobody is holding.
  useEffect(() => {
    const keep = (current: string | null) =>
      current != null && selected.includes(current) ? current : null

    setHoveredModel(keep)
    setFocusedModel(keep)
  }, [selected])

  useEffect(() => {
    onHighlightChange?.(highlightedModel)
  }, [highlightedModel, onHighlightChange])

  // Measured before paint, so a new selection never flashes past the row limit.
  useLayoutEffect(() => {
    if (ghostRef.current) setVisibleCount(measureFittingChips(ghostRef.current))
  }, [valueKey])

  // The row narrows with the viewport, and chips widen once the web font lands.
  useEffect(() => {
    const ghost = ghostRef.current

    if (!hasChips || !ghost?.firstElementChild || typeof ResizeObserver === "undefined")
      return undefined

    const observer = new ResizeObserver(() => setVisibleCount(measureFittingChips(ghost)))

    observer.observe(ghost)
    observer.observe(ghost.firstElementChild)

    return () => observer.disconnect()
  }, [hasChips])

  // Closing the overflow list unmounts its pills before they can report leaving.
  function handleMoreOpenChange(open: boolean) {
    setMoreOpen(open)

    if (open) return

    const overflow = new Set(hidden.map((model) => model.model))
    const keep = (current: string | null) =>
      current != null && overflow.has(current) ? null : current

    setHoveredModel(keep)
    setFocusedModel(keep)
  }

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
        // Arrowing (or pointing) through the list is the keyboard route to the same
        // emphasis a hovered pill gives; Base UI keeps the chips themselves out of tab order.
        // The automatic first-item highlight on open is not a gesture, so it is ignored.
        onItemHighlighted={(model: Model | undefined, { reason }: { reason: string }) =>
          setListModel(reason === "none" ? null : (model?.model ?? null))
        }
        onOpenChange={(open: boolean) => {
          if (!open) setListModel(null)
        }}
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
                className={cn(CHIP_SIZE_CLASS, "rounded-[calc(var(--radius-sm)-2px)]", width)}
              />
            ))}
          </div>
        ) : null}
        {hasChips ? (
          <div className="relative">
            {/* Every chip laid out unwrapped, out of sight, so the real row knows how many
              it can hold. Zero height and clipped, so its overflow never scrolls the page. */}
            <div
              ref={ghostRef}
              data-slot="model-picker-ghost"
              aria-hidden="true"
              className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
            >
              <div className="flex w-max gap-1">
                {value.map((model) => (
                  <span
                    key={model.model}
                    className={cn(CHIP_SURFACE_CLASS, CHIP_SIZE_CLASS, "pr-0")}
                  >
                    <ModelDot model={model} />
                    {model.displayName}
                    {/* The remove button's footprint, overlap included. */}
                    <span className="-ml-1 size-5" />
                  </span>
                ))}
                <span
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: CHIP_SIZE_CLASS,
                  })}
                >
                  {value.length} more
                  <RiArrowDownSLine />
                </span>
              </div>
            </div>
            <ComboboxChips className={CHIPS_RESET_CLASS}>
              <ComboboxValue>
                {(shown: Array<Model>) => (
                  <>
                    {/* Chips remove by render index, so they have to stay in value order —
                      taking the head keeps every visible chip pointing at its own model. */}
                    {shown.slice(0, visibleCount).map((model) => (
                      <ComboboxChip
                        key={model.model}
                        className={CHIP_SIZE_CLASS}
                        {...highlightHandlers(model.model)}
                      >
                        <ModelDot model={model} />
                        {model.displayName}
                      </ComboboxChip>
                    ))}
                  </>
                )}
              </ComboboxValue>
              {hidden.length > 0 ? (
                <Popover open={moreOpen} onOpenChange={handleMoreOpenChange}>
                  {/* Carries the chips' fill so it reads as a control among them
                    rather than as a caption sitting at the end of the row. */}
                  {/* Opens on hover so the rest can be skimmed in passing; a click still
                    toggles it for touch and keyboard. */}
                  <PopoverTrigger
                    openOnHover
                    delay={100}
                    closeDelay={150}
                    render={
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Show ${hidden.length} more selected models`}
                        className={CHIP_SIZE_CLASS}
                      />
                    }
                  >
                    {hidden.length} more
                    <RiArrowDownSLine aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-2">
                    <ul className="flex max-h-64 flex-wrap gap-1 overflow-y-auto">
                      {hidden.map((model) => (
                        <li
                          key={model.model}
                          className={cn(CHIP_SURFACE_CLASS, CHIP_SIZE_CLASS)}
                          {...highlightHandlers(model.model)}
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
          </div>
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
