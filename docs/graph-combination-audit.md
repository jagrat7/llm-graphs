# Graph combination audit

Branch: `fix/graph-metric-combinations` · September 30, 2026

The five metrics produce 20 selectable 2D axis orders and 60 selectable 3D axis orders. Each metric currently has one provider. Repeated metrics are disabled in the controls. The full browser results are in [graph-combination-results.json](graph-combination-results.json).

| Metric        | Source              | Meaning                                                           |
| ------------- | ------------------- | ----------------------------------------------------------------- |
| Score         | DeepSWE             | DeepSWE v1.1 pass rate, as a percentage                           |
| Task cost     | DeepSWE             | Reported mean dollars per evaluated task, at that reasoning level |
| Token price   | Artificial Analysis | Dollars per million tokens, using a 3:1 input/output blend        |
| Output speed  | Artificial Analysis | Published output-generation tokens per second                     |
| Task duration | DeepSWE             | Reported mean wall time per evaluated task, in seconds            |

DeepSWE's task cost, score, and duration describe its evaluated workload. AA output speed and token prices describe different measurements; task duration is not inferred from AA speed. Cross-source points require exactly matching model, reasoning mode, and effort level.

## Corrections

- DeepSWE now exposes `mean_cost_usd` directly as task cost. Its observed task cost divided by token consumption is no longer offered as a published token price.
- AA token pricing has its own metric. Task cost follows the Score benchmark, and stays unavailable when that benchmark publishes no task cost. AA cannot substitute its token price for task cost.
- Provider services reject invalid scores, negative/nonfinite prices and task costs, and nonpositive/nonfinite speeds and durations. A real zero task cost or score remains valid; AA's all-zero hosted-price placeholder remains unavailable.
- Required missing measurements exclude a configuration before it reaches the picker and default selection. Optional leaderboard values stay unavailable. Conflicting optional source rows cannot supply measurements to another source's configuration.
- Axis notes and point readouts distinguish the workloads and cost units. Existing Compare links explicitly selecting AA's old Cost resolve to Token price. The DeepSWE leaderboard displays dollars per task.
- SVG line animations start with a valid path, avoiding an initial `d="undefined"` browser error.
- 3D axis titles show the metric and unit without clipping lengthy benchmark notes. Hovering a title exposes the full provider note.

## Verification

The browser audit uses the live page snapshot, visits every axis order through the app router, and compares rendered point counts, graph summaries, and axis titles with the shared plot data. It checks for empty plots and invalid geometry. Browser results record the default selections and axis domains; the source fetch times are included.

All 80 combinations pass the data and DOM checks, with six default models and 17–19 plotted configurations. Additional DOM interaction checks confirm that swapping axes preserves their metrics, choosing Token price changes its attribution to AA, and metrics already used on another axis are disabled. The leaderboard retains all 70 current DeepSWE configurations and labels its cost column `Task cost $/task` (the leading GPT-6 Astra xhigh row shows the published $4.43 task cost). A legacy `/graph-3d` link with AA Cost redirects to Compare with Token price and retains the source selection.

The regression matrix exercises all 80 combinations against committed provider fixtures. It checks multiple plotted models, varying domains, finite normalized positions, no silently excluded selected variants, and exact metric provenance at the same model/mode/level. Provider tests separately verify task-cost units and invalid/missing measurements.

`bun run lint`, `bun run typecheck`, `bun run test` (156 tests), `bun run fmt:check`, and `bun run build` pass. The build retains its existing warning about the 3D bundle size.

**All 80 combinations were rendered and captured in the shared T3 preview.** With animation frames running at a 1281 × 900 viewport, all 20 SVG graphs had valid paths and all 60 WebGL graphs had painted geometry on their resized 1233 × 630 canvases. Live WebGL readback checked the mounted scene and camera; every 3D axis title was visible and inside the chart bounds. All 80 saved screenshots were reviewed in the sheets below. Front, Top, and Perspective were also inspected on Score / Token price / Task duration; the Top camera respects the existing OrbitControls polar-angle limit. These checks cover the default model selections at this desktop viewport.

The initial rendering run was interrupted by paused preview animation frames. Checks resumed once drawing was active; the results retain the initial limitation in `summary.initialVisualRun`. The cause of the preview interruption was not established.

Saved screenshot sheets: [1](graph-combination-screenshots-1.jpg), [2](graph-combination-screenshots-2.jpg), [3](graph-combination-screenshots-3.jpg), [4](graph-combination-screenshots-4.jpg). Individual screenshot paths and rendering measurements are recorded per combination in the results JSON.

## Source evidence

- [DeepSWE leaderboard and methodology](https://deepswe.datacurve.ai/) publish pass rates and average task costs for model/effort configurations. DeepSWE is its own engineering benchmark.
- [Artificial Analysis API reference](https://artificialanalysis.ai/api-reference) identifies pricing in USD per million tokens and output speed in tokens per second, and documents the 3:1 blend.
