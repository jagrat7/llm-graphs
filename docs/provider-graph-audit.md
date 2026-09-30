# Additional score provider audit

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
- Switching score providers now selects the closest meaningful comparison and eligible default models. Selecting METR from the AA cost/score/speed cube opens token price versus task horizon in 2D. Axis menus disable combinations without enough compatible measured values, including adding a third axis to METR. Explicit unsupported links still show their explanation and recovery action.
- METR and unspecified Arena configurations cannot join AA output speed. Explicit configurations match on model, reasoning mode and level. Token pricing can join independently of effort only when published model prices agree; equal `unknown` labels do not establish an exact configuration match.
- Shared provider validation prevents invalid values and semantically empty HTTP-200 refreshes from replacing the last good cache copy. Source parsers detect benchmark, category, adjustment and API-version changes.
- Default selections add a genuinely different measured model if their strongest-vendor selection makes an axis constant. User-selected constant axes keep their real values and show `No variation on …`; no points are jittered to create apparent variation.
- Native labels exposed a 3D clipping bug at shallow rotations. The projector now calculates the actual rotated bounding box and keeps essential axis titles inside the chart frame.
- Confidence intervals exposed unreadable tooltip labels at mobile widths. The shared point readout now gives labels and values separate lines, wraps interval/source metadata, and displays native units.
- A three-model Arena comparison exposed a mobile camera crop: every point fell outside the narrow viewport. Responsive field of view now preserves framing on the narrower dimension; regression tests project every cube corner, and the browser audit verifies each point marker remains in view.
- One provider registry now drives fetching, types, diagnostics, presentation, attribution and selector capabilities. [Adding a provider](adding-a-score-provider.md) describes the remaining adapter and fixture work.

## Coverage and results

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
