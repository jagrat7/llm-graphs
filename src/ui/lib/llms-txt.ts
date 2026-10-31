import type { ModelSnapshot, ProviderName, ProvidersInfo } from "#/server/api"
import type { GraphSearch } from "#/ui/lib/graph-state"

import { APP_DESCRIPTION, APP_NAME } from "#/ui/lib/app-meta"
import { METRICS, METRIC_CONFIG, metricAxisLabel, metricProviders } from "#/ui/lib/metrics"
import { vendorLabel } from "#/ui/lib/model-view"

/** Task cost and duration read the Score axis's benchmark, so a link never names their source. */
const FOLLOWS_SCORE = new Set(["cost", "duration"])

/** Charts the guide links to as a starting point. A test checks that each one draws. */
export const EXAMPLES: Array<{ title: string; purpose: string; search: GraphSearch }> = [
  {
    title: "Score against task cost on SWE-bench Verified",
    purpose: "which coding models give the most for their cost",
    search: { x: "cost", y: "score", ySource: "sweBench" },
  },
  {
    title: "Arena preference rating against token price",
    purpose: "how people rate models against what they cost to run",
    search: { x: "price", y: "score", ySource: "arena" },
  },
  {
    title: "DeepSWE score, task cost and task duration in 3D",
    purpose: "the tradeoff between quality, cost and speed on agentic coding tasks",
    search: { x: "cost", y: "score", z: "duration", ySource: "deepswe" },
  },
]

function exampleLines(origin: string) {
  return EXAMPLES.map(({ title, purpose, search }) => {
    const query = new URLSearchParams(
      Object.entries(search).filter((entry): entry is [string, string] => entry[1] != null),
    )

    return `- [${title}](${origin}/?${query}): ${purpose}.`
  })
}

function metricLines(info: ProvidersInfo) {
  return METRICS.map((metric) => {
    const { label, better } = METRIC_CONFIG[metric]
    // Each benchmark reports its score in its own unit, which Sources gives.
    const name = metric === "score" ? label : metricAxisLabel(metric, null, info)
    const direction = better == null ? "" : `, ${better} is better`
    const sources = FOLLOWS_SCORE.has(metric)
      ? "always the Score axis's benchmark"
      : metricProviders(metric, info)
          .map((source) => `\`${source}\``)
          .join(", ")

    return `- \`${metric}\`: ${name}${direction}. Sources: ${sources}.`
  })
}

function sourceLines(info: ProvidersInfo) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response keys are provider names
  const names = Object.keys(info.displayNames) as Array<ProviderName>

  return names.flatMap((source) => [
    `- \`${source}\`: [${info.displayNames[source]}](${info.sources[source].href})`,
    ...METRICS.flatMap((metric) => {
      const { dataKey } = METRIC_CONFIG[metric]
      if (!info.metricProviders[dataKey].includes(source)) return []
      const note = info.notes[source][dataKey]
      const name = metricAxisLabel(metric, source, info)

      return [`  - \`${metric}\`: ${name}${note == null ? "" : `. ${note}`}`]
    }),
  ])
}

/** Newest first, since a reader asking about models usually means current ones. */
function modelLines(snapshot: ModelSnapshot) {
  const sourcesByEntry = new Map<string, Set<string>>()
  for (const [source, variants] of Object.entries(snapshot.variants)) {
    for (const { entryId } of variants) {
      const sources = sourcesByEntry.get(entryId) ?? new Set()
      sources.add(source)
      sourcesByEntry.set(entryId, sources)
    }
  }

  return snapshot.entries
    .filter((entry) => sourcesByEntry.has(entry.id))
    .toSorted(
      (left, right) =>
        (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "") ||
        left.id.localeCompare(right.id),
    )
    .map((entry) => {
      const details = [
        entry.name,
        ...(entry.vendor == null ? [] : [vendorLabel(entry.vendor)]),
        ...(entry.releaseDate == null ? [] : [entry.releaseDate]),
        [...sourcesByEntry.get(entry.id)!].join(", "),
      ]

      return `- \`${entry.id}\` ${details.join(" · ")}`
    })
}

/**
 * The site described for AI agents, per https://llmstxt.org: how a chart's URL is built, every
 * metric and source the axes accept, and every model id a link can pick. Built from the live
 * registry and snapshot, so it names exactly what the chart reads. `lead` goes right after the
 * summary, for a page that first says what its own link shows.
 */
export function llmsTxt(
  info: ProvidersInfo,
  snapshot: ModelSnapshot,
  origin: string,
  lead: Array<string> = [],
) {
  return [
    `# ${APP_NAME}`,
    "",
    `> ${APP_NAME} lets people ${APP_DESCRIPTION}. Each chart plots models against two or three metrics, such as benchmark score against cost per task. The whole chart is set by the page URL, so an agent picks the options by building a link and handing it to the user. There is no API to call and no account.`,
    "",
    ...lead,
    "## Building a chart link",
    "",
    "```",
    `${origin}/?x=<metric>&y=<metric>[&z=<metric>][&xSource=<source>][&ySource=<source>][&zSource=<source>][&models=<id>&models=<id>…]`,
    "```",
    "",
    "- `x` and `y` are the horizontal and vertical axes. They default to `cost` and `score`.",
    "- `z` is optional. Setting it turns the chart into a 3D cube.",
    "- `xSource`, `ySource` and `zSource` pick which source an axis reads. Leave one out to use the metric's first source listed below.",
    "- `cost` (task cost) and `duration` (task duration) always describe the Score axis's benchmark, so give them no source of their own. Pick the benchmark on the `score` axis instead.",
    "- `models` names one model by its id from the Models list below. Repeat it once per model. Leave it out and the chart shows the reader's saved picks, or the site's default picks of strong recent models.",
    "- Each model is drawn once per reasoning level it was measured at, joined into a curve.",
    "- A chart needs at least two of the picked models to have values on every axis. Check a model's sources in the Models list before picking it.",
    "- Hidden vendors, the Pareto frontier toggle, vendor logos, and showing only each model's highest effort level are reader settings. A link can't set them.",
    "",
    "## Examples",
    "",
    ...exampleLines(origin),
    "",
    "## Metrics",
    "",
    "Values of `x`, `y` and `z`. Sources are listed with the default first.",
    "",
    ...metricLines(info),
    "",
    "## Sources",
    "",
    "Values of `xSource`, `ySource` and `zSource`, with what each one measures. A score from one benchmark is never mixed with another's.",
    "",
    ...sourceLines(info),
    "",
    "## Models",
    "",
    "Values of `models`, newest first: id, name, vendor, release date, and the sources with data for it. A model listed only under `modelsDevListing` has token prices and context length but no benchmark scores.",
    "",
    ...modelLines(snapshot),
    "",
    "## Optional",
    "",
    `- [Full snapshot as JSON](${origin}/api/models/snapshot): every model and every measured value, for checking numbers before choosing a chart.`,
    "",
  ].join("\n")
}
