# LLM Graphs verification map

This directory is the maintained source for verifying the user-facing behavior of LLM Graphs. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Start a server with `.claude/skills/verify-llm-graphs/scripts/llmg up` and keep the printed `LLMG_RUN`.
- `LLMG_RUN=<id> llmg doctor` passes. Note any source it lists with no data.
- No `settings` or `picked-models` cookie is sent unless a step says so. The helper sends none by default, so every `page` call is a fresh reader.
- Never drive a server this run did not start.

## Driving conventions

- `llmg` below means `.claude/skills/verify-llm-graphs/scripts/llmg`, always prefixed with `LLMG_RUN=<id>`.
- Pages: `llmg page '<path?query>' --name <step> [--cookie 'name=<json>']`. Assert on the printed facts JSON.
- APIs: `llmg api <path> --name <step>`. Assert on the printed status and the saved `.body` / `.headers.txt`.
- Upstream data changes daily. Read model ids and names from the run's own snapshot or default page instead of hard-coding them, except where a step pins its own ids.
- Browser steps: `llmg browse <journey.mjs> [--name <step>]`. Journeys live in `../journeys/`. Assert with `check()` inside the journey.
- Run every `llmg` step first. Browser-only steps are marked **(browser)**. Browser automation is allowed for them without asking, but only after the scripts have covered what they can; see SKILL.md.

## Proof and skip reporting

- Every step's artifacts are `<step>.*` in the run's evidence directory. Cite the facts file per assertion.
- A persistence claim needs a second, cookie-only load with no URL params carrying the state.
- Report a **(browser)** step whose browser run failed or couldn't start as unverified, with the gap it leaves. Do not substitute an HTTP step for it.
- Report a step that needs a source doctor listed as empty as blocked by that source.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with llmg` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Comparison axes](./comparison-axes.md) covers metric and benchmark choice per axis, the 3D Z axis, swapping, legacy links, and the unavailable-metric empty state.
- [Model picks](./model-picks.md) covers default picks, picking from the URL and the picker, persistence in the `picked-models` cookie, reset, and too-few or unknown picks.
- [Settings](./settings.md) covers starting-model count, hidden providers, effort levels, Pareto frontier, and provider logos, all kept in the `settings` cookie.
- [Share and export](./share-and-export.md) covers Copy link, opening a shared link, and the PNG and CSV downloads.
- [Model data API](./model-data-api.md) covers the public snapshot JSON with ETag revalidation, and the diagnostics route.
