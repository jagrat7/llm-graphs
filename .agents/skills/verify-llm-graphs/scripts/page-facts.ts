/**
 * Reads one server-rendered compare page and prints what a reader sees on first paint, as JSON.
 * Usage: bun page-facts.ts <saved.html>
 */
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const file = process.argv[2]
if (!file) {
  console.error("usage: bun page-facts.ts <saved.html>")
  process.exit(2)
}

const { document } = new JSDOM(readFileSync(file, "utf8")).window
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, " ").trim() ?? null

/** Base UI selects keep their value in a hidden input named after the trigger's id. */
function combobox(label: string) {
  const trigger = document.querySelector(`[role="combobox"][aria-label="${label}"]`)
  if (!trigger) return null
  const input = document.getElementById(`${trigger.id}-hidden-input`)

  return {
    value: input?.getAttribute("value") || null,
    shown: text(trigger.querySelector('[data-slot="select-value"]')),
  }
}

/** A select that fills an axis, its data source, or the "via" note when the source is fixed. */
function axis(letter: "X" | "Y" | "Z") {
  const metric = combobox(`${letter}-axis metric`)
  if (!metric) return null
  const source = combobox(`${letter}-axis data source`)
  const trigger = document.querySelector(`[role="combobox"][aria-label="${letter}-axis metric"]`)
  const via = trigger?.closest('[data-slot="button-group"]')?.nextElementSibling

  return {
    metric: metric.value,
    label: metric.shown,
    source: source?.value ?? null,
    via: text(via)?.replace(/^via\s*/, "") ?? null,
  }
}

const ghost = document.querySelector('[data-slot="model-picker-ghost"]')
const chips = ghost
  ? [...ghost.querySelectorAll(":scope > div > span:not([data-more])")].map((chip) => text(chip))
  : []
const pickerTrigger = [...document.querySelectorAll('[data-slot="popover-trigger"]')].find((el) =>
  text(el)?.startsWith("Models"),
)

const facts = {
  title: text(document.querySelector("title")),
  heading: text(document.querySelector("h1")),
  axes: {
    x: axis("X"),
    y: axis("Y"),
    z: axis("Z"),
    zAddable: document.querySelector('[aria-label="Add Z axis"]') != null,
  },
  models: {
    count: Number(text(pickerTrigger)?.replace(/\D+/g, "") || NaN),
    chips,
    more: text(ghost?.querySelector("[data-more]")),
  },
  chartAnnouncement: text(document.querySelector('[aria-live="polite"]')),
  chartFrame: document.querySelector("[data-chart-frame]")?.getAttribute("data-chart-frame") ?? null,
  emptyState: text(document.querySelector('[data-slot="empty-title"]')),
  emptyActions: [...document.querySelectorAll('[data-slot="empty-content"] button')].map(text),
  alerts: [...document.querySelectorAll('[data-slot="alert-title"]')].map(text),
  themeToggle: document.querySelector('[aria-label^="Switch to"]')?.getAttribute("aria-label") ?? null,
  settingsButton: document.querySelector('[aria-label="Settings"]') != null,
}

console.log(JSON.stringify(facts, null, 2))
