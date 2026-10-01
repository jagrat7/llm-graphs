# Additional score provider audit

**Latest results:** [release-benchmark audit](release-benchmark-audit.md) covers seven score sources and 665 distinct metric/source combinations. The rollout checks below remain historical evidence.

September 30, 2026 · branch `feat/add-score-providers` · builds on [the original combination audit](graph-combination-audit.md).

Added AA Intelligence Index, METR Time Horizon 1.1 and Arena Text overall with style control. AA reuses its existing provider; METR and Arena have separate provider folders. [Selection research and primary sources](score-provider-research.md) explain the quality, freshness and recognition tradeoffs.

| Score source        | Native measurement                   | Benchmark task cost         | Main qualification                                                                         |
| ------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------ |
| DeepSWE             | Pass rate, %                         | Published mean $/task       | Same engineering benchmark and reasoning configuration                                     |
| Artificial Analysis | Intelligence Index, points; API v4.3 | Published index mean $/task | Version and configuration stay attached to both observations                               |
| METR                | 50% task horizon, hours              | Unavailable                 | Model plus scaffold; human task difficulty, not AI runtime; estimates above 16 h withheld  |
| Arena Text          | Preference rating, points            | Unavailable                 | Blind human preference, overall category with style control; confidence intervals retained |

METR's latest dashboard update is May 8, 2026, with limited model coverage. Arena's snapshot cutoff is September 30, 2026. No source's scores are converted into another source's scale or presented as a shared accuracy percentage.

## Failures turned into protections

- Task cost and runtime follow the selected score benchmark. Missing benchmark measurements produce an explanation and a working recovery button rather than borrowing another benchmark's data.
- Switching score providers now selects the closest meaningful comparison and eligible default models. Selecting METR from the AA cost/score/speed cube opens token price versus task horizon in 2D. Axis menus disable combinations without enough compatible measured values, including unsupported third axes. METR now publishes enough independent measurements for a native 3D comparison. Explicit unsupported links still show their explanation and recovery action.
- METR and unspecified Arena configurations cannot join AA output speed. Explicit configurations match on model, reasoning mode and level. Token pricing can join independently of effort only when published model prices agree; equal `unknown` labels do not establish an exact configuration match.
- Shared provider validation prevents invalid values and semantically empty HTTP-200 refreshes from replacing the last good cache copy. Source parsers detect benchmark, category, adjustment and API-version changes.
- Default selections add a genuinely different measured model if their strongest-vendor selection makes an axis constant. User-selected constant axes keep their real values and show `No variation on …`; no points are jittered to create apparent variation.
- Native labels exposed a 3D clipping bug at shallow rotations. The projector now calculates the actual rotated bounding box and keeps essential axis titles inside the chart frame.
- Confidence intervals exposed unreadable tooltip labels at mobile widths. The shared point readout now gives labels and values separate lines, wraps interval/source metadata, and displays native units.
- A three-model Arena comparison exposed a mobile camera crop: every point fell outside the narrow viewport. Responsive field of view now preserves framing on the narrower dimension; regression tests project every cube corner, and the browser audit verifies each point marker remains in view.
- One provider registry now drives fetching, types, diagnostics, presentation, attribution and selector capabilities. [Adding a provider](adding-a-score-provider.md) describes the remaining adapter and fixture work.

## Initial five-metric coverage and results

The five metrics produce 80 axis orders. Orders containing Score run once per score provider; orders without Score run once. This makes **212 cases**, without multiplying them by every possible model selection.

| Result                                              | Cases |
| --------------------------------------------------- | ----: |
| Meaningful default graph; every axis varies         |   116 |
| Benchmark does not publish a selected measurement   |    88 |
| No safe configuration match: METR with output speed |     8 |
| Constant default axis                               |     0 |

The frozen-fixture matrix inspects all imported rows, finite measurements, exact metric provenance, eligible defaults, normalized point positions and per-axis distinct-value counts. Fixtures contain 687 AA rows, 70 DeepSWE rows, 26 METR rows and 410 Arena rows, with no dropped rows in these snapshots. Full data results: [provider-graph-data-results.jsonl](provider-graph-data-results.jsonl).

The visible shared T3 preview visits all 212 cases at 1280 × 800. All supported SVG charts have valid paths and all supported WebGL charts have painted geometry, finite scene positions, active animation frames and unclipped native axis titles. Unsupported cases mount their explicit unavailable state with no chart. Full browser results: [provider-graph-browser-results.jsonl](provider-graph-browser-results.jsonl).

Additional checks cover [37 representative cases at 390 × 844](provider-graph-mobile-results.jsonl), METR and Arena confidence-interval readouts, AA's Front and Top cameras, both recovery buttons, and an injected constant task-cost axis. The injection produced the expected warning and was removed afterward. These checks cover default selections plus targeted edge cases; they do not claim every subset of models, camera rotation or viewport was visually inspected. Reports use JSON Lines: one summary followed by one record per case.

One compact fixture test checks all 212 cases through the shared graph rules. It replaces the original overlapping matrix, rather than adding hundreds of separate tests. Small regressions cover the actual parser, cache, configuration, constant-axis and camera failures.

The follow-up provider-selection check evaluates all 176 benchmark-containing axis orders against the live browser snapshot: every closest usable comparison retains its requested score provider and varies on every axis. Native selector interactions verify the AA 3D → METR 2D transition, METR's disabled task cost/runtime/speed choices and disabled third axis, and the AA 3D → Arena 3D transition. The existing fixture matrix includes one default-switch check per provider and the specific METR regression; the suite remains 99 tests.

An effort-label follow-up found that Arena's parenthesized labels and Muse Spark suffixes were imported as unspecified configurations. The Arena adapter now preserves `(xHigh)`, `(thinking-minimal)`, Muse Spark `-max`, and explicit thinking/non-thinking distinctions. Product names such as Qwen Max and budget/date-qualified variants stay intact. The shared readout states unreported reasoning settings instead of hiding them as a default. The existing parser/view tests cover these failures without adding test cases. All 12 supported Arena/METR axis layouts pass a fresh native-browser rendering, label, camera-visibility and variation audit; the full 212-case fixture matrix and 99-test suite pass.

Representative screenshots: [AA Intelligence Index in 3D](aa-index-3d.png), [METR horizon and confidence interval](metr-horizon-2d.png), [Arena in mobile 3D](arena-3d-mobile.png).

`bun run lint`, `bun run typecheck`, `bun run test` (99 tests, including the 212-case matrix), `bun run fmt:check`, and `bun run build` pass. The build retains the existing warning about the large lazy-loaded 3D bundle. Tests make no upstream requests.

## Additional METR and Arena measurements

The current app has eleven metric choices. Existing readers remain available; the adapters now also expose:

| Provider   | Added measurements                                                                     | Meaning and safeguards                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arena Text | Input token price, output token price, blended token price, context length, vote count | Prices are listed $/M tokens; blend is 3:1 input/output. Context is the listed window, not measured long-context ability. Votes describe evidence volume, not quality. Missing fields remain unavailable and zero prices remain zero. |
| METR       | 80% task horizon, average task score                                                   | Horizon uses human-task hours at 80% success, with confidence bounds and the same 16-hour validity ceiling. Average score is the published task average, shown separately from reliability thresholds.                                |

Arena point details show votes, rank with its published uncertainty, and snapshot date. Arena's better upper rank is numerically smaller; bounds are displayed in ascending order. METR scaffold information is visible on touch and keyboard readouts; repeated provenance is shown once and long identifiers wrap. Separate effort lines preserve the model name at mobile widths. Horizon tick precision distinguishes nearby values.

Arena pricing is the default alongside Arena ratings, with Artificial Analysis still independently selectable. The parser skips unrelated embedded leaderboards before selecting Text overall/style-control; selected data still undergoes strict validation. Historical METR GPT-2 and Davinci IDs retain their rows but now identify OpenAI as their vendor, preventing them from taking extra vendor slots in defaults. Unpublished effort, task costs and runtime remain unavailable.

To control the enlarged matrix, data and browser audits check **470 distinct metric/source combinations**, covering each unordered 2D/3D metric set and every selectable source. This represents 2,428 axis/source permutations without repeating equivalent joins six times or enumerating model subsets. Defaults reuse immutable-snapshot rankings and encode vendor logos once per comparison instead of once per point.

| Eleven-metric rollout result                 | Cases |
| -------------------------------------------- | ----: |
| Meaningful default graphs, every axis varies |   279 |
| Benchmark lacks a selected measurement       |    53 |
| No safe matching configurations              |   138 |
| Constant default axes or browser failures    |     0 |

The [data report](additional-provider-metrics-data-results.jsonl) validates measurements, joins and defaults. The [desktop browser report](additional-provider-metrics-browser-results.jsonl) verifies all 470 states, native units, finite SVG/WebGL geometry, active frames and point visibility. A missing initial position on animated fallback SVG circles was corrected; the audit also validates circle coordinates. [Seven mobile rendering cases and targeted readouts/swaps](additional-provider-metrics-mobile-results.jsonl) cover the new METR 3D graph, Arena pricing/context/votes, both pricing sources, native confidence bounds, accessible provenance and horizontal overflow at 390 × 844.

The existing single fixture matrix now covers those 470 cases; parser and formatting regressions extend existing tests. The suite remains **99 tests**, with no new test cases or upstream requests. Lint, type checking, formatting and production build pass. The existing large lazy-loaded 3D bundle warning remains. Historical five-metric audit artifacts above are retained as evidence of the initial rollout, not the current metric count.
