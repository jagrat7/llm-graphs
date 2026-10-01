import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import { describeMetrics, fetchOk, normalizeLevel, parseRows } from "../utils"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"

const VERSION = "4.0"
const PAGE = "https://cursor.com/evals"
const CONFIGURATION = `Cursor agent · CursorBench ${VERSION}`
const rowSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(100),
  cost: z.number().nonnegative().nullable(),
  tokens: z.number().int().nonnegative().nullable(),
  steps: z.number().int().nonnegative().nullable(),
})
type CursorBenchRow = z.infer<typeof rowSchema>
type CursorBenchPayload = SourcePayload<CursorBenchRow>

function cellText(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&mdash;", "—")
    .replaceAll("&ndash;", "–")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)),
    )
    .trim()
}
function numberCell(text: string, pattern: RegExp) {
  if (/^(?:—|–|-|N\/A)?$/.test(text)) return null
  return pattern.test(text) ? Number(text.replaceAll(/[$%,]/g, "")) : Number.NaN
}

/** Read the published SSR table without running the site's JavaScript or mixing revisions. */
export function parseCursorBenchPage(html: string): CursorBenchPayload {
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((match) =>
    cellText(match[1]),
  )
  if (!headings.length || headings.some((title) => title !== `CursorBench ${VERSION}`))
    throw new Error("CursorBench version changed; refusing to mix benchmark revisions")
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)]
  const table = tables.find((match) => {
    const headers = [...match[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((cell) =>
      cellText(cell[1]).replace(/^(Cost|Tokens|Steps)(?=\1\s*\/\s*task$)/, ""),
    )
    return (
      JSON.stringify(headers) ===
      JSON.stringify(["", "Model", "Score", "Cost / task", "Tokens / task", "Steps / task"])
    )
  })?.[1]
  if (!table) throw new Error("CursorBench table columns changed")
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? ""
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      cellText(cell[1]),
    )
    return {
      name: cells.length === 6 ? cells[1] : "",
      score: numberCell(cells[2] ?? "", /^\d+(?:\.\d+)?%$/),
      cost: numberCell(cells[3] ?? "", /^\$\d+(?:\.\d+)?$/),
      tokens: numberCell(cells[4] ?? "", /^(?:\d+|\d{1,3}(?:,\d{3})+)$/),
      steps: numberCell(cells[5] ?? "", /^\d+$/),
    }
  })
  // Validate identities before malformed measurements can hide a conflicting run.
  const names = rows.map((row) => row.name).filter(Boolean)
  if (new Set(names).size !== names.length) throw new Error("CursorBench duplicate run identity")
  return parseRows("CursorBench", rows, rowSchema, "name")
}

function configuration(label: string) {
  const effort = /\s+(Extra High|Xhigh|Max|High|Medium|Low|Minimal|None)$/i.exec(label)?.[1]
  const model = effort ? label.slice(0, -effort.length).trim() : label
  const name = /^(?:Opus|Sonnet|Fable|Haiku)\b/i.test(model) ? `Claude ${model}` : model
  return {
    name,
    sourceModelId: name.toLowerCase().replaceAll(/[\s.]+/g, "-"),
    mode: effort == null ? "unknown" : /^none$/i.test(effort) ? "off" : "on",
    level:
      effort == null || /^none$/i.test(effort)
        ? "unknown"
        : /^extra high$/i.test(effort)
          ? "xhigh"
          : normalizeLevel(effort),
  } as const
}

export class CursorBenchProvider
  extends MetricProvider<CursorBenchRow>
  implements MetricSource<CursorBenchPayload, CursorBenchRow>
{
  readonly name = "cursorBench"
  readonly displayName = `CursorBench ${VERSION}`
  readonly href = PAGE
  readonly abbreviation = "CB"
  readonly cacheKey = `llm-scores:source:cursorBench:${VERSION}:v1`
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<CursorBenchRow> = {
    score: {
      read: (row) => row.score,
      presentation: { label: "Coding correctness", unit: "%", format: "percent" },
      note: `CursorBench ${VERSION}; correctness on real multi-file coding tasks`,
      describe: (row) => this.describe(row),
    },
    costPerTask: {
      read: (row) => row.cost,
      note: `CursorBench ${VERSION}; published average $/task, same Cursor agent and effort`,
      describe: (row) => this.describe(row),
    },
  }
  private describe(row: CursorBenchRow) {
    return {
      label: this.displayName,
      detail: [
        CONFIGURATION,
        "Cost uses published input/cache-read/cache-write/output pricing applied to each task's actual usage",
        row.cost == null ? "Task cost not reported" : null,
        row.tokens != null
          ? `Reported output tokens/task: ${row.tokens.toLocaleString("en-US")}`
          : null,
        row.steps != null ? `Mean steps/task: ${row.steps} (rounded by source)` : null,
        configuration(row.name).mode === "unknown" ? "Reasoning effort not reported" : null,
      ]
        .filter(Boolean)
        .join("; "),
    }
  }
  toMetricRows(payload: CursorBenchPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const { name, ...run } = configuration(row.name)
      const creator = /^Claude\b/.test(name)
        ? "Anthropic"
        : /^GPT\b/.test(name)
          ? "OpenAI"
          : /^Grok\b/.test(name)
            ? "xAI"
            : /^Gemini\b/.test(name)
              ? "Google"
              : /^Muse\b/.test(name)
                ? "Meta"
                : /^GLM\b/.test(name)
                  ? "Z.AI"
                  : /^Composer\b/.test(name)
                    ? "Cursor"
                    : null
      return {
        ...run,
        rawId: row.name,
        configuration: CONFIGURATION,
        ...(run.mode === "unknown" ? { configurationKnown: false as const } : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: { name, creator, releaseDate: null },
        effortConflict: null,
      }
    })
  }
  async fetchPayload(): Promise<CursorBenchPayload> {
    return parseCursorBenchPage(
      await (await fetchOk(this.displayName, PAGE, { timeoutMs: 20_000 })).text(),
    )
  }
}
