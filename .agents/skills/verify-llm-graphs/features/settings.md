# Settings

The Settings dialog changes how this browser's chart opens and looks: how many models it starts on, which providers' models appear, the Pareto frontier, whether every axis opens on a log scale, provider logos, and the chart's graph paper pattern. The cookie holds only the settings a reader changed, so the server renders the next visit with them and the rest follow the current defaults. The Pareto frontier starts off.

## Sub-features

- `settings-opening` sets the starting model count (6, 9, or 12).
- `settings-hide-providers` hides chosen providers' models from defaults, picker, and chart.
- `settings-effort` shows all effort levels or only the highest per model **(browser: chart points)**.
- `settings-pareto` toggles the Pareto frontier line **(browser)**.
- `settings-logos` toggles logo markers versus plain dots **(browser)**.
- `settings-paper` toggles the graph paper pattern, the fine rulings between gridlines **(browser: [`paper-grid.mjs`](../journeys/paper-grid.mjs))**.
- `settings-persist` writes the cookie the server reads on the next load **(browser for the write)**.

## How to get to it (user POV)

- Choose `Settings` in the header. A dialog titled `Settings` opens with a `Chart` section (`Starting models`, `Pareto frontier`, `Log scale`, `Provider logos`, `Gridlines detail`) and a `Providers` section with `Search providers` and one checkbox per provider. Close it with `Done`.
- Come back later in the same browser: the server reads the `settings` cookie.

## Driving it with llmg

Preconditions:

- Doctor passes and `deepswe` has data.
- Capture `llmg page '/' --name settings-baseline` first, with no cookie, as the comparison point.

- **Opening count.** Load as a reader who chose 6. Run `llmg page '/' --name settings-opening-6 --cookie 'settings={"openingModels":6}'`. `models.count` is 6, and the chips are a subset of `settings-baseline`'s 9.
- **Hide a provider.** Load as a reader who unticked Anthropic. Run `llmg page '/' --name settings-hide --cookie 'settings={"hiddenProviders":["anthropic"]}'`. No chip starts with `Claude`, and `models.count` is still the default (9), because other vendors fill the slots.
- **Malformed cookie.** Run `llmg page '/' --name settings-garbage --cookie 'settings={"openingModels":7,"hiddenProviders":"x"}'`. The facts match `settings-baseline`: each bad field falls back on its own.
- **Dialog writes the cookie (browser).** Open `Settings`, set `Starting models` to 6, untick a provider under `Providers`, and choose `Done`. The chips update at once, and `document.cookie` contains `settings=` with `"openingModels":6` and the vendor slug. Then load that cookie with `llmg page` as above and see the same chips: that is the persistence proof.
- **Pareto, log scale, logos (browser).** Toggle each one and compare `[data-chart-frame="loaded"]` before and after: the dashed frontier line on or off, every log-capable axis (such as Task cost) switching to log, and logos replaced by dots. With `Log scale` on, turning an axis's log switch off writes `linear` into the URL, and the share link carries the on-screen log axes in `log`. The server HTML does not change for these three.
- **Defaults, log in the link, changes-only cookie (browser).** Run `llmg browse log-and-defaults.mjs`. A fresh reader starts with Pareto off and Task cost linear; the log switch writes `log` into the URL and the share link, a shared or hand-written `log=cost` link opens on log, the cookie holds only changed fields, and Reset deletes it.
- **Gridlines detail (browser).** Run `llmg browse paper-grid.mjs`. It counts `.chart-paper-ruling line` in the 2D chart (above zero by default), turns `Gridlines detail` off in the dialog, checks the cookie holds `"paperGrid":false`, then confirms zero rulings before and after a reload while the labelled gridlines stay. The server HTML does not change for this one either.
- **Proof.** Keep `settings-baseline`, `settings-opening-6`, and `settings-hide` facts side by side.

## Gotchas

- Vendor slugs (`anthropic`, `openai`, …) are what the cookie stores, not display names. Read real slugs from `jq -r '[.entries[].vendor] | unique[]' <evidence>/snap.body`.
- Saving the defaults deletes the cookie instead of writing `{}`.
- Hiding every provider with picked models shows `No models from the providers you have on` with `Turn all providers on`, but only after hydration. Prove it in a browser.
- The browser writes cookies through the Cookie Store API, which only exists in secure contexts. On `http://127.0.0.1` it exists, but on a plain-HTTP LAN address it does not, so nothing persists there.
- Keep this cookie out of journeys for other features unless a step sets it on purpose. `hiddenProviders` changes which points and chips appear, and `logScale` changes the axes.
