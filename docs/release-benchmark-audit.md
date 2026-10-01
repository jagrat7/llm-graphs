# Release benchmark audit

**Latest results:** [ARC Prize audit](arc-prize-audit.md) adds abstract reasoning and covers eight score sources and 730 combinations. The checks below document the preceding seven-source rollout.

September 30, 2026 · `feat/add-score-providers` · [PR #30](https://github.com/jagrat7/llm-graphs/pull/30), based on [#29](https://github.com/jagrat7/llm-graphs/pull/29).

Added three benchmark sources selected for release relevance, useful model coverage, published efforts and real cost/performance comparisons. [Selection research](release-benchmark-provider-research.md) links the release announcements, benchmark owners and exact data endpoints.

| Provider                   | Configurations | Comparable task costs | Published measurements                                                     |
| -------------------------- | -------------: | --------------------: | -------------------------------------------------------------------------- |
| AutomationBench 1.0.6      |            121 |                   119 | Strict workflow completion %, reported $/task                              |
| Terminal-Bench 4.0         |             27 |                    26 | Task success %, same-trial $/task, mean seconds/trial, 95% score intervals |
| Terminal-Bench Science 0.1 |             17 |                    17 | Scientific task success %, same-trial $/task, score standard error         |

AutomationBench includes Sonnet 5.5 and Opus 5.5 with default-fallback policies, multiple effort settings for GPT-6 Astra/Sol/Luna, and Gemini 4 Argon. Terminal-Bench supplies five effort settings for Astra, Fable 5.1 and Opus 5, plus other model families. Science covers seventeen models, including Opus 5.5. The Terminal-Bench owner feeds do not yet list Sonnet 5.5 or GPT-6.1 Sol. Vendor release self-reports are not inserted into owner-run results.

## Measurement safeguards

Each adapter pins its benchmark version. Harbor adapters also pin the dataset, check row ownership, import only displayed submissions and reject unannounced benchmark/dataset changes. Strict schemas isolate malformed rows, and existing shared validation/cache behavior retains the last good payload after failed refreshes.

Task cost is tied to the selected score's model, effort and evaluation configuration. Harbor costs divide the evaluation total by actual trials: 330 for Terminal-Bench (66 tasks × five repeats), 210 for Science (70 tasks × three repeats). Published mean runtime is already seconds/trial. Science's standard error is stated explicitly and never presented as a 95% confidence interval.

Terminal-Bench's Grok 4.7 partial-cost result retains its score and runtime but has no comparable task cost. AutomationBench's Fable/Opus fallback price omits fallback spending; Gemma's dedicated-deployment cost is also excluded. Gemini prices keep the published standard-list amounts, while DeepSeek's cached Fireworks pricing is identified in the readout. Genuine published zeroes stay zero; missing observations stay unavailable.

The shared model snapshot now preserves evaluation configuration in addition to model and reasoning settings. Different agents/fallback policies cannot overwrite an effort's measurements or share a connected curve. Explicit mixed-model fallback identities cannot borrow the primary model's token price. Model-wide price/context metadata can still join when published values agree; benchmark measurements and generation speed require an exact configuration.

AutomationBench discovers its first-party Framer modules dynamically and parses a restricted literal table without executing upstream JavaScript. Both Terminal-Bench sources share a small Harbor adapter, with source-specific configuration in their provider folders. Registering a provider discovers its capabilities, fetching, metadata, diagnostics, source controls and graph cases automatically. Existing metric kinds require no new UI metric definitions.

## Data and native-browser checks

The existing fixture matrix and visible T3 shared browser each cover **665 distinct 2D/3D metric/source combinations**, including all seven score sources and independent selectable pricing sources. Equivalent axis orders use the same joins and values, so the audit checks each unordered metric set once rather than enumerating every model subset.

| Result                                              | Data cases | Native-browser cases |
| --------------------------------------------------- | ---------: | -------------------: |
| Meaningful default graph; every axis varies         |        346 |                  346 |
| Selected benchmark does not publish the measurement |         75 |                   75 |
| No safely matching configurations                   |        244 |                  244 |
| Constant default axis                               |          0 |                    0 |
| Rendering failures                                  |          — |                    0 |

[Frozen-data results](release-benchmark-data-results.jsonl) record domains, selections and distinct-value counts. [Live browser results](release-benchmark-browser-results.jsonl) record native labels, point counts, SVG validity, active frames, painted WebGL geometry, finite scene positions and camera-visible markers. Unsupported combinations show their explanation without mounting a misleading chart. Reports retain exact fetch times; the browser uses live server snapshots, while tests use committed first-party fixtures and make no upstream requests.

Additional native interactions verified:

- DeepSWE cost/score/duration → AutomationBench switches both cost and score and removes unsupported duration, yielding seventeen points.
- AutomationBench → Terminal-Bench keeps a meaningful cost/score comparison; swapping X/Y keeps thirteen points. Adding Duration mounts thirteen 3D points using the same benchmark.
- Terminal-Bench → Science removes unsupported runtime and keeps six cost/score points. Science also renders six points in cost/score/token-price 3D.
- At 390 × 844, Science's uncertainty/harness readout fits the viewport, and AutomationBench's Sonnet “between tools” readout preserves its explicit setting and fallback policy. Neither settled layout has horizontal overflow.
- Source menus size to their longest label within available viewport width. All provider names fit without clipping at desktop and mobile widths; mobile menu bounds were x=105–359, including reserved checkmark spacing.
- Desktop Terminal-Bench's lower-score Grok point has a 252px-high readout contained inside the chart (bottom 776, chart bottom 784). The 2D renderer measures actual readout height instead of assuming 120px, fixing the prior long-provenance overflow.

The suite adds only four focused test cases: AutomationBench's restricted parser/configuration/pricing guards; Harbor denominator/uncertainty/partial-cost behavior; Harbor version/dataset/visibility checks; and configuration-specific joins and chart curves. Existing capability checks now infer expected providers from real fixture measurements instead of maintaining a provider allowlist. The existing single graph matrix expands automatically. All **103 tests**, typecheck, lint, formatting and production build pass. The build retains its existing large lazy-loaded 3D bundle warning.
