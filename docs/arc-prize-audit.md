# ARC Prize provider audit

September 30, 2026 · `feat/add-score-providers` · [PR #30](https://github.com/jagrat7/llm-graphs/pull/30), based on [#29](https://github.com/jagrat7/llm-graphs/pull/29).

Added **ARC Prize · ARC-AGI-2** for abstract puzzle reasoning. This adds a different capability comparison alongside the coding, workflow, scientific and preference benchmarks. The [owner's verified leaderboard](https://arcprize.org/leaderboard) publishes current model families, explicit effort settings and evaluation-specific costs. Its [testing policy](https://arcprize.org/policy) describes independent testing, semi-private tasks, zero-retention agreements and periodic benchmark renewal; it also acknowledges possible leakage over time. Recognition alone is not treated as evidence of resistance to benchmark optimization.

The source is the first-party [ARC-AGI-2 JSON feed](https://arcprize.org/media/data/leaderboard/v2.json), discovered through the leaderboard's [data loader](https://arcprize.org/scripts/leaderboard/data.js). The frozen feed was generated on September 30 and contains 242 displayed general-purpose model configurations after removing an identical duplicated GPT-5 low-effort row. There are 241 usable task-cost observations; historical Gemini Deep Think provisional pricing is unavailable.

Current coverage includes GPT-6.1 Sol's low, medium, high, xhigh and max settings; Opus 5.5's five published settings; GPT-6 Astra/Sol/Luna, Gemini 3.8, Kimi K3 and other families. GPT-6.1 Sol max scores 94.17% at $0.25375/task; Opus 5.5 high scores 93.33% at $0.40790/task in this feed. Sonnet 5.5 is not yet listed by this owner. No vendor self-report or unreported effort is inserted.

## Measurement and identity safeguards

- Pin version `v2` and dataset `v2_Semi_Private`, including feed-level dataset ownership and individual rows. Never combine public, semi-private, ARC-AGI-1 or ARC-AGI-3 observations.
- Import only displayed Base LLM/CoT model runs. Human baselines, competition solvers, refinement and synthesis systems are intentional exclusions; malformed in-scope rows remain diagnostic failures.
- Convert score fractions to native accuracy percentages. Read published `costPerTask` directly from the same row; never reconstruct it from another version's cost or token pricing.
- Preserve named efforts, explicit non-reasoning, token-budget labels, snapshots and evaluation harness. A 120K budget with a low/high effort retains both pieces. Unknown levels remain unknown; unknown configurations cannot borrow generation-speed or benchmark measurements.
- Keep model qualifiers such as Preview and Fast Reasoning in display names. Model grouping labels are not used as model identities because the owner sometimes groups different models together.
- Deduplicate identical evaluations; conflicting observations for the same raw ID reject the refresh. Shared validation and cache behavior retain the last good payload on invalid or empty refreshes.
- Publish only score and task cost. Independent model-wide pricing can join when published values agree; runtime is unavailable because this leaderboard does not supply it.

Implementation stays in `providers/arc-prize/`, with one registry entry. Existing selectors, source attribution, capability discovery, cache fetching and graph cases expand automatically. No UI metric or provider allowlist was added.

## Verification

The existing matrix and visible T3 shared browser each covered **730 distinct metric/source combinations** across eight score sources. Equivalent axis permutations share the same joins and values; model subsets are not exhaustively enumerated.

| Result                                      | Frozen data | Native browser |
| ------------------------------------------- | ----------: | -------------: |
| Meaningful graph; every axis varies         |         366 |            366 |
| Selected source does not publish the metric |          86 |             86 |
| No safely matching configuration            |         278 |            278 |
| Constant default axis                       |           0 |              0 |
| Rendering failure                           |           — |              0 |

[Data results](arc-prize-data-results.jsonl) retain domains, selected models, point counts and variation checks. [Browser results](arc-prize-browser-results.jsonl) retain source fetch times, labels, point counts, finite SVG coordinates/paths, active animation frames, painted WebGL geometry and camera-visible markers. Unavailable combinations display explanations without mounting misleading charts.

Additional native interactions checked the current-model selection: GPT-6.1 Sol, Opus 5.5 and Gemini 3.8 Flash produce thirteen points in both cost/score 2D and cost/score/token-price 3D. Sol's max-effort readout shows ARC accuracy 94.2%, ARC cost $0.25/task and independent AA token pricing $4/M tokens. At 390 × 844 the eight-provider menu fits within x=105–359 with no clipped options or horizontal page overflow. The 276px 2D and 314px 3D readouts remain inside their chart; the mobile page scrolls vertically to show the full 3D canvas.

Switching the eighteen-point DeepSWE cost/score/duration graph to ARC through the source menu follows ARC task cost and score and removes unsupported duration, preserving a meaningful comparison.

Only one focused parser test was added, covering benchmark/split ownership, effort and budget preservation, zero/missing/provisional costs, scope exclusions, deduplication and conflicting run identities. The existing capability tests and graph matrix cover the new registration and joins. All **104 tests**, typecheck, lint, formatting and production build pass. The existing large lazy-loaded 3D chunk warning remains.
