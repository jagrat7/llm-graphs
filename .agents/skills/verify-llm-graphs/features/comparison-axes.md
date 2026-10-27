# Comparison axes

A reader chooses which metric each axis plots and which benchmark supplies it. They can add a third (Z) axis that turns the chart into a 3D cube, and swap neighbouring axes. When a metric doesn't exist for the chosen benchmark, the page explains why and offers a way back.

## Sub-features

- `axes-default` opens on Task cost (X) against Score (Y), both via the default score benchmark.
- `axes-metric` changes the metric on an axis.
- `axes-source` changes the benchmark on an axis that offers a source choice.
- `axes-z` adds a Z axis and switches the chart to 3D; removing it returns to 2D.
- `axes-swap` swaps X↔Y (and Y↔Z once Z is set).
- `axes-legacy` upgrades an old token-price link (`x=cost&xSource=artificialAnalysis`) to `x=price`.
- `axes-unavailable` explains a metric the score benchmark lacks and offers `Compare token price`.
- `axes-invalid` falls back to defaults for an unknown metric in the URL.

## How to get to it (user POV)

- Open `X-axis metric`, `Y-axis metric`, or `Add Z axis` and choose a metric.
- Open `Y-axis data source` (or the X/Z one when shown) and choose a benchmark.
- Choose `Swap the X and Y axes` between two rows.
- Choose `Remove Z axis and return to the 2D chart`.
- Open a link carrying `x`, `y`, `z`, and `*Source` params.

## Driving it with llmg

Preconditions:

- Doctor passes. `deepswe` and `artificialAnalysis` have data.

- **Default axes.** Open the bare page. Run `llmg page '/' --name axes-default`. `url` is `/?x=cost&y=score`, `axes.x.metric` is `cost` with `via` `DeepSWE`, `axes.y` is `score` with `source` `deepswe`, `axes.z` is null, `axes.zAddable` is true, and `chartAnnouncement` is `2D chart, two axes`.
- **Change metric and source.** Run `llmg page '/?x=price&y=score&ySource=artificialAnalysis' --name axes-source`. `axes.x.metric` is `price`, `axes.y.source` is `artificialAnalysis`, both `via` read `Artificial Analysis`, and `models.chips` differ from `axes-default`, because the picks follow the benchmark.
- **Add Z.** Run `llmg page '/?x=cost&y=score&z=duration' --name axes-z`. `axes.z.metric` is `duration` and `chartAnnouncement` is `3D chart, depth axis Task duration`.
- **Swapped link.** Run `llmg page '/?x=score&y=cost' --name axes-swap`. `axes.x.metric` is `score` with `source` `deepswe`, `axes.y.metric` is `cost`, and `models.count` is above 0.
- **Legacy link.** Run `llmg page '/?x=cost&xSource=artificialAnalysis&y=score' --name axes-legacy`. `url` has `x=price`, and `axes.x.metric` is `price` with source `artificialAnalysis`.
- **Unavailable metric.** Run `llmg page '/?x=duration&y=score&ySource=artificialAnalysis' --name axes-unavailable`. `emptyState` is `Task duration unavailable for this score benchmark`, `emptyActions` is `["Compare token price"]`, and `models.count` is 0.
- **Unknown metric.** Run `llmg page '/?x=bogus&y=score' --name axes-invalid`. `axes.x.metric` is `cost`, the default.
- **Interactive changes (browser).** Choose a metric from `X-axis metric`, a benchmark from `Y-axis data source`, `Swap the X and Y axes`, `Add Z axis`, then `Remove Z axis and return to the 2D chart`. After each step the URL params match the control, `[data-chart-frame="loaded"]` redraws, and the Z steps animate between 2D and the cube. Choosing `Compare token price` on the unavailable state lands on `x=price`.
- **Proof.** Keep `axes-default` and `axes-source` facts side by side, plus the `axes-unavailable` facts with the recovery action.

## Gotchas

- Task cost and Task duration have no source select. They always read the score axis's benchmark, so `axes.x.source` is null and only `via` names it.
- Changing a metric in the browser drops that axis's `*Source` param. A link that sets both keeps both.
- Votes come from Arena. When doctor lists `arena` as empty (the 403 from this machine), `x=votes` shows `No models have all selected metrics` instead of a chart. Report that as blocked by the source, not as an axes bug.
- The server only renders the 3D fallback. The cube itself, its morph, and the `Chart points` group exist only in a browser.
