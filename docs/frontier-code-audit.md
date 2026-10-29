# FrontierCode coding provider audit

October 29, 2026 · `t3/e38c6d5f`.

Added **FrontierCode 2.0** from [Cognition's leaderboard](https://cognition.com/frontiercode), released October 27, 2026 with 132 tasks. The fixture has 98 model/effort configurations across 25 models, with no malformed observations. Published examples: Claude Opus 5.5 max scores 45.5% at $12.82/rollout. GPT-6 Astra max scores 42.8% at $6.68, Claude Sonnet 5.5 max 41.0% at $19.94, and GPT-6.1 Sol max 39.0% at $1.03.

## Why this coding benchmark

FrontierCode measures mergeability: would the repository's maintainer merge the change? More than 20 open-source maintainers wrote the tasks and defined each repository's grading criteria. Grading uses unit tests, rubrics and other verifiers. The score is a weighted aggregate of rubric items. Failing any blocking criterion scores the run zero, and so does consulting a solution-bearing source such as the original pull request. Version 2.0 adds security-patch and performance tasks and raises task scope. The [2.0 methodology post](https://cognition.com/blog/frontier-code-2.0) describes the revision.

Cognition publishes this leaderboard and also builds Devin and the SWE models it ranks. Treat it as a vendor's own evaluation alongside the independent benchmarks.

## Measurement safeguards

- Read the leaderboard's own versioned feed, `https://cognition.com/data/frontier-code-2.0/data.json`, which the page's explorer loads. The version is part of the URL, so a new revision cannot replace 2.0 data. If the feed is retired, the refresh fails and the last good cache stays. Never execute the site's JavaScript.
- Use the site's **Score**: `new_score`, shown on the page as a percentage. Its top-ten JSON-LD list matches the fixture, for example Opus 5.5 max at 45.5%. `correct` is the separate pass rate and appears only in point details.
- Read `cost` as task cost. It is the mean USD per rollout at list API prices, including public discounts, never derived from a token price. Output tokens/rollout, pass rate and the fraction of runs zeroed for internet use appear in point details. Duration, tool-call and OTE fields are all null in this release and are not read.
- Keep each model's harness in its configuration. Anthropic models run in Claude Code, OpenAI models in Codex, Grok in Grok Build, Muse in Muse Code and Mistral in Mistral Vibe. Cognition's SWE models and every other model, including Gemini 4 Argon, run in Devin CLI. Cross-vendor gaps therefore include harness effects. Configuration-dependent metrics from other sources, such as speed, Arena votes and METR horizons, do not join these runs.
- Efforts map directly. SWE-1.6 and SWE-1.7 publish `na`, which stays unknown and is marked `configurationKnown: false`. Creators come from the model name's first word, because the feed's lab colours are shared between labs.
- Validate score, pass rate and flag rate in [0, 1], and cost and tokens as nonnegative. A missing run, harness or score drops only that row and leaves it visible in diagnostics. A duplicate model/effort identity, or a feed without the `main` task set, fails the refresh.

## Joins

21 of 25 models join existing entries, including Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1, GPT-6.1 Sol, GPT-6 Astra/Luna/Sol, Gemini 4 Argon, Grok 4.7, Kimi K3, GLM 5.3 and Muse Wonder. Cognition's SWE-1.6, SWE-1.7 and SWE-2 appear in no other source. In the committed fixtures Beam 1.0 is only a near miss against models.dev's `reflection/beam-1.0-501b-a23b` and is not merged on a prefix. With live data from all sources it joins, leaving only the three SWE models unmatched.

## Verification

The frozen-data matrix (`bun dev/audit-graphs.ts docs/frontier-code-data-results.jsonl`) now covers 1,176 distinct metric/source combinations with no constant-axis cases. FrontierCode contributes 76 cases: 26 meaningful, 38 safe refusals where configurations cannot match, and 12 metrics it does not publish. This is the same profile as CursorBench and SWE-bench Verified. On an isolated dev server with every source fetched live, `/api/models/snapshot` returned 98 FrontierCode variants across 25 entries. `/?x=cost&y=score&ySource=frontierCode` rendered a 2D chart of nine models, with cost following the score source. Browser rendering was not re-audited for this change.
