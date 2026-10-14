import { z } from "zod"
import { MetricProvider } from "../metric-provider"
import type { MetricReaders, MetricRow, MetricSource, SourcePayload } from "../provider.types"
import { describeMetrics, fetchOk, isKnownLevel, normalizeLevel, parseRows } from "../utils"

const VERSION = "1.0.6"
const PAGE_URL = "https://zapier.com/benchmarks"
const rowSchema = z.object({
  rank: z.number().int().positive(),
  label: z.string().min(1),
  score: z.number().finite().min(0).max(100),
  cost: z.number().finite().nonnegative().nullable(),
  costNote: z.string().nullable(),
})
export type AutomationBenchRow = z.infer<typeof rowSchema>
export type AutomationBenchPayload = SourcePayload<AutomationBenchRow>

function configuration(label: string) {
  const suffix = /\s*\(([^()]*)\)$/.exec(label)
  const setting = suffix?.[1] ?? ""
  const last = setting.split(",").at(-1)?.trim() ?? ""
  const effort = normalizeLevel(last)
  const known = isKnownLevel(effort) || effort === "none" || effort === "betweentools"
  const model = known || /fallback/i.test(setting) ? label.slice(0, suffix?.index).trim() : label
  const policy = known ? setting.split(",").slice(0, -1).join(",").trim() : setting
  // An explicitly mixed-model fallback must not borrow the primary model's token pricing.
  const modelId = /with .+ fallback/i.test(policy) ? `${model} ${policy}` : model
  return {
    model,
    sourceModelId: modelId.toLowerCase().replaceAll(/[\s.]+/g, "-"),
    mode: effort === "none" ? ("off" as const) : known ? ("on" as const) : ("unknown" as const),
    level: effort === "betweentools" ? "between tools" : isKnownLevel(effort) ? effort : "unknown",
    configuration: [
      "API, 50-step limit",
      policy,
      effort === "betweentools" ? "between tools reasoning" : "",
    ]
      .filter(Boolean)
      .join("; "),
    known,
  }
}

/** Parse only the leaderboard's literal tuples; never execute first-party page JavaScript. */
export function parseAutomationModule(script: string): AutomationBenchPayload {
  const table =
    /=`(\d+\.\d+\.\d+)`,\w+=\[(\[\d+,`[^`]+`,`[^`]+`,`[^`]+`\](?:,\[\d+,`[^`]+`,`[^`]+`,`[^`]+`\])*)\]/.exec(
      script,
    )
  if (table?.[1] !== VERSION)
    throw new Error("AutomationBench version or leaderboard schema changed")
  const rows = Array.from(
    (table[2] ?? "").matchAll(/\[(\d+),`([^`]+)`,`([^`]+)`,`([^`]+)`\]/g),
    ([, rank, label, score, cost]) => {
      const numericCost = /^\$([\d,]+(?:\.\d+)?)([*†‡]*)$/.exec(cost ?? "")
      const excludedFallback = /with .+ fallback/i.test(label ?? "")
      const deployment = cost?.includes("†")
      return {
        rank: Number(rank),
        label,
        score: /^\d+(?:\.\d+)?%$/.test(score ?? "") ? Number(score?.slice(0, -1)) : Number.NaN,
        cost:
          numericCost && !excludedFallback && !deployment
            ? Number(numericCost[1]?.replaceAll(",", ""))
            : null,
        costNote: excludedFallback
          ? "Published cost excludes Opus fallback spending; task cost unavailable"
          : deployment
            ? "Dedicated deployment cost; comparable API task cost unavailable"
            : cost?.includes("*")
              ? "Standard list pricing; promotional discounts not applied"
              : cost?.includes("‡")
                ? "Fireworks cached-token pricing"
                : numericCost
                  ? null
                  : "Task cost not reported",
      }
    },
  )
  return parseRows("AutomationBench", rows, rowSchema, "label")
}

export class AutomationBenchProvider
  extends MetricProvider<AutomationBenchRow>
  implements MetricSource<AutomationBenchPayload, AutomationBenchRow>
{
  readonly name = "automationBench"
  readonly displayName = `AutomationBench ${VERSION}`
  readonly href = PAGE_URL
  readonly abbreviation = "AB"
  readonly cacheKey = `llm-scores:source:automationBench:${VERSION}:v1`
  readonly refreshWindowMs = 60 * 60 * 1000
  readonly metrics: MetricReaders<AutomationBenchRow> = {
    score: {
      read: (row) => row.score,
      presentation: { label: "Workflow completion", unit: "%", format: "percent" },
      note: `AutomationBench ${VERSION}; strict workflow completion, native percent`,
      describe: (row) => this.describe(row),
    },
    costPerTask: {
      read: (row) => row.cost,
      note: `AutomationBench ${VERSION}; reported cost / task, same effort and fallback policy`,
      describe: (row) => this.describe(row),
    },
  }

  private describe(row: AutomationBenchRow) {
    return {
      label: this.displayName,
      detail: [configuration(row.label).configuration, row.costNote].filter(Boolean).join("; "),
    }
  }

  toMetricRows(payload: AutomationBenchPayload): Array<MetricRow> {
    return payload.rows.map((row) => {
      const run = configuration(row.label)
      const creator = /^Claude\b/i.test(run.model)
        ? "Anthropic"
        : /^GPT\b/i.test(run.model)
          ? "OpenAI"
          : /^Gemini|^Gemma/i.test(run.model)
            ? "Google"
            : /^Kimi\b/i.test(run.model)
              ? "Moonshot AI"
              : /^GLM\b/i.test(run.model)
                ? "Z.AI"
                : /^Muse\b/i.test(run.model)
                  ? "Meta"
                  : /^Qwen\b/i.test(run.model)
                    ? "Alibaba"
                    : /^Minimax\b/i.test(run.model)
                      ? "MiniMax"
                      : /^DeepSeek\b/i.test(run.model)
                        ? "DeepSeek"
                        : null
      return {
        sourceModelId: run.sourceModelId,
        rawId: row.label,
        mode: run.mode,
        level: run.level,
        configuration: run.configuration,
        ...(!run.known ? { configurationKnown: false as const } : {}),
        metrics: this.readMetrics(row),
        measurements: describeMetrics(this.metrics, row),
        metadata: {
          name: /with .+ fallback/i.test(row.label) ? row.label : run.model,
          creator,
          releaseDate: null,
        },
        effortConflict: null,
      }
    })
  }

  async fetchPayload(): Promise<AutomationBenchPayload> {
    const options = { timeoutMs: 20_000 }
    const html = await (await fetchOk(this.displayName, PAGE_URL, options)).text()
    const main =
      /<script[^>]+src="(https:\/\/framerusercontent\.com\/sites\/[^"\s]+\/script_main\.[^"\s]+\.mjs)"/.exec(
        html,
      )?.[1]
    if (!main) throw new Error("AutomationBench page module not found")
    const index = await (await fetchOk(this.displayName, main, options)).text()
    const path = /import\(`([^`]+)`\)\),path:`\/benchmarks`/.exec(index)?.[1]
    if (!path) throw new Error("AutomationBench route module not found")
    const route = new URL(path, main)
    if (route.origin !== new URL(main).origin)
      throw new Error("AutomationBench route changed origin")
    return parseAutomationModule(
      await (await fetchOk(this.displayName, route.href, options)).text(),
    )
  }
}
