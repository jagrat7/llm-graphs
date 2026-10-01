# Release benchmark provider research

Checked 2026-09-30 against benchmark owners and their live feeds.

## Decision

Add **AutomationBench** and **Terminal-Bench 4.0** first. AutomationBench has current Sonnet 5.5 results across six configurations and broad model coverage. Terminal-Bench has genuine three-axis score, task cost and task duration measurements, including several effort curves. **Terminal-Bench Science** adds a distinct scientific-workflow capability and reuses the same Harbor payload shape. These choices add meaningful cost/performance comparisons instead of more ranking-only axes.

Release relevance: [OpenAI’s GPT-6.1 Sol announcement](https://openai.com/index/introducing-gpt-6-1-sol/) cites AutomationBench 1.0.6 and Terminal-Bench Science 0.1, plus DeepSWE, GDP.pdf and OSWorld. [Anthropic’s Sonnet 5.5 announcement](https://www.anthropic.com/claude-sonnet-5-5) cites Terminal-Bench 4.0, FrontierCode 1.1, CursorBench 4.0, GDPval-AA 2.1, AA-Briefcase 1.1, OSWorld 2.1 and Chartography. Benchmark versions and harnesses must remain distinct: a release’s self-reported result can differ from the benchmark owner’s leaderboard.

## AutomationBench — recommended

[Zapier’s official leaderboard](https://zapier.com/benchmarks) reports strict workflow-completion scores and cost/task for 121 configurations, including Sonnet 5.5, Opus 5.5, GPT-6 Astra/Sol/Luna and Gemini 4 Argon. Its held-out evaluation uses deterministic assertions on final environment state; the public research task set is separate. The leaderboard runs in API mode with a 50-step limit and identifies effort and fallback configurations. [Source repository](https://github.com/zapier/AutomationBench).

Live data is embedded in the first-party Framer route module. Discover the `script_main.*.mjs` URL from page HTML, then its `/benchmarks` route import. The inspected [route module](https://framerusercontent.com/sites/4WTSl4BNjd1q9QFEFibC6h/EoTxbXN5IqknxERosd2sBrwM9eKEsz_G9J9FFC1HRNA.Dney8qmj.mjs) contains version `1.0.6` and an array of `[rank, model/configuration label, score percent, cost dollars]`. Discover hashes dynamically; parse only this restricted data structure without evaluating third-party JavaScript.

Preserve `default fallbacks` in configuration identity. `Between tools` is a separate reasoning setting, not an unreported effort or ordinary thinking-off run. Hide task cost for Fable 5.1 “with Opus 5 Fallback”: the published cost omits fallback spending. Hide Gemma 4’s dedicated-deployment price from ordinary API task-cost comparisons. Gemini asterisks refer to promotional discounts; the leaderboard’s numeric costs use standard list pricing. DeepSeek’s cached Fireworks price needs its pricing-basis note.

## Terminal-Bench 4.0 — recommended

The [official site](https://www.tbench.ai/) uses this unauthenticated read-only request:

```text
POST https://ofhuhcpkvzjlejydnvyd.supabase.co/functions/v1/leaderboard-read
Content-Type: application/json
{"package":"terminal-bench/terminal-bench","name":"4-0-0"}
```

Observed 27 displayed rows. Five effort levels each for GPT-6 Astra, Fable 5.1 and Opus 5; further models include GLM 5.3, Grok 4.7, GPT-5.6 Sol/Terra/Luna and Gemini 3.8 Flash. The feed lacks Sonnet 5.5 and Opus 5.5 as of this check; do not substitute their release self-reports into these owner-run rows. Schema: `metadata.model_display.label`, `model_org.label`, `agent_display.label`, `reasoning_effort`, dates; `metrics.accuracy` in percent, `accuracy_ci95_half_width`, `n_trials`, `total_cost_usd`, `avg_trial_duration_sec`, token counts. Current rows have 330 trials: 66 tasks × five repetitions. Normalize task cost as total dollars divided by trials; runtime is already seconds/trial. Example Astra max: 58.18%, $9.9005/task, 2796.3 seconds/task.

Grok 4.7’s `display_cost`/`display_total_cost_usd` explicitly says partial coverage, 324/330 trials. Retain its score and runtime, but leave comparable task cost unavailable. Trial count agreement and partial-coverage checks belong in the provider. Agent harness must stay in provenance and run identity.

[The owner’s 4.0 release notes](https://www.tbench.ai/news/terminal-bench-4-0) explain resource calibration, task fixes and removal of saturated/publicly solved tasks. Major releases change the evaluation environment/task set and require new trials; do not combine 4.0 with 3.0 or 2.1.

## Terminal-Bench Science — useful additional provider

[Public JSON endpoint](https://www.terminal-bench-science.ai/api/leaderboard?package=terminal-bench-science%2Fterminal-bench-science&name=v0-1-eval) returns `leaderboard` and `rows`, with the same Harbor metadata shape. Seventeen displayed rows, 210 trials each, updated through September 23. `metrics.accuracy` is percent; `total_cost_usd / tasks` is dollars/trial, where `tasks` counts 70 tasks × three repeats. Astra max produces $23.7974/task and Opus 5.5 max $23.2108/task, matching the rounded costs in OpenAI’s release announcement. `accuracy_stderr` is standard error, not a 95% interval. No task runtime field. Effort is explicit but generally one high/max setting per model. Sonnet 5.5 and GPT-6.1 Sol are not yet in the owner’s feed.

[The owner’s announcement](https://www.terminal-bench-science.ai/announcement) describes expert-contributed scientific workflows, three trials/task and reproducible artifact grading. Domain sub-results cover life, physical, earth, mathematical and engineering sciences. Domain cost/score must use that domain’s own trial denominator; never pair domain scores with overall task cost.

## OSWorld and Surge caveats

[OSWorld’s official results JSON](https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json?v=leaderboard-v21-v1) has 50 rows with release, full/offline scope, step budget, tool setting, reasoning, binary accuracy and partial score. The latest `v2.1` currently has only Opus 5 across five efforts in each scope; newest release models are missing. Do not mix releases/scopes or choose latest version solely by date when that removes multi-model comparisons.

`estimatedCostUsd` is **evaluation-total cost**, not cost/task. [The owner’s chart script](https://osworld-v2.xlang.ai/static/js/benchmarkSweep.js?v=benchmark-hide-full-gpt-plot-v1) publishes matching per-task cost and output-token values. GPT-5.6 Sol max/offline has JSON total $1116.72 and chart cost/task $10.34 (division by 108, despite offline scope). New v2.1 costs are absent. Prefer exact chart measurements or no cost over an assumed offline-set denominator.

[Surge GDP.pdf](https://surgehq.ai/benchmarks/gdp-pdf) has modern model scores and explicit reasoning labels but no public same-run cost in the page inspected. It adds less immediate value than the recommended sources for this site’s cost/performance plots. Surge’s Chartography and GDP.xlsx are distinct benchmarks, not interchangeable GDP.pdf score rows.

## Integration and verification

Keep benchmark version, model, effort, harness/fallback mode and dataset scope in measurement identity. Same-run task cost/runtime must follow the selected benchmark score. Missing effort stays unreported; missing or partial cost stays unavailable. Optional token totals should be normalized per trial and labelled as benchmark consumption, never generation speed. Use one representative fixture per provider plus parser edge cases, a live capability/comparison matrix, and targeted browser 2D/3D checks; no per-model test explosion.
