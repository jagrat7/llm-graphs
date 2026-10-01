# CursorBench coding provider audit

September 30, 2026 · `feat/add-score-providers` · [PR #30](https://github.com/jagrat7/llm-graphs/pull/30), based on [#29](https://github.com/jagrat7/llm-graphs/pull/29).

Added **CursorBench 4.0**, selected for real multi-file coding tasks, current Sonnet 5.5/Opus 5.5 coverage, published effort curves and same-run task costs. The [owner leaderboard](https://cursor.com/evals) has 63 configurations across fifteen model families: Sonnet 5.5 and 5, Opus 5.5 and 5, Fable 5.1, Grok 4.7 and 4.6, GPT-5.6 Sol/Terra/Luna, Gemini 3.8 Flash, Muse Spark 1.3, GLM 5.3/Flash and Composer 2.5. The fixture contains no malformed observations.

Sonnet 5.5 and Opus 5.5 each have low, medium, high, xhigh and max settings. Published examples: Sonnet 5.5 medium is 39.2% at $0.70/task; max is 55.5% at $9.67/task. Opus 5.5 max is 57.8% at $13.43/task. GPT-6/6.1 models are not yet listed by this owner; no release self-report is substituted. Composer's effort is unreported and remains unknown.

## Why this coding benchmark

[Cursor's methodology](https://cursor.com/blog/cursorbench) describes tasks drawn from actual internal developer sessions, including ambiguous requests, multiple files and tools, and agentic correctness grading. Its task refreshes and controlled internal sources reduce some contamination risks of fixed public repository benchmarks. The leaderboard's September 10 changelog introduces 4.0's long-horizon edit, refactor, investigation, intent-understanding, job-management and design-adherence tasks. The older methodology article still refers to version 3.1; the live 4.0 heading and changelog establish the imported revision.

Cursor is recognizable to developers, but this is a coding-agent vendor's own harness and grading suite. Its findings are useful alongside independent benchmarks; recognition does not establish impartiality or immunity to optimization. The owner also warns that small score differences may be statistical variance.

Considered [FrontierCode 1.1](https://cognition.com/frontiercode), which tests maintainer-defined mergeability and zeroes runs consulting solution-bearing internet sources, and [SWE-Bench Pro V2](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2), which repairs invalid tasks and locks evaluation/network/re-grading rules. CursorBench adds current cross-effort cost/performance comparisons for real coding sessions alongside the site's existing repository and terminal task benchmarks. The choice is based on those measurements and task coverage.

## Measurement safeguards

- Pin CursorBench 4.0 using the page's live benchmark heading. Validate table column order and per-task units before reading any numeric cells. Check duplicate names before dropping malformed measurements, so a conflicting run cannot disappear during validation. A version change, changed cost denominator or duplicate run identity fails the refresh; the shared cache retains the last good payload.
- Parse the first-party server-rendered table, including nested spans and React comments. Normalize responsive duplicate header labels. Never execute upstream JavaScript or pin hashed website bundles. Ignore the duplicate rendered copy of the same table rather than duplicating observations.
- Read native correctness percentages and published average cost/task directly from each model/effort row. Cursor computes those costs from actual task usage using published input, cache-read, cache-write and output prices. This is not a token-price surrogate or another benchmark's spending.
- Preserve explicit effort settings, Cursor agent configuration, model versions and family identity. `Extra High` becomes `xhigh`; an absent effort stays unknown. Cost follows score when the selected benchmark changes. Other harnesses' scores/runtime/speed cannot join this configuration.
- Include reported output tokens/task and rounded mean steps/task in point details. These are usage observations, not context limits, runtime or generation speed. No missing duration, confidence interval, release date or reasoning level is invented.
- Validate score range, nonnegative numeric measurements and integer reported counts. Missing values remain null; genuine published zeroes remain zero. Malformed in-scope rows stay visible in diagnostics.

The implementation lives in `providers/cursor-bench/`, with one registry entry. Existing source menus, metric capability checks, data fetching, diagnostics and combination cases expand automatically. There are no provider-specific UI branches or new metric kinds.

## Verification

The existing single frozen-data matrix covers **795 distinct 2D/3D metric/source combinations** across nine score sources. It checks measured provenance, finite coordinates and variation on every default axis, without exhaustively enumerating model subsets. The T3 shared browser independently computes the same matrix against live server data.

| Result                                      | Frozen data | Live browser data |
| ------------------------------------------- | ----------: | ----------------: |
| Meaningful graph; every axis varies         |         386 |               386 |
| Selected source does not publish the metric |          97 |                97 |
| No safely matching configuration            |         312 |               312 |
| Constant default axis                       |           0 |                 0 |

[Frozen-data results](cursor-bench-data-results.jsonl) retain every case. The [live browser summary](cursor-bench-browser-data-summary.json) records the independent counts and exact fetch times. Unsupported combinations explain the unavailable measurements without drawing misleading charts.

Only one focused parser test is added: version/denominator changes, HTML comments, malformed rows, paired effort/cost identity, absent effort/cost, published zeroes and duplicate run identity. The existing registry/capability tests and graph matrix cover registration and cross-source joins. All 105 tests, typecheck, lint, formatting and production build pass; the existing lazy-loaded 3D bundle size warning remains.
