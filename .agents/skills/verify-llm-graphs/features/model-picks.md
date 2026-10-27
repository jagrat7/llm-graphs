# Model picks

A reader starts on a default set of models for the current benchmark, can pick their own, and keeps those picks on later visits in this browser, while a shared link's models override them for that view.

## Sub-features

- `picks-default` opens on the benchmark's default picks (9 unless the settings say otherwise).
- `picks-url` shows exactly the models listed in `models` URL params.
- `picks-persist` brings a reader's saved picks back on a bare `/` through the `picked-models` cookie.
- `picks-url-wins` lets a link's `models` override saved picks for that view.
- `picks-too-few` warns when fewer than two models are selected.
- `picks-unknown` shows an empty state with a recovery action when no pick matches.
- `picks-picker` adds and removes models through the picker popover and chips **(browser)**.
- `picks-reset` drops custom picks back to the defaults **(browser)**.

## How to get to it (user POV)

- Open `/` with no picks: the `Models N` chips row shows the defaults.
- Open a link carrying `models=<id>&models=<id>`.
- Choose `Models N` or `Search models` (or press `/`), then check or uncheck models in the popover.
- Choose the `×` on a chip. Visible chips' buttons have no accessible name; those in the `Show N more selected models` popover are named `Remove <model name>`.
- Come back later in the same browser: picks come from the `picked-models` cookie.

## Driving it with llmg

Preconditions:

- Doctor passes and lists `deepswe` among sources with data (the default Y axis is DeepSWE score).
- Pick two ids from the defaults: run the default step first and map chip names to ids with `jq -r '.entries[] | "\(.id)\t\(.name)"' <evidence>/snap.body` after `llmg api /api/models/snapshot --name snap`.

- **Default picks.** Open the bare page. Run `llmg page '/' --name picks-default`. `url` is `/?x=cost&y=score`, `models.count` is 9, `models.chips` has 9 names, and `alerts` and `emptyState` are empty.
- **Pick from a link.** Open a link with two picks. Run `llmg page '/?x=cost&y=score&models=<idA>&models=<idB>' --name picks-url`. `models.count` is 2 and `models.chips` are exactly those two names.
- **Saved picks return.** Load the bare page with the cookie the app writes after picking. Run `llmg page '/' --name picks-persist --cookie 'picked-models=["<idA>","<idB>"]'`. `url` has no `models`, and `models.chips` are exactly the two names.
- **Link beats saved picks.** Run `llmg page '/?x=cost&y=score&models=<idC>&models=<idD>' --name picks-url-wins --cookie 'picked-models=["<idA>","<idB>"]'`. The chips are C and D, not A and B.
- **Too few.** Run `llmg page '/?x=cost&y=score&models=<idA>' --name picks-too-few`. `models.count` is 1 and `alerts` contains `Select at least two models to compare.`
- **Unknown pick.** Run `llmg page '/?x=cost&y=score&models=no-such-model' --name picks-unknown`. `models.count` is 0, `emptyState` is set, and `emptyActions` is `["Restore default comparison"]`.
- **Picker add, remove, persist, reset (browser).** Run `llmg browse model-picks.mjs`. It passes all five steps:
  1. A fresh browser opens on the default count with no `picked-models` cookie.
  2. Checking the first unpicked model in the `Models` dialog raises the count by one, adds `models=` to the URL, and writes every pick to the cookie.
  3. Removing the first visible chip drops the count back, and exactly one id leaves the cookie.
  4. Reloading bare `/` shows the same chips and count from the cookie alone.
  5. `Reset` deletes the cookie, drops `models=`, and restores the default chips.

  Evidence is `model-picks/NN-*.png`, `.aria.yml`, and `steps.jsonl`.
- **Proof.** Keep `picks-default`, `picks-url`, and `picks-persist` facts side by side. The cookie-only load showing the same two chips as the URL load is the persistence proof. For the browser path, keep `model-picks/steps.jsonl` with screenshots `02` (picker open) and `04` (after reload).

## Gotchas

- A single `models=<id>` redirects to the JSON form `models=%5B%22<id>%22%5D`. Both forms are valid; compare `models.chips`, not the URL.
- Picks are entry ids such as `claude-fable-5`, not display names. A pick the current benchmark lacks is kept but not shown, so a valid id can still produce `picks-unknown`.
- In server HTML, `picks-unknown` reads `No models have all selected metrics`: the server only ships the picked models' rows. After hydration the browser shows `No selected models are available`. Assert the exact title only in a browser.
- `effortLevels: "highest"` in the settings cookie can hide a picked run's lower-effort points. Keep the settings cookie out of pick journeys.
- The visible chips' remove buttons have no accessible name (an app accessibility bug), so `getByRole('button', { name: 'Remove …' })` only finds chips in the overflow popover. Use `[data-slot="combobox-chip"] [data-slot="combobox-chip-remove"]`.
- Default picks depend on live upstream data, so a different day can give different default names. Never hard-code them across runs.
