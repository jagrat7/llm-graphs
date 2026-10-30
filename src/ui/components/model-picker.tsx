import type { CSSProperties, FocusEvent } from "react"

import { RiArrowDownSLine, RiCloseLine, RiSearchLine } from "@remixicon/react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { groupByVendor, ModelChecklist } from "#/ui/components/model-checklist"
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
  comboboxChipClass,
  comboboxChipRemoveClass,
  comboboxChipSizeClass,
  useComboboxAnchor,
} from "#/ui/components/ui/combobox"
import { InputGroupAddon } from "#/ui/components/ui/input-group"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#/ui/components/ui/popover"
import { Skeleton } from "#/ui/components/ui/skeleton"
import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { cn } from "#/ui/lib/utils"

type DotStyle = CSSProperties & { "--dot": string }

/**
 * The chips are loose badges below the search bar, not a field of their own. The
 * registry dresses `ComboboxChips` as an input surface, so the box comes off and
 * only the wrapping row survives.
 */
const CHIPS_RESET_CLASS =
  "min-h-0 rounded-none border-0 bg-transparent p-0 focus-within:border-transparent focus-within:ring-0 has-data-[slot=combobox-chip]:px-0 dark:bg-transparent"

/**
 * Uneven on purpose: model names differ in length, so equal blocks read as fake.
 * More than the chip area holds at any width; it clips the rest, as it does chips.
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

type ChipFit = {
  /** Width of the row the chips wrap in. */
  available: number
  gap: number
  rows: number
  /** Width of the trigger that stands in for however many chips don't fit. */
  moreWidth: (hiddenCount: number) => number
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

  while (count > 0 && !fits([...widths.slice(0, count), moreWidth(widths.length - count)]))
    count -= 1

  return count
}

const roundedWidth = (element: Element) => Math.ceil(element.getBoundingClientRect().width)

/**
 * Reads the ghost, which covers the chip area: its box is the space to fill, and its
 * row holds every selected chip at its natural width, then one count trigger per digit
 * length. Widths round up so a sub-pixel miss can only drop a chip, never wrap one
 * past the last row that fits.
 */
function measureFittingChips(ghost: HTMLElement) {
  const row = ghost.firstElementChild

  if (!(row instanceof HTMLElement)) return 0

  const children = Array.from(row.children)
  const widths = children.filter((child) => !child.hasAttribute("data-more")).map(roundedWidth)
  const moreWidths = children.filter((child) => child.hasAttribute("data-more")).map(roundedWidth)
  const area = ghost.getBoundingClientRect()
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
  const rows = Math.floor((area.height + gap) / (row.getBoundingClientRect().height + gap))

  return countFittingChips(widths, {
    available: area.width,
    gap,
    // The area is never shorter than a row, so a short count only means it hasn't laid out.
    rows: rows >= 1 ? rows : 1,
    moreWidth: (hiddenCount) => moreWidths[String(hiddenCount).length - 1] ?? 0,
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
  /** Restores the default comparison; the list offers a reset only when this is given. */
  onReset?: () => void
  /** Reports the model whose pill is hovered or focused, so the chart can emphasise it. */
  onHighlightChange?: (model: string | null) => void
  className?: string
  disabled?: boolean
  /** Opens the search on `/`. Only one picker on a page should claim the key. */
  shortcut?: boolean
}

export function ModelPicker({
  models,
  selected,
  onChange,
  onReset,
  onHighlightChange,
  className,
  disabled = false,
  shortcut = false,
}: ModelPickerProps) {
  const inputId = useId()
  const anchor = useComboboxAnchor()
  const listTriggerRef = useRef<HTMLButtonElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const checklistRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  // Search is the quick route for a model you can name; the checklist is the main
  // one, so the search bar folds down to a button until it is asked for.
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  // Where focus lands when the search folds or unfolds; null leaves it alone.
  const focusAfterSearchToggle = useRef<"input" | "button" | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY)
  const options = useMemo(
    () =>
      Array.from(new Map(models.map((model) => [model.model, model])).values()).toSorted(
        (left, right) => left.displayName.localeCompare(right.displayName),
      ),
    [models],
  )
  const groups = useMemo(() => groupByVendor(options), [options])
  const selectedSet = new Set(selected)
  const value = options.filter((option) => selectedSet.has(option.model))
  const hidden = value.slice(visibleCount)
  const hasChips = value.length > 0
  const valueKey = value.map((model) => model.model).join("\n")
  // No models yet and the controls are locked: the request is still in flight.
  const isLoading = disabled && models.length === 0
  const hasChipArea = isLoading || hasChips
  // The server can't measure, so chips wait for the browser's first count; until then the
  // skeleton holds their place rather than every chip showing and then folding away.
  const isMeasured = Number.isFinite(visibleCount)
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

  // An unmounted pill never reports leaving or blurring — whether it was deselected,
  // squeezed into the overflow list, or shut away with it — so forget it once it goes;
  // otherwise its highlight would linger, or come back with it, with nobody holding it.
  // The open checklist has a row for every selected model, so all of them count.
  const mountedKey = (moreOpen || listOpen ? value : value.slice(0, visibleCount))
    .map((model) => model.model)
    .join("\n")

  useEffect(() => {
    const mounted = new Set(mountedKey.split("\n"))
    const keep = (current: string | null) =>
      current != null && mounted.has(current) ? current : null

    setHoveredModel(keep)
    setFocusedModel(keep)
  }, [mountedKey])

  useEffect(() => {
    onHighlightChange?.(highlightedModel)
  }, [highlightedModel, onHighlightChange])

  // Measured before paint, so a new selection never flashes past the row limit.
  useLayoutEffect(() => {
    if (ghostRef.current) setVisibleCount(measureFittingChips(ghostRef.current))
  }, [valueKey])

  // The area follows the viewport and the axes opposite, and chips widen once the web
  // font lands.
  useEffect(() => {
    const ghost = ghostRef.current

    if (!hasChipArea || !ghost?.firstElementChild || typeof ResizeObserver === "undefined")
      return undefined

    const observer = new ResizeObserver(() => setVisibleCount(measureFittingChips(ghost)))

    observer.observe(ghost)
    observer.observe(ghost.firstElementChild)

    return () => observer.disconnect()
  }, [hasChipArea])

  // Emptying the list from inside the popover unmounts its own trigger, so hand
  // focus to the model list's button rather than dropping it on the document.
  useEffect(() => {
    if (hidden.length > 0 || !moreOpen) return

    setMoreOpen(false)
    listTriggerRef.current?.focus()
  }, [hidden.length, moreOpen])

  // Closing the checklist unmounts its rows before they can report leaving.
  function handleListOpenChange(open: boolean) {
    setListOpen(open)

    if (open) return

    setHoveredModel(null)
    setFocusedModel(null)
  }

  function toggleModel(model: string) {
    onChange(selectedSet.has(model) ? selected.filter((id) => id !== model) : [...selected, model])
  }

  function openSearch() {
    focusAfterSearchToggle.current = "input"
    setSearchOpen(true)
  }

  function closeSearch(returnFocus: boolean) {
    focusAfterSearchToggle.current = returnFocus ? "button" : null
    setSearchOpen(false)
  }

  // The field and its button swap places, so focus can only move once the new one is mounted.
  useEffect(() => {
    const target = focusAfterSearchToggle.current
    focusAfterSearchToggle.current = null

    if (target === "input") document.getElementById(inputId)?.focus()
    if (target === "button") searchButtonRef.current?.focus()
  }, [searchOpen, inputId])

  // Folds the search away once nothing is using it. Runs a frame late because
  // picking a suggestion briefly moves focus before handing it back to the field.
  function closeSearchIfIdle() {
    requestAnimationFrame(() => {
      if (document.activeElement?.id === inputId) return

      closeSearch(false)
    })
  }

  useEffect(() => {
    if (!shortcut || disabled) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // A slash typed into a field is text, not a shortcut.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return
      }

      event.preventDefault()
      openSearch()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcut, disabled])

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <label htmlFor={inputId} className="sr-only">
        Models
      </label>
      <Combobox
        items={options}
        multiple
        value={value}
        // The combobox only knows the models offered here; picks this benchmark lacks stay picked.
        onValueChange={(next: Array<Model>) =>
          onChange([
            ...selected.filter((id) => !options.some((option) => option.model === id)),
            ...next.map((model) => model.model),
          ])
        }
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
          setSuggestionsOpen(open)
          if (open) return

          setListModel(null)
          closeSearchIfIdle()
        }}
        disabled={disabled}
      >
        <div className="flex w-full items-center gap-2">
          {searchOpen ? (
            /* The popup anchors to whatever it is told to; left alone it takes the
               `input`, which the leading icon insets from the bar's own edge. */
            <div ref={anchor} className="min-w-0 flex-1">
              <ComboboxInput
                id={inputId}
                placeholder="Search models"
                showTrigger={false}
                disabled={disabled}
                // The field step, as the axis selects opposite are.
                className="h-control-xl w-full"
                onBlur={() => {
                  if (!suggestionsOpen) closeSearchIfIdle()
                }}
                onKeyDown={(event) => {
                  // The first Escape closes the suggestions; the next folds the search.
                  // Base UI would spend that second press clearing every selected
                  // model, which is never what leaving a search box means.
                  if (event.key !== "Escape" || suggestionsOpen) return

                  event.preventBaseUIHandler()
                  closeSearch(true)
                }}
              >
                <InputGroupAddon align="inline-start">
                  <RiSearchLine aria-hidden="true" className="text-muted-foreground size-3.5" />
                </InputGroupAddon>
              </ComboboxInput>
            </div>
          ) : (
            <Button
              ref={searchButtonRef}
              variant="ghost"
              size="icon-xl"
              aria-label="Search models"
              aria-keyshortcuts={shortcut ? "/" : undefined}
              title={shortcut ? "Search models (/)" : "Search models"}
              disabled={disabled}
              onClick={openSearch}
            >
              <RiSearchLine aria-hidden="true" />
            </Button>
          )}
          <Popover open={listOpen} onOpenChange={handleListOpenChange}>
            {/* The checklist is the picker's main surface, so its button takes the
                row; it gives the room back while the search is open. */}
            <PopoverTrigger
              render={
                <Button
                  ref={listTriggerRef}
                  variant="outline"
                  size="xl"
                  disabled={disabled}
                  className={cn("justify-between gap-2", searchOpen ? "shrink-0" : "flex-1")}
                />
              }
            >
              <span>
                Models{" "}
                <span className={cn(COUNT_TEXT_CLASS, "text-muted-foreground")}>
                  {value.length}
                </span>
              </span>
              <RiArrowDownSLine aria-hidden="true" className="text-muted-foreground size-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              // Opening the list is for checking models, so start on the first box
              // rather than on Reset or Clear, which sit first in tab order.
              initialFocus={() =>
                checklistRef.current?.querySelector<HTMLElement>("[role=checkbox]")
              }
              className="max-h-[min(32rem,var(--available-height))] w-[min(42rem,var(--available-width))] gap-0 p-0"
            >
              <div className="border-border text-field flex items-center gap-2 border-b px-3 py-2">
                <PopoverTitle>Models</PopoverTitle>
                <span className="text-muted-foreground">
                  <span className={COUNT_TEXT_CLASS}>{value.length}</span> selected
                </span>
                <span className="flex-1" />
                {onReset ? (
                  <Button variant="ghost" size="sm" onClick={onReset}>
                    Reset
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  // Ids a benchmark lacks still count: an old shared link can carry them.
                  disabled={selected.length === 0}
                  onClick={() => onChange([])}
                >
                  Clear
                </Button>
              </div>
              <div ref={checklistRef} className="min-h-0 overflow-y-auto overscroll-contain p-2">
                <ModelChecklist
                  groups={groups}
                  selected={selectedSet}
                  onToggle={toggleModel}
                  rowProps={highlightHandlers}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {hasChipArea ? (
          /* Takes whatever height the picker is given past its controls, and three chip rows
             when it's given none. Size containment keeps the chips themselves out of the
             picker's height, so a long selection folds into the count instead of growing it.
             Three rows and the two `gap-1`s between them, plus the controls, is exactly the
             axes' height opposite on a fine pointer. */
          <div className="relative min-h-[calc(3*var(--chip)+2*--spacing(1))] flex-1 overflow-hidden contain-size">
            {/* Every chip laid out unwrapped, out of sight, so the real row knows how many
              it can hold. Covers the area and is clipped to it, so it measures the space too. */}
            <div
              ref={ghostRef}
              data-slot="model-picker-ghost"
              aria-hidden="true"
              className="pointer-events-none invisible absolute inset-0 overflow-hidden"
            >
              <div className="flex w-max gap-1">
                {value.map((model) => (
                  <span key={model.model} className={cn(comboboxChipClass, "pr-0")}>
                    <ModelDot model={model} />
                    {model.displayName}
                    {/* The remove button's footprint, overlap included, from its own recipe. */}
                    <span
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-xs" }),
                        comboboxChipRemoveClass,
                      )}
                    />
                  </span>
                ))}
                {/* Digits are tabular, so the trigger's width only turns on how many the
                  hidden count has — one stand-in per length covers every count. */}
                {Array.from({ length: String(value.length).length }, (_, index) => (
                  <span
                    key={index}
                    data-more=""
                    // Merged as `Button` merges it: cva only appends, which would leave the
                    // button's own height fighting the chip's.
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      comboboxChipSizeClass,
                      // Measured, so it must never be caught mid-transition.
                      "transition-none",
                    )}
                  >
                    {"0".repeat(index + 1)} more
                    <RiArrowDownSLine />
                  </span>
                ))}
              </div>
            </div>
            {isLoading || !isMeasured ? (
              <div aria-hidden="true" className="flex flex-wrap gap-1">
                {SKELETON_CHIP_WIDTHS.map((width, index) => (
                  <Skeleton
                    key={`${width}-${index}`}
                    className={cn(
                      comboboxChipSizeClass,
                      "rounded-[calc(var(--radius-sm)-2px)]",
                      width,
                    )}
                  />
                ))}
              </div>
            ) : (
              <ComboboxChips className={CHIPS_RESET_CLASS}>
                <ComboboxValue>
                  {(shown: Array<Model>) => (
                    <>
                      {/* Chips remove by render index, so they have to stay in value order —
                      taking the head keeps every visible chip pointing at its own model. */}
                      {shown.slice(0, visibleCount).map((model) => (
                        <ComboboxChip key={model.model} {...highlightHandlers(model.model)}>
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
                          className={cn(comboboxChipSizeClass, "hit-area")}
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
                            // The overflow list is portalled outside `ComboboxChips`, so these can't be
                            // real chips; they share the chip's recipe instead.
                            className={cn(comboboxChipClass, "pr-0")}
                            {...highlightHandlers(model.model)}
                          >
                            <ModelDot model={model} />
                            {model.displayName}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove ${model.displayName}`}
                              className={comboboxChipRemoveClass}
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
            )}
          </div>
        ) : null}
        <ComboboxContent anchor={anchor} className="text-field">
          <ComboboxEmpty>No models found.</ComboboxEmpty>
          <ComboboxList className="max-h-48">
            <ComboboxCollection>
              {(model: Model) => (
                <ComboboxItem key={model.model} value={model} className="group/mark">
                  <ModelLogo
                    logoUrl={model.logoUrl}
                    color={model.chartColor}
                    className="size-3.5"
                  />
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
