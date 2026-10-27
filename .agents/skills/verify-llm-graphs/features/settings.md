# Settings

The Settings dialog changes how this browser's chart opens and looks: how many models it starts on, which providers' models appear, whether to show every effort level or only each model's highest, the Pareto frontier, and provider logos. Every choice is stored in the `settings` cookie, so the server renders the next visit with it.

## Sub-features

- `settings-opening` sets the starting model count (6, 9, or 12).
- `settings-hide-providers` hides chosen providers' models from defaults, picker, and chart.
- `settings-effort` shows all effort levels or only the highest per model **(browser: chart points)**.
- `settings-pareto` toggles the Pareto frontier line **(browser)**.
- `settings-logos` toggles logo markers versus plain dots **(browser)**.
- `settings-persist` writes the cookie the server reads on the next load **(browser for the write)**.

## How to get to it (user POV)

- Choose `Settings` in the header. A dialog titled `Settings` opens with a `Chart` section (`Starting models`, `Effort levels` with `All` / `Highest only`, `Pareto frontier`, `Provider logos`) and a `Providers` section with `Search providers` and one checkbox per provider. Close it with `Done`.
- Come back later in the same browser: the server reads the `settings` cookie.

## Driving it with llmg

Preconditions:

- Doctor passes and `deepswe` has data.
- Capture `llmg page '/' --name settings-baseline` first, with no cookie, as the comparison point.

- **Opening count.** Load as a reader who chose 6. Run `llmg page '/' --name settings-opening-6 --cookie 'settings={"openingModels":6}'`. `models.count` is 6, and the chips are a subset of `settings-baseline`'s 9.
- **Hide a provider.** Load as a reader who unticked Anthropic. Run `llmg page '/' --name settings-hide --cookie 'settings={"hiddenProviders":["anthropic"]}'`. No chip starts with `Claude`, and `models.count` is still the default (9), because other vendors fill the slots.
- **Malformed cookie.** Run `llmg page '/' --name settings-garbage --cookie 'settings={"openingModels":7,"hiddenProviders":"x"}'`. The facts match `settings-baseline`: each bad field falls back on its own.
- **Dialog writes the cookie (browser).** Open `Settings`, set `Starting models` to 6, untick a provider under `Providers`, and choose `Done`. The chips update at once, and `document.cookie` contains `settings=` with `"openingModels":6` and the vendor slug. Then load that cookie with `llmg page` as above and see the same chips: that is the persistence proof.
- **Effort, Pareto, logos (browser).** Toggle each one and compare `[data-chart-frame="loaded"]` before and after: fewer points per model with `Highest only`, the dashed frontier line on or off, and logos replaced by dots. The server HTML does not change for these three.
- **Proof.** Keep `settings-baseline`, `settings-opening-6`, and `settings-hide` facts side by side.

## Gotchas

- Vendor slugs (`anthropic`, `openai`, …) are what the cookie stores, not display names. Read real slugs from `jq -r '[.entries[].vendor] | unique[]' <evidence>/snap.body`.
- Saving the defaults deletes the cookie instead of writing `{}`.
- Hiding every provider with picked models shows `No models from the providers you have on` with `Turn all providers on`, but only after hydration. Prove it in a browser.
- The browser writes cookies through the Cookie Store API, which only exists in secure contexts. On `http://127.0.0.1` it exists, but on a plain-HTTP LAN address it does not, so nothing persists there.
- Keep this cookie out of journeys for other features unless a step sets it on purpose. `effortLevels` and `hiddenProviders` change which points and chips appear.
