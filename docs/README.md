# LLM Graphs

Compare language models across benchmarks, live at [llm-graphs.vercel.app](https://llm-graphs.vercel.app).

Leaderboards each publish their own slice of the picture: one has coding scores, another task cost, another speed or human preference. LLM Graphs pulls those sources into one place and plots them against each other, so you can see tradeoffs like score against cost per task, or speed against price, for the models you care about.

## What it does

- **2D and 3D comparison charts.** Pick any two or three metrics as axes and a source for each.
- **Pareto frontier.** The models no other model beats on every selected axis are highlighted.
- **Reasoning levels kept apart.** Each effort setting (low, high, max…) is its own point, and one model's settings are joined into a curve.
- **Log scales**, chosen automatically for ratio metrics or set by hand.
- **Model picker** grouped by vendor. Your picks are kept across visits and benchmarks.
- **Share links, PNG export, and CSV download** for the current chart.
- **A guide for AI agents** at `/llms.txt`: how a chart's link is built, with every metric, source, and model id it accepts, so a reader's agent can choose the options and hand back a link.
- **Visible sources.** Every axis and tooltip names the benchmark and links to it, with its version, harness, and caveats.

## Data sources

| Source | What it adds |
| --- | --- |
| [Artificial Analysis](https://artificialanalysis.ai/) | Intelligence Index, task cost, token prices, output speed |
| [DeepSWE](https://deepswe.datacurve.ai/) | Agentic coding scores, task cost, task duration |
| [SWE-bench Verified](https://www.swebench.com/) | Coding scores, task cost |
| [Terminal-Bench 4.0](https://www.tbench.ai/leaderboard/terminal-bench/4.0) and [Terminal-Bench Science](https://www.terminal-bench-science.ai/) | Terminal task scores, task cost, task duration |
| [CursorBench](https://cursor.com/evals) | Coding scores in Cursor, task cost |
| [FrontierCode](https://cognition.com/frontiercode) | Coding scores, task cost |
| [LiveCodeBench](https://livecodebench.github.io/leaderboard.html) | Competitive programming scores |
| [METR](https://metr.org/time-horizons/) | Task horizon, average task score |
| [ARC Prize · ARC-AGI-2](https://arcprize.org/leaderboard) | Reasoning scores, task cost |
| [AutomationBench](https://zapier.com/benchmarks) | Workflow automation scores, task cost |
| [Arena Text](https://arena.ai/leaderboard/text) | Human preference ratings, vote counts |
| [models.dev](https://models.dev/) | Model catalog, context length, the lab's own token prices |

Each source keeps its own meaning. A score from one benchmark is never mixed with another's, task cost is never derived from token price, and unknown reasoning settings stay unknown. [CONTEXT.md](../CONTEXT.md) defines the terms, and the audits in this folder record each source's details and limits.

## Running locally

Requires [Bun](https://bun.sh/) 1.4.3 or later.

```bash
bun install
cp .env.example .env
bun run dev   # http://localhost:3000
```

Environment variables, all optional:

| Variable | Purpose |
| --- | --- |
| `AA_API_KEY` | [Artificial Analysis API](https://artificialanalysis.ai/documentation) key. Without it, that source is unavailable. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shares the source cache across server instances. Without them, each server caches in memory. |

Sources are fetched on the server, cached, and refreshed in the background once stale. A failed refresh keeps the last good copy.

## Development

| Command | What it runs |
| --- | --- |
| `bun run test` | Vitest. Tests use committed fixtures and make no upstream requests. |
| `bun run typecheck` | Bun's TypeScript checker |
| `bun run lint` | oxlint (type-aware), with custom rules in `dev/oxlint/` |
| `bun run fmt` | oxfmt |
| `bun run build` | Production build (Nitro server, deployed on Vercel) |
| `bun run fixtures:models` | Refreshes the first-party data snapshots used by tests (needs `AA_API_KEY`) |

Code layout:

- `src/server/services/providers/`: one adapter per source, registered in `index.ts`
- `src/server/services/model-aggregator/`: joins sources into one model snapshot
- `src/server/api/`: server functions the UI calls
- `src/ui/`: routes, chart components, and chart logic

To add a benchmark, see [Adding a score provider](adding-a-score-provider.md).

## Further reading

- [PRODUCT.md](PRODUCT.md): who it's for and the design principles
- [CONTEXT.md](../CONTEXT.md): domain terms such as score, task cost, and task horizon
- [brand.md](brand.md): the wordmark and seal
