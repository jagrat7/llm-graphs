---
name: LLM Graphs
description: Compare language models on a plot, the way an engineer would on a ruled pad.
colors:
  cream-stock: "oklch(0.962 0.014 88)"
  fresh-sheet: "oklch(0.982 0.009 88)"
  drafting-ink: "oklch(0.23 0.022 262)"
  ruling-pen: "oklch(0.44 0.085 222)"
  tinted-margin: "oklch(0.925 0.018 88)"
  graphite-note: "oklch(0.45 0.028 250)"
  ruling-wash: "oklch(0.905 0.038 195)"
  ruling-wash-ink: "oklch(0.3 0.06 228)"
  pad-ruling: "oklch(0.8 0.04 188)"
  correction-red: "oklch(0.55 0.2 28)"
  black-sheet: "oklch(0.13 0 0)"
  black-sheet-raised: "oklch(0.17 0 0)"
  white-ink: "oklch(0.92 0 0)"
  white-pen: "oklch(0.96 0 0)"
  grey-ink: "oklch(0.68 0 0)"
  dark-ruling: "oklch(0.32 0 0)"
typography:
  title:
    fontFamily: "Instrument Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  field:
    fontFamily: "Instrument Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  control:
    fontFamily: "Instrument Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  count:
    fontFamily: "Martian Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "calc(11em / 12)"
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 700
rounded:
  sm: "calc(0.3rem - 3px)"
  md: "calc(0.3rem - 1px)"
  lg: "0.3rem"
  xl: "calc(0.3rem + 3px)"
spacing:
  control-sm: "1.5rem"
  control-md: "1.75rem"
  control-lg: "2rem"
  control-xl: "2.25rem"
  chip: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ruling-pen}"
    textColor: "{colors.fresh-sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
    padding: "0 8px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
    padding: "0 8px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
  field:
    textColor: "{colors.drafting-ink}"
    typography: "{typography.field}"
    rounded: "{rounded.md}"
    height: "{spacing.control-xl}"
    padding: "0 10px"
  chip:
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    height: "{spacing.chip}"
    padding: "0 6px"
  model-key-entry:
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    height: "{spacing.chip}"
    padding: "0 0 0 6px"
    border: "none"
  popover:
    backgroundColor: "{colors.fresh-sheet}"
    textColor: "{colors.drafting-ink}"
    rounded: "{rounded.lg}"
    padding: "10px"
---

# Design System: LLM Graphs

## Overview

**Creative North Star: "The Graph Pad"**

The app is an engineer's ruled pad with a plot drawn on it. The light theme is cream stock with blue-black drafting ink and hairlines in the pale green-blue of the pad's rulings; surfaces are a fresh sheet laid on the paper. The dark theme is the same pad in black: a flat near-black sheet, soft white ink for text, full white for the one accent, grey ink for secondary text, and rulings a few shades up from the sheet. Nothing in the dark theme is blue or green; the only colour there is the data's.

The graph is the subject; every control is a quiet instrument around it. Controls are small, precise and understated, so the eye goes to the plot and the model marks on it. Density is deliberate: one height per control size and one type step per role, so a field, a list row and an inline action keep their ratio wherever they appear. A coarse pointer lifts every step for a finger without changing the ladder.

**Key Characteristics:**

- Cream paper, blue-black ink, green-blue rulings (light); black sheet, soft white ink, grey rulings (dark).
- One acting colour (the ruling pen); everything else is ink, paper or the data's vendor colour.
- Flat surfaces separated by hairlines; only floating layers cast a shadow.
- Tight, drafted corners (0.3rem light, 0.5rem dark).
- Instrument Sans for everything you read, Martian Mono for counts and axis numbers, Space Mono only in the wordmark.

## Colors

A paper-and-ink palette with a single acting colour; the data supplies all other colour.

### Primary

- **Ruling Pen** (oklch(0.44 0.085 222)): the one colour that acts: primary buttons, focus rings, checked boxes, links. The pad's green-blue rulings deepened into the pen that marks them up, held at about 7:1 against the paper. In the dark theme the pen is full white (oklch(0.96 0 0)), a step brighter than the text so it still reads as the one that acts.

### Neutral

- **Cream Stock** (oklch(0.962 0.014 88)): the page background.
- **Fresh Sheet** (oklch(0.982 0.009 88)): cards, popovers and menus, a lighter sheet laid on the stock.
- **Drafting Ink** (oklch(0.23 0.022 262)): body text and headings.
- **Graphite Note** (oklch(0.45 0.028 250)): secondary text: captions, "via" labels, counts' context.
- **Tinted Margin** (oklch(0.925 0.018 88)): secondary buttons and muted fills.
- **Ruling Wash** (oklch(0.905 0.038 195)) with **Ruling Wash Ink** (oklch(0.3 0.06 228)): highlighted list items and hover accents.
- **Pad Ruling** (oklch(0.8 0.04 188)): borders, field outlines, dividers. Opaque on purpose: the 3D chart reads it through a canvas that drops alpha.
- **Correction Red** (oklch(0.55 0.2 28)): destructive actions and errors only.
- Dark theme: **Black Sheet** (oklch(0.13 0 0)), **Black Sheet Raised** (oklch(0.17 0 0)), **White Ink** (oklch(0.92 0 0)) for text, **White Pen** (oklch(0.96 0 0)) for the accent, **Grey Ink** (oklch(0.68 0 0)), **Dark Ruling** (oklch(0.32 0 0)). The sheet stays near-black and neutral; the text is softened a step off full white so it doesn't glare, about 16:1 on the sheet.

### Vendor colours

Model marks take their hue from the vendor's brand; lightness and chroma come from the theme (`--vendor-l`, `--vendor-c`), so every vendor sits at the same weight. A black-and-white brand draws in ink, its models stepping toward grey (`--vendor-ink-0..2`), faintly tinted toward the brand.

### Named Rules

**The One Pen Rule.** Only the ruling pen acts. Don't introduce a second accent; state, emphasis and selection use the pen, ink weight, or the ruling wash.

**The Data Owns Colour Rule.** Outside the pen, every saturated colour on screen belongs to a model's vendor. Chrome never borrows a vendor hue.

## Typography

**Body Font:** Instrument Sans Variable (with ui-sans-serif, system-ui)
**Label/Mono Font:** Martian Mono Variable (with ui-monospace, SFMono-Regular, Menlo)
**Wordmark Font:** Space Mono 700, only in the tokenized "LLM Graphs" wordmark.

**Character:** A crisp, slightly technical sans for reading, with a wide mono for the numbers, like the printed scale on a ruler.

### Hierarchy

- **Title** (600, 1rem, 1.5rem): what a surface is: a dialog's or an empty state's title.
- **Field** (500, 0.875rem, 1.25rem): fields, the menus they open, and the titles over them; what the reader typed or picked.
- **Control** (500, 0.75rem, 1rem): the annotation step: buttons, toggles, list rows, menus, labels and captions. Prose on this step uses a relaxed line height.
- **Count** (Martian Mono, 11/12 of the surrounding size, tabular): a count or mark beside a label. Martian runs wide, so it sits a fixed ratio under its text and still reads as the same size.
- **2xs** (0.6875rem, 1rem): marks nested inside a control: keys, badges, the smallest buttons.
- On a coarse pointer every step rises (control 0.875rem, field 1rem so iOS doesn't zoom, title 1.125rem).

### Named Rules

**The Step, Not the Size Rule.** A call site picks a text role (`text-control`, `text-field`, `text-title`), never a pixel size. Numbers are always tabular.

## Layout

The page is a centred column, at most 120rem wide, with 16px gutters (24px from `sm`, 40px from `2xl`). The comparison page fills the viewport: the controls strip sits on top and the chart takes the remaining height, with a 32rem floor (70svh on phones).

The controls strip is two equal halves around a vertical rule: the axes on the left, the model picker on the right, each as wide as the wider of the two, centred over the chart. Below 56rem the halves stack.

Control heights follow a four-step ladder: 24, 28, 32 and 36px on a fine pointer (`control-sm` to `control-xl`); 36, 40, 44 and 44px on a coarse pointer. A field that leads its row takes `xl`; a field inside a panel keeps `lg`. Chips are 24px (32px on touch).

## Elevation & Depth

Flat by default. Surfaces sit on the paper and are separated by pad rulings, not shadows. Only layers that float over the page (popovers, menus, select and combobox lists, dialogs) cast a soft medium shadow, paired with a hairline ring of ink at 10%.

### Shadow Vocabulary

- **Floating layer** (`box-shadow: var(--tw-shadow-md)` plus `ring-1 ring-foreground/10`): popovers, menus, dropdown lists.

### Named Rules

**The Flat Pad Rule.** Nothing on the page itself is lifted. If it doesn't float over other content, it gets a hairline, not a shadow.

## Shapes

Tight drafted corners: 0.3rem in light (sm is 0.3rem − 3px, md 0.3rem − 1px, xl 0.3rem + 3px), loosened to 0.5rem in dark. Fields and buttons take `md`; chips take `sm`; popovers and menus take `lg`. Borders are 1px pad rulings. The Z-axis "add" field uses a dashed ruling to read as an empty slot.

## Components

### Buttons

- **Shape:** drafted corners (`md`, 0.3rem − 1px).
- **Primary:** ruling pen fill, fresh-sheet text, `control` type, 28px tall; hover lightens to 80%.
- **Outline:** pad-ruling border, transparent fill; hover tints with the ruling at 50%.
- **Secondary:** tinted margin fill; hover mixes 5% ink in.
- **Ghost:** no fill until hover (muted fill).
- **Sizes:** sm 24, default 28, lg 32, xl 36 (with field type); icon buttons square on the same ladder. The smallest icon button (20px) widens its hit area instead of its box.
- **Focus:** a 2px ruling-pen outline, offset 2px.

### Inputs / Fields

- **Style:** 1px pad-ruling border, ruling at 20% fill (30% in dark), `md` corners, `field` type.
- **Focus:** border turns to the pen with a 2px ring of the pen at 30%.
- **Selects:** same surface; the axis selects lead their row at `xl` (36px).

### Chips

- **Style:** ink at 10% fill, `sm` corners, `control` type, 24px tall, vendor logo or dot in the vendor colour.

### Model picker (signature)

A search bar at `xl` with a `/` shortcut hint and a count button that opens the full checklist, over a three-by-three key of the picks. Each pick is an open cell at chip height, with no outline, so the key reads as a legend on the paper rather than nine more controls: its vendor's logo and its name, with a muted fill and a remove button over the end of the name on hover. The logo rests in grey so the key doesn't compete with the chart, and takes its vendor colour on hover or focus, when the chart highlights that model too (touch keeps the colour, having no hover). More than nine picks give the last cell to "+N more". Search results say **Add** or **Remove**.

### Popovers / Menus

- **Style:** fresh sheet, `lg` corners, 10px padding, floating-layer shadow, `control` type; list items highlight with the ruling wash.

## Do's and Don'ts

### Do:

- **Do** pick sizes from the ladders (`h-control-*`, `text-control` / `text-field` / `text-title`) rather than restating pixels.
- **Do** keep the graph the largest, most saturated thing on screen.
- **Do** keep counts and axis numbers in Martian Mono, tabular.
- **Do** separate surfaces with 1px pad rulings.

### Don't:

- **Don't** add a second accent colour or borrow a vendor hue for chrome.
- **Don't** put a shadow on anything that doesn't float over other content.
- **Don't** expose many controls at once or let controls compete with the graph.
- **Don't** use Space Mono outside the wordmark.
