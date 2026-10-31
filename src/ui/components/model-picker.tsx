import type { FocusEvent, HTMLAttributes } from "react"

import { RiArrowDownSLine, RiCloseLine, RiListCheck, RiSearchLine } from "@remixicon/react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import type { Model } from "#/ui/lib/model-view"

import { groupByVendor, ModelChecklist } from "#/ui/components/model-checklist"
import { ModelLogo } from "#/ui/components/model-logo"
import { Button } from "#/ui/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "#/ui/components/ui/combobox"
import { InputGroupAddon, InputGroupButton } from "#/ui/components/ui/input-group"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#/ui/components/ui/popover"
import { Skeleton } from "#/ui/components/ui/skeleton"
import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { cn } from "#/ui/lib/utils"

/**
 * The picks are a key, three columns by three rows: fixed cells line up the way the axes'
 * fields opposite do, and three chip rows under the search are exactly their height.
 */
const LEGEND_SLOTS = 9

/**
 * Touch has no hover, so every entry carries its remove button in line; on a narrow picker
 * that leaves a third of the width too little for a name, so the key drops to two columns.
 */
const LEGEND_GRID_CLASS =
  "grid auto-rows-(--chip) grid-cols-3 gap-1 pointer-coarse:@max-md:grid-cols-2"

/**
 * A short ruling in the gap after each pick, so the open cells still read as columns. None
 * after a row's last cell or the key's last pick; the row length is the grid's column count.
 * Touch goes without: every pick there already ends in its remove button.
 */
const COLUMN_RULE_CLASS =
  "*:relative *:after:absolute *:after:inset-y-1 *:after:-end-[2.5px] *:after:w-px *:after:bg-border *:last:after:hidden pointer-coarse:*:after:hidden"
const LEGEND_RULE_CLASS = cn(COLUMN_RULE_CLASS, "*:nth-[3n]:after:hidden")
const OVERFLOW_RULE_CLASS = cn(COLUMN_RULE_CLASS, "*:nth-[2n]:after:hidden")

/** Uneven on purpose: model names differ in length, so equal blocks read as fake. */
const SKELETON_WIDTHS = ["w-20", "w-16", "w-24", "w-14", "w-20", "w-16", "w-24", "w-12", "w-20"]

type ModelPickerProps = {
  models: Array<Model>
  selected: Array<string>
  onChange: (models: Array<string>) => void
  /** Restores the default comparison; the list offers a reset only when this is given. */
  onReset?: () => void
  /** Reports the model whose entry is hovered or focused, so the chart can emphasise it. */
  onHighlightChange?: (model: string | null) => void
  className?: string
  disabled?: boolean
  /** Focuses the search on `/`. Only one picker on a page should claim the key. */
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
  const checklistRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
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
  // A full key shows every pick; one more than fits gives its last cell to the count.
  const shown = value.length > LEGEND_SLOTS ? value.slice(0, LEGEND_SLOTS - 1) : value
  const hidden = value.slice(shown.length)
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
      // Moving between an entry and its own remove button is still the same entry.
      if (event.currentTarget.contains(event.relatedTarget)) return

      setFocusedModel((current) => (current === model ? null : current))
    },
  })

  // An unmounted entry never reports leaving or blurring — whether it was deselected or
  // shut away with its list — so forget it once it goes; otherwise its highlight would
  // linger, or come back with it, with nobody holding it. The open checklist has a row
  // for every selected model, so all of them count.
  const mountedKey = (moreOpen || listOpen ? value : shown).map((model) => model.model).join("\n")

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

  // Emptying the overflow from inside its popover unmounts the popover's own trigger.
  useEffect(() => {
    if (hidden.length > 0 || !moreOpen) return

    setMoreOpen(false)
    document.getElementById(inputId)?.focus()
  }, [hidden.length, moreOpen, inputId])

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

  // The remove button goes with its entry, so focus moves to the search rather than the page.
  function removeModel(model: string) {
    onChange(selected.filter((id) => id !== model))
    document.getElementById(inputId)?.focus()
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
      document.getElementById(inputId)?.focus()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcut, disabled, inputId])

  return (
    <div className={cn("@container flex w-full flex-col gap-1", className)}>
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
        // emphasis a hovered entry gives. The automatic first-item highlight on open is
        // not a gesture, so it is ignored.
        onItemHighlighted={(model: Model | undefined, { reason }: { reason: string }) =>
          setListModel(reason === "none" ? null : (model?.model ?? null))
        }
        onOpenChange={(open: boolean) => {
          setSuggestionsOpen(open)
          if (open) return

          setListModel(null)
        }}
        disabled={disabled}
      >
        {/* The popup anchors to whatever it is told to; left alone it takes the
            `input`, which the leading icon insets from the bar's own edge. */}
        <div ref={anchor}>
          <ComboboxInput
            id={inputId}
            placeholder="Search or browse models"
            aria-keyshortcuts={shortcut ? "/" : undefined}
            title={shortcut ? "Search models (/)" : "Search models"}
            showTrigger={false}
            disabled={disabled}
            // The field step, as the axis selects opposite are.
            className="h-control-xl w-full"
            onKeyDown={(event) => {
              // Escape dismisses suggestions, but must never clear the selection.
              if (event.key !== "Escape" || suggestionsOpen) return

              event.preventBaseUIHandler()
            }}
          >
            <InputGroupAddon align="inline-start">
              <RiSearchLine aria-hidden="true" className="text-muted-foreground size-3.5" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end" className="pe-1">
              {/* The shortcut's hint, until the field is in use and "/" would type; touch has no
                  key for it. Only the field counts: the list button shares the bar and takes
                  focus back when its list closes, and "/" still works from there. */}
              {shortcut ? (
                <kbd
                  data-slot="kbd"
                  aria-hidden="true"
                  className="me-1 inline-flex h-5 min-w-5 items-center justify-center font-mono group-has-[input:focus]/input-group:hidden group-has-[input:not(:placeholder-shown)]/input-group:hidden pointer-coarse:hidden"
                >
                  /
                </kbd>
              ) : null}
              <Popover open={listOpen} onOpenChange={handleListOpenChange}>
                {/* The full list opens from the count, so the bar stays one control. */}
                <PopoverTrigger
                  render={
                    <InputGroupButton
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      aria-label={`Models, ${value.length} selected`}
                      className="text-foreground h-control-md gap-1 px-2"
                    />
                  }
                >
                  <RiListCheck aria-hidden="true" className="size-3.5" />
                  <span className={COUNT_TEXT_CLASS}>{value.length}</span>
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
                  <div
                    ref={checklistRef}
                    className="min-h-0 overflow-y-auto overscroll-contain p-2"
                  >
                    <ModelChecklist
                      groups={groups}
                      selected={selectedSet}
                      onToggle={toggleModel}
                      rowProps={highlightHandlers}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </InputGroupAddon>
          </ComboboxInput>
        </div>
        {isLoading ? (
          <div aria-hidden="true" className={LEGEND_GRID_CLASS}>
            {SKELETON_WIDTHS.map((width, index) => (
              <Skeleton key={index} className={cn("my-auto h-3 rounded-sm", width)} />
            ))}
          </div>
        ) : value.length > 0 ? (
          <ul aria-label="Selected models" className={cn(LEGEND_GRID_CLASS, LEGEND_RULE_CLASS)}>
            {shown.map((model) => (
              <LegendEntry
                key={model.model}
                model={model}
                onRemove={() => removeModel(model.model)}
                {...highlightHandlers(model.model)}
              />
            ))}
            {hidden.length > 0 ? (
              <li>
                <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                  {/* Opens on hover so the rest can be skimmed in passing; a click still
                      toggles it for touch and keyboard. */}
                  <PopoverTrigger
                    openOnHover
                    delay={100}
                    closeDelay={150}
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Show ${hidden.length} more selected models`}
                        className="text-muted-foreground h-chip w-full justify-start px-1.5"
                      />
                    }
                  >
                    <span className={COUNT_TEXT_CLASS}>+{hidden.length}</span> more
                    <RiArrowDownSLine aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-2">
                    <ul
                      className={cn(
                        "grid max-h-64 auto-rows-(--chip) grid-cols-2 gap-1 overflow-y-auto",
                        OVERFLOW_RULE_CLASS,
                      )}
                    >
                      {hidden.map((model) => (
                        <LegendEntry
                          key={model.model}
                          model={model}
                          onRemove={() => onChange(selected.filter((id) => id !== model.model))}
                          {...highlightHandlers(model.model)}
                        />
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              </li>
            ) : null}
          </ul>
        ) : null}
        <ComboboxContent anchor={anchor} className="text-field">
          <ComboboxEmpty>No models found.</ComboboxEmpty>
          <ComboboxList className="max-h-56">
            <ComboboxCollection>
              {(model: Model) => (
                // Says what a click will do, so the row needs no check of its own.
                <ComboboxItem key={model.model} value={model} showIndicator={false}>
                  <ModelLogo
                    logoUrl={model.logoUrl}
                    color={model.chartColor}
                    className="size-3.5"
                  />
                  <span data-slot="model-picker-option-name" className="min-w-0 flex-1 truncate">
                    {model.displayName}
                  </span>
                  <span className="text-muted-foreground text-control">
                    {selectedSet.has(model.model) ? "Remove" : "Add"}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

/** One pick in the key: the chart's mark for it, its name, and a way to drop it. */
function LegendEntry({
  model,
  onRemove,
  ...props
}: { model: Model; onRemove: () => void } & HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="model-picker-entry"
      title={model.displayName}
      className="group/entry text-control hover:bg-muted focus-within:bg-muted relative flex min-w-0 items-center gap-1.5 rounded-sm ps-1.5 font-medium transition-colors"
      {...props}
    >
      {/* Grey at rest so the key doesn't compete with the chart; a hover or focus brings
          back the vendor's colour. Touch has no hover, so there it keeps its colour. */}
      <ModelLogo
        logoUrl={model.logoUrl}
        color={model.chartColor}
        className="size-3 grayscale transition-[filter] group-focus-within/entry:grayscale-0 group-hover/entry:grayscale-0 pointer-coarse:grayscale-0"
      />
      <span className="min-w-0 flex-1 truncate">{model.displayName}</span>
      {/* Laid over the name's tail rather than beside it, so showing it never re-truncates
          the name. Touch has no hover to reveal it, so there it always shows, in line. */}
      <span className="from-muted via-muted absolute inset-y-0 end-0 flex items-center rounded-e-sm bg-linear-to-l via-70% to-transparent ps-3 pe-0.5 opacity-0 group-focus-within/entry:opacity-100 group-hover/entry:opacity-100 pointer-coarse:static pointer-coarse:bg-none pointer-coarse:ps-0 pointer-coarse:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${model.displayName}`}
          onClick={onRemove}
        >
          <RiCloseLine aria-hidden="true" />
        </Button>
      </span>
    </li>
  )
}
