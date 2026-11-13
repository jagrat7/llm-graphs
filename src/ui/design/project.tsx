// What only this project can say about itself, for the design page (page.tsx). The rest the
// page reads from the project's files (sources.ts).

import { useLayoutEffect } from "react"

import { TokenWordmark } from "#/ui/components/brand-marks"
import { APP_NAME } from "#/ui/lib/app-meta"
import { THEME_STORAGE_KEY } from "#/ui/lib/theme"

import type { Theme } from "./tokens"
import type { DemoModule, Project } from "./types"

/** The vendor hues the chart draws in (`vendorColor` in model-view.ts), a few of them. */
const HUES = [25, 70, 145, 200, 262, 320]

/** The site sets `color-scheme` inline on <html> (`applyTheme`), which outranks the page's own
    rule for it; so the page's theme sets it too, or a light page keeps dark scrollbars. */
function ColorScheme({ theme }: { theme: Theme }) {
  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = theme
  }, [theme])
  return null
}

export const project: Project = {
  name: APP_NAME,
  brand: (
    <a href="/" aria-label={`${APP_NAME} home`} className="text-foreground flex items-center">
      <TokenWordmark />
    </a>
  ),
  editor: (file) => `/__open-in-editor?file=${encodeURIComponent(file)}`,
  uiImport: "#/ui/components/ui",
  demos: Object.values(import.meta.glob<DemoModule>("./demos/*.demo.tsx", { eager: true })),
  theme: { storageKey: THEME_STORAGE_KEY },
  after: ColorScheme,

  roles: [
    { name: "Paper", token: "background", use: "bg-background · the pad" },
    { name: "Sheet", token: "card", use: "bg-card · bg-popover · a sheet laid on the pad" },
    { name: "Subtle", token: "muted", use: "bg-muted · bg-secondary · skeletons" },
    { name: "Wash", token: "accent", use: "bg-accent · a hovered or picked menu row" },
    { name: "Ruling", token: "border", use: "border-border · the chart's gridlines" },
    { name: "Field", token: "input", use: "border-input" },
    { name: "Grey ink", token: "muted-foreground", use: "text-muted-foreground · axes" },
    { name: "Ink", token: "foreground", use: "text-foreground" },
    { name: "Drafting ink", token: "primary", use: "bg-primary · text-primary · the one accent" },
    { name: "Danger", token: "destructive", use: "text-destructive · bg-destructive/10" },
    { name: "Focus", token: "ring", use: "ring-ring · outline" },
    { name: "Unknown vendor", token: "vendor-unknown", use: "a model with no vendor hue" },
  ],

  // The density steps styles.css names: each text role is a step, so a call site picks one.
  typography: [
    { name: "brand", classes: "font-brand text-[15px] leading-none font-bold tracking-[-0.02em]" },
    { name: "title", classes: "text-title font-medium" },
    { name: "field", classes: "text-field" },
    { name: "control", classes: "text-control" },
    { name: "label", classes: "text-control text-muted-foreground" },
    { name: "2xs", classes: "text-2xs font-medium" },
  ],
  specimens: {
    brand: { text: "LLM Graphs" },
    title: { text: "Where the numbers come from" },
    field: { text: "Search models" },
    control: { text: "Cost per task · Intelligence index" },
    label: { text: "Updated 2 days ago" },
    "2xs": { text: "High · Medium · Low" },
  },

  extra: {
    colour: [
      {
        title: "Vendor inks",
        meta: ["model-view.ts", "oklch(var(--vendor-l) var(--vendor-c) <hue>)"],
        render: () => (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {HUES.map((hue) => (
                <span
                  key={hue}
                  title={`hue ${hue}`}
                  className="size-6 rounded-full"
                  style={{ background: `oklch(var(--vendor-l) var(--vendor-c) ${hue})` }}
                />
              ))}
              <span className="text-muted-foreground text-control ml-2">a hue per vendor</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[0, 1, 2].map((shade) => (
                <span
                  key={shade}
                  title={`--vendor-ink-${shade}`}
                  className="size-6 rounded-full"
                  style={{
                    background: `oklch(var(--vendor-ink-${shade}) var(--vendor-tint-c) 262)`,
                  }}
                />
              ))}
              <span className="text-muted-foreground text-control ml-2">
                a black-and-white brand, in ink
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[0, 0.33, 0.66, 1].map((step) => (
                <span
                  key={step}
                  className="h-6 w-10 rounded-sm"
                  style={{
                    background: `oklch(from oklch(var(--vendor-l) var(--vendor-c) 262) calc(l + var(--effort-fade) * ${step}) calc(c * (1 - 0.5 * ${step})) h)`,
                  }}
                />
              ))}
              <span className="text-muted-foreground text-control ml-2">
                lower efforts fade toward the sheet (--effort-fade)
              </span>
            </div>
          </div>
        ),
      },
    ],
    shape: [
      {
        title: "Radius by theme",
        meta: ["styles.css", "light --radius: 0.3rem · dark --radius: 0.5rem"],
        render: (theme, tokens) => (
          <div className="flex flex-wrap items-end gap-6">
            {tokens.radiusSteps.map((step) => (
              <div key={step} className="grid gap-2">
                <div
                  className="bg-card size-14 border"
                  style={{ borderRadius: `var(--${step})` }}
                />
                <span className="text-muted-foreground font-mono text-[12px]">
                  {step.replace("radius", "rounded")}
                </span>
              </div>
            ))}
            <span className="text-muted-foreground font-mono text-[12px]">
              --radius: {tokens.value(theme, "radius")}
            </span>
          </div>
        ),
      },
      {
        title: "Control heights",
        meta: ["styles.css", "h-control-* · size-control-* · h-chip; taller on a coarse pointer"],
        render: () => (
          <div className="flex flex-wrap items-end gap-6">
            {["control-sm", "control-md", "control-lg", "control-xl", "chip"].map((step) => (
              <div key={step} className="grid gap-2">
                <div
                  className="bg-muted w-14 rounded-md border"
                  style={{ height: `var(--${step})` }}
                />
                <span className="text-muted-foreground font-mono text-[12px]">{step}</span>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
}
