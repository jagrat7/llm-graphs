---
name: verify-llm-graphs
description: Launch an isolated LLM Graphs dev server (the TanStack Start web app in this repo) and prove user-facing behavior of the model comparison page — axes, model picks, settings, share links, and the snapshot API — by driving its server-rendered page and HTTP routes, capturing evidence under .verify/. Use when asked to verify, check, or demonstrate that a change works in the real app rather than in unit tests.
---

# Verify LLM Graphs

LLM Graphs is one web page (`/`, "Compare language models") that plots models from public benchmark sources on 2–3 metric axes. State lives in three places a reader controls, and the server renders all three into the first HTML:

- **URL search params:** `x`, `y`, `z` (metrics), `xSource`, `ySource`, `zSource` (benchmarks), `models` (picked entry ids).
- **`settings` cookie:** URI-encoded JSON `{hiddenProviders, paretoFrontier, vendorLogos, effortLevels, openingModels}`.
- **`picked-models` cookie:** URI-encoded JSON array of entry ids.

The primary drive is therefore HTTP: request the page the way a browser's first load does and read what it renders. The chart itself (SVG scatter/ranges, three.js cube), popovers, dialogs, the share menu, and anything that changes after hydration only exist in a browser.

Everything below uses the helper `scripts/llmg` (bash; needs `bun`, `curl`, `jq`, `ss`, `setsid`, plus `node`, Playwright, and Chromium for `browse`). Run it from the repo root as `.claude/skills/verify-llm-graphs/scripts/llmg` (or the same path under `.agents/skills/`). Run it with no arguments for usage.

## Launch

```bash
V=.claude/skills/verify-llm-graphs/scripts/llmg
$V up                 # or: $V up --port 3420
# LLMG_RUN=20261026-235313-1812700
# url=http://127.0.0.1:3417
# evidence=/home/.../llm-graphs/.verify/llm-graphs/20261026-235313-1812700
```

`up` picks the first free port in 3417–3437, runs `bun install` if `node_modules` is missing, and starts `vite dev` in its own process group with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` blanked. The repo `.env` points at the shared Upstash cache that production also uses. With the variables blank, the server keeps its cache in memory, so a run never reads or writes production state. `AA_API_KEY` still comes from `.env`, and Artificial Analysis needs it.

It returns only when ready: `/api/models/snapshot` answers with at least one entry **and** `/` renders "Compare language models". The first snapshot request fetches every upstream source live, which takes about 5s and up to 180s on a slow network. There is no seed data: the data is whatever the upstream sources serve today, so assert on structure and relations (counts, which axis says what, that a pick shows up), not on exact model names unless the step pins them itself.

Every later command needs the run id: prefix it as `LLMG_RUN=<id> $V doctor`. Shell state does not persist between tool calls. With exactly one active run, the id may be omitted.

Several runs can live side by side; each gets its own port, scratch dir (`$TMPDIR/llmg-verify/<id>/`), and evidence dir. Never drive a server you did not start with `up`. The user's own `bun run dev` on :3000 shares the production Redis cache.

## Doctor

```bash
LLMG_RUN=<id> $V doctor
```

Read-only. It checks these, and exits non-zero if any fails:

- the process group is alive
- the listener on the port belongs to that group
- `HEAD` still matches the commit the server started on. After switching commits, run `down` and `up` so the evidence names a single revision.
- the snapshot has models
- every source timestamp in `snapshot.fetchedAt` is newer than the run's start. This proves the in-memory cache. A stale stamp means the server is reading a shared cache, so stop and tear down.

A `note` line lists sources with no data this run. Run `$V log` to see why; Arena usually shows `Arena Text returned 403` from this machine. Run doctor first whenever anything looks off.

## Drive

### Page (primary)

```bash
LLMG_RUN=<id> $V page '<path?query>' --name <artifact-name> [--cookie 'name=<json>']...
```

`page` fetches the page with redirects followed, like a first browser load. It saves `<name>.request.txt`, `.headers.txt`, `.status.txt`, and `.html`, then prints and saves `<name>.facts.json`, which `scripts/page-facts.ts` reads from the HTML by ARIA label and `data-slot`:

| Fact | Read from |
| --- | --- |
| `status`, `url` | final status and path after redirects (`/` redirects to `/?x=cost&y=score`) |
| `axes.{x,y,z}.metric` / `.label` | combobox `X-axis metric` (etc.) and its hidden input value |
| `axes.*.source` | combobox `X-axis data source`; `null` when the source is fixed |
| `axes.*.via` | the "via …" benchmark name shown under the axis |
| `axes.zAddable` | the `Add Z axis` combobox is present |
| `models.count` / `.chips` / `.more` | `Models N` popover trigger; chip names in `[data-slot=model-picker-ghost]` |
| `chartAnnouncement` | the polite live region: `2D chart, two axes` or `3D chart, depth axis <Metric>` |
| `chartFrame` | `[data-chart-frame]`: always `loading` in server HTML (the chart is client-only) |
| `emptyState`, `emptyActions` | `[data-slot=empty-title]` and its buttons |
| `alerts` | `[data-slot=alert-title]` texts |

`--cookie` takes raw JSON and URI-encodes it the way the app does. Examples:

```bash
$V page '/?x=price&y=score&ySource=artificialAnalysis' --name aa-price
$V page '/' --name six --cookie 'settings={"openingModels":6}'
$V page '/' --name picks --cookie 'picked-models=["claude-opus-5","grok-4-6"]'
```

Metric keys: `score cost price speed duration inputPrice outputPrice context votes horizon80 taskScore`. Source keys are the snapshot's `variants` keys: `artificialAnalysis deepswe metr arena automationBench terminalBench terminalBenchScience arcPrize cursorBench sweBench liveCodeBench`. Entry ids come from `jq -r '.entries[].id' <evidence>/<name>.body` after an `api` snapshot fetch.

### API

```bash
LLMG_RUN=<id> $V api /api/models/snapshot --name snap [--header 'If-None-Match: "<etag>"']
LLMG_RUN=<id> $V api /api/models/diagnostics --name diag
```

`api` prints the status code and saves `<name>.request.txt`, `.headers.txt`, and `.body`.

### Browser (second resort)

Use browser automation when the HTTP drive cannot test the change or leaves gaps in the evidence. That covers anything after hydration: chart marks and tooltips, the Ranges/Scatter toggle, log-scale toggles, Pareto and logo rendering, the picker popover and the `/` shortcut, the Settings dialog writing its cookie, the Share menu (Copy link, Download image PNG, Download data CSV), theme switching, the 3D morph, and cross-tab cookie sync.

**The user allows browser automation for this skill, but `llmg` comes first.** Cover everything the scripts can reach with `llmg page` and `llmg api`, and use the browser only for the steps marked (browser) or for a gap the scripts leave. Say which gap needed it. You don't need to ask first: this permission overrides the general "no agent-browser unless asked" rule in the repo's `CLAUDE.md`, but only for verification under this skill.

```bash
LLMG_RUN=<id> $V browse model-picks.mjs        # a file in journeys/, or a path to your own
LLMG_RUN=<id> $V browse ./my-journey.mjs --name settings-dialog [--headed]
```

`browse` runs a journey under Node with this machine's Playwright (found from `playwright` on PATH, or `PLAYWRIGHT_ROOT`) and the system Chromium at `/usr/bin/chromium` (override with `CHROMIUM`). Each journey gets a fresh browser context with no cookies, a 1440×900 viewport, `baseURL` set to the run's `url`, clipboard permissions, and downloads enabled. It exits non-zero on the first failed check.

A journey is an ES module whose default export receives `{ page, context, base, step, check, cookies, saveDownload }`:

- `step(label, fn)` runs `fn`, then saves `NN-<label>.png`, `NN-<label>.aria.yml` (the page's ARIA snapshot), and a `steps.jsonl` line with the URL, the decoded app cookies, and `fn`'s return value.
- `check(ok, message)` fails the journey unless `ok` is truthy.
- `cookies()` returns `{ settings, "picked-models" }`, decoded, or `null` when unset.
- `saveDownload(download)` saves a Playwright download into the journey's evidence directory.

[`journeys/model-picks.mjs`](journeys/model-picks.mjs) is the worked example: it adds a model in the picker, removes a chip, reloads to prove the cookie, then uses Reset. Copy its shape for new journeys, and save new ones in `journeys/` once they pass. Wait for `[data-chart-frame="loaded"]` before touching controls, because they stay disabled until the browser has the snapshot. When you need a handle, read it from an `.aria.yml` file rather than guessing.

Evidence goes to `<evidence>/<journey-name>/`. A rerun in the same run gets `<journey-name>-2/` and so on, so a failed attempt's `failure.png` and `steps.jsonl` survive. Console errors and page errors go to `console.txt`, and `result.json` records pass or fail. Video recording is unavailable here: Playwright needs its own ffmpeg at `~/.cache/ms-playwright/ffmpeg-1013/` (from `playwright install ffmpeg`) and does not use the system `/usr/bin/ffmpeg`. Use the per-step screenshots.

The existing `dev/browser-graph-audit.js` is a separate, dev-only in-page audit (`import('/dev/browser-graph-audit.js')` in the page console) that walks every axis combination.

Stable browser handles (ARIA): `Settings`, `Search models` (shortcut `/`), `Models N` (picker trigger; its popover is dialog `Models` with `Reset`, `Clear`, and one checkbox per model, named by model), `X-axis metric`, `Y-axis data source`, `Add Z axis`, `Remove Z axis and return to the 2D chart`, `Swap the X and Y axes`, `Chart view` (Ranges/Scatter), `Log scale for <label>`, `Pareto frontier`, `Share`, `Show N more selected models`, `Switch to dark theme`, `Search providers`. Visible model chips are `[data-slot="combobox-chip"]`, and their remove buttons, `[data-slot="combobox-chip-remove"]`, have **no accessible name**. Only chips inside the `Show N more` popover have `Remove <model name>`. The chart root is `[data-chart-frame="loaded"]` once drawn.

## Evidence

Everything lands in `.verify/llm-graphs/<run-id>/`, which is gitignored and survives `down`. `down` also copies `server.log` there. Proof standards:

- Exercise the real user path: a URL a reader would open, cookies the app itself writes (same names, same JSON shape). Never call server functions directly or edit the in-memory cache.
- Capture the action and the resulting state: name artifacts per step (`before`, `after-pick`, …) so the change between them is visible, not just the final page.
- Verify side effects too. A pick persists through the `picked-models` cookie, so prove it by loading `/` with that cookie and no `models` param, not only the URL that set it.
- No mocks: upstream sources are live. When a source is down (doctor's `note`), record it and do not report journeys that need that source as verified.
- When a journey needs a browser, drive it in the browser. If the browser path fails or isn't available, report the step as unverified, along with the gap, rather than verifying a neighbouring HTTP path in its place.

## Cleanup

```bash
LLMG_RUN=<id> $V down
```

`down` kills only the process group `up` recorded (TERM, then KILL after 5s), copies the log into evidence, deletes `$TMPDIR/llmg-verify/<id>/`, and confirms the port is free. It never kills by process name, never touches other runs, and never deletes `.verify/`. After a failed attempt, still run `down` for every run id you started. To remove old proof deliberately, delete the specific `.verify/llm-graphs/<id>/` yourself.

## Features

The maintained feature map is [features/README.md](features/README.md). A proof that drives one entry point is incomplete when the map lists others for the same feature.
