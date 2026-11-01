// Reads the saved /api/models/snapshot response and writes the small, exact data set the
// video draws: the app's nine opening models, their points per benchmark, the DeepSWE Pareto
// frontier (the app's own algorithm), and ten leaderboard "scraps" for the opening.
// Every number in the video comes from here; nothing is typed by hand.
import { readFileSync, writeFileSync } from "node:fs"

const SNAPSHOT = new URL("../data/snapshot-2026-11-01.json", import.meta.url)
const OUT = new URL("../src/data/derived.json", import.meta.url)
const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"))

// The nine models the app opens on (docs/images/chart-light.png), plus one.
const PICKS = [
  "claude-fable-5",
  "claude-opus-5",
  "gemini-3-8-flash",
  "glm-5-3",
  "gpt-5-6-sol",
  "gpt-5-6-terra",
  "gpt-6-astra",
  "grok-4-6",
  "kimi-k3",
  // Not on DeepSWE, but Terminal-Bench's leader: picked so the switches show the gaps honestly.
  "claude-opus-5-5",
]
const FOCUS = "gpt-6-astra"

const entries = new Map(snap.entries.map((entry) => [entry.id, entry]))

function parseLogo(svg) {
  if (!svg) return null
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 24 24"
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
  return { viewBox, body }
}

const models = PICKS.map((id) => {
  const entry = entries.get(id)
  if (!entry) throw new Error(`missing entry ${id}`)
  return {
    id,
    name: entry.name,
    vendor: entry.vendor,
    hue: entry.hue ?? null,
    shade: entry.shade ?? null,
    logo: parseLogo(snap.logos[entry.vendor]),
  }
})

// A series is one evaluation configuration of one model: its reasoning levels joined.
function seriesKey(variant) {
  return [variant.entryId, variant.mode, variant.configuration ?? variant.harness ?? ""].join("|")
}

function plotPoints(source) {
  return snap.variants[source]
    .filter((variant) => PICKS.includes(variant.entryId))
    .filter((variant) => variant.metrics.score != null && variant.metrics.costPerTask != null)
    .map((variant) => ({
      id: `${source}:${seriesKey(variant)}:${variant.level}`,
      model: variant.entryId,
      series: seriesKey(variant),
      level: variant.level,
      mode: variant.mode,
      effortOrder: variant.effortOrder,
      configuration: variant.configuration ?? null,
      score: variant.metrics.score,
      cost: variant.metrics.costPerTask,
      duration: variant.metrics.durationSeconds ?? null,
    }))
    .sort((a, b) => a.series.localeCompare(b.series) || a.effortOrder - b.effortOrder)
}

// src/ui/lib/pareto.ts: walk from the cheapest (lower cost is better) and keep every point
// that beats the best score so far. Drawn only when it has 2+ points and leaves some out.
function paretoFrontier(points) {
  const ordered = points.toSorted((a, b) => a.cost - b.cost || b.score - a.score)
  const frontier = []
  let best = -Infinity
  for (const point of ordered) {
    if (point.score > best) {
      frontier.push(point.id)
      best = point.score
    }
  }
  return frontier.length > 1 && frontier.length < points.length ? frontier : []
}

const SOURCE_NAMES = {
  deepswe: "DeepSWE",
  terminalBench: "Terminal-Bench 4.0",
  arcPrize: "ARC Prize · ARC-AGI-2",
  sweBench: "SWE-bench Verified",
  metr: "METR",
  arena: "Arena Text",
  cursorBench: "CursorBench 4.0",
  frontierCode: "FrontierCode 2.0",
  liveCodeBench: "LiveCodeBench",
  automationBench: "AutomationBench 1.0.6",
}
const ABBREVIATIONS = { deepswe: "DSWE", terminalBench: "TB", arcPrize: "ARC" }

const sources = {}
for (const source of ["deepswe", "terminalBench", "arcPrize"]) {
  const points = plotPoints(source)
  sources[source] = {
    key: source,
    name: SOURCE_NAMES[source],
    abbreviation: ABBREVIATIONS[source],
    points,
    frontier: paretoFrontier(points),
  }
}

// Scraps: each leaderboard's own top rows, one row per model (its best variant), in that
// leaderboard's own unit. The focus model's row is added when it is not in the top rows.
const fmt = {
  pct: (value) => `${value.toFixed(1)}%`,
  usd: (value) => (value < 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(2)}`),
  rating: (value) => Math.round(value).toString(),
  hours: (value) => `${value.toFixed(1)} h`,
  minutes: (value) => `${Math.round(value / 60)} min`,
}

function bestPerModel(source, metric) {
  const best = new Map()
  for (const variant of snap.variants[source]) {
    const value = variant.metrics[metric]
    if (value == null) continue
    const current = best.get(variant.entryId)
    if (!current || value > current.metrics[metric]) best.set(variant.entryId, variant)
  }
  return [...best.values()].sort((a, b) => b.metrics[metric] - a.metrics[metric])
}

function scrap(source, { kind, metric, columns, rows = 5, title }) {
  const ranked = bestPerModel(source, metric)
  const pick = ranked.slice(0, rows)
  const focusIndex = ranked.findIndex((variant) => variant.entryId === FOCUS)
  if (focusIndex >= rows) pick[rows - 1] = ranked[focusIndex]
  return {
    source,
    name: SOURCE_NAMES[source],
    title,
    kind,
    columns: columns.map((column) => column.label),
    rows: pick.map((variant) => ({
      model: variant.entryId,
      name: entries.get(variant.entryId)?.name ?? variant.entryId,
      rank: ranked.indexOf(variant) + 1,
      level: variant.level,
      value: variant.metrics[metric],
      cells: columns.map((column) => column.format(variant)),
    })),
  }
}

// Scatter scraps keep every variant, as the leaderboard's own chart does.
function scatterScrap(source, title) {
  return {
    source,
    name: SOURCE_NAMES[source],
    title,
    kind: "scatter",
    dots: snap.variants[source]
      .filter((variant) => variant.metrics.score != null && variant.metrics.costPerTask != null)
      .map((variant) => ({
        model: variant.entryId,
        score: variant.metrics.score,
        cost: variant.metrics.costPerTask,
      })),
    focus: bestPerModel(source, "score")
      .filter((variant) => variant.entryId === FOCUS)
      .map((variant) => ({
        name: entries.get(FOCUS).name,
        level: variant.level,
        score: variant.metrics.score,
        cost: variant.metrics.costPerTask,
        cells: [fmt.pct(variant.metrics.score), fmt.usd(variant.metrics.costPerTask)],
      }))[0],
  }
}

const scraps = [
  scrap("deepswe", {
    kind: "table",
    metric: "score",
    title: "Agentic coding",
    columns: [
      { label: "Score", format: (v) => fmt.pct(v.metrics.score) },
      { label: "$/task", format: (v) => fmt.usd(v.metrics.costPerTask) },
    ],
  }),
  scatterScrap("arcPrize", "Score vs cost per task"),
  scrap("terminalBench", {
    kind: "table",
    metric: "score",
    title: "Terminal tasks",
    columns: [
      { label: "Score", format: (v) => fmt.pct(v.metrics.score) },
      { label: "Time", format: (v) => fmt.minutes(v.metrics.durationSeconds) },
    ],
  }),
  scrap("arena", {
    kind: "table",
    metric: "score",
    title: "Human preference",
    rows: 5,
    columns: [{ label: "Rating", format: (v) => fmt.rating(v.metrics.score) }],
  }),
  scrap("sweBench", {
    kind: "bars",
    metric: "score",
    title: "Resolved",
    rows: 5,
    columns: [{ label: "Score", format: (v) => fmt.pct(v.metrics.score) }],
  }),
  scrap("metr", {
    kind: "bars",
    metric: "horizon80Hours",
    title: "Task horizon, 80%",
    rows: 5,
    columns: [{ label: "Horizon", format: (v) => fmt.hours(v.metrics.horizon80Hours) }],
  }),
  scrap("frontierCode", {
    kind: "table",
    metric: "score",
    title: "Coding",
    columns: [
      { label: "Score", format: (v) => fmt.pct(v.metrics.score) },
      { label: "$/task", format: (v) => fmt.usd(v.metrics.costPerTask) },
    ],
  }),
  scrap("cursorBench", {
    kind: "bars",
    metric: "score",
    title: "Coding in Cursor",
    rows: 5,
    columns: [{ label: "Score", format: (v) => fmt.pct(v.metrics.score) }],
  }),
  scrap("automationBench", {
    kind: "table",
    metric: "score",
    title: "Workflow automation",
    columns: [
      { label: "Score", format: (v) => fmt.pct(v.metrics.score) },
      { label: "$/task", format: (v) => fmt.usd(v.metrics.costPerTask) },
    ],
  }),
  scrap("liveCodeBench", {
    kind: "table",
    metric: "score",
    title: "Competitive programming",
    columns: [{ label: "Pass@1", format: (v) => fmt.pct(v.metrics.score) }],
  }),
]

// The benchmarks' own marks, read from the app's source-logo.tsx so the video uses the same art.
const logoFile = readFileSync(
  new URL("../../../src/ui/components/source-logo.tsx", import.meta.url),
  "utf8",
)
const literal = logoFile.match(/const SOURCE_MARKS[^=]*=\s*(\{[\s\S]*?\n\})\n/)?.[1]
if (!literal) throw new Error("SOURCE_MARKS not found in source-logo.tsx")
const sourceMarks = Function(`"use strict"; return (${literal})`)()

const derived = {
  snapshotFile: "data/snapshot-2026-11-01.json",
  fetchedAt: snap.fetchedAt,
  focus: FOCUS,
  models,
  sources,
  scraps,
  sourceMarks,
}

writeFileSync(OUT, `${JSON.stringify(derived, null, 2)}\n`)

// A readable summary of what the video will show, for the README and for checking by eye.
for (const source of Object.values(sources)) {
  const scores = source.points.map((p) => p.score)
  const costs = source.points.map((p) => p.cost)
  console.log(
    `${source.name}: ${source.points.length} points, score ${Math.min(...scores).toFixed(1)}–${Math.max(...scores).toFixed(1)}, cost $${Math.min(...costs).toFixed(2)}–$${Math.max(...costs).toFixed(2)}, frontier ${source.frontier.length}`,
  )
}
for (const s of scraps) {
  const focus = s.kind === "scatter" ? s.focus?.cells.join(" ") : s.rows.find((r) => r.model === FOCUS)?.cells.join(" ")
  console.log(`scrap ${s.name}: ${s.kind}, focus ${focus ?? "—"}`)
}
