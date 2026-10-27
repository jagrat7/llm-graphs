# Share and export

A reader shares the comparison on screen as a link that keeps showing the same models and benchmarks after the defaults move on. They can also export the chart as a PNG image or the plotted data as CSV.

## Sub-features

- `share-copy-link` copies a link that pins the selected models and each axis's benchmark **(browser)**.
- `share-open-link` opens a shared link and sees the sender's comparison, whatever their own saved picks are.
- `share-copy-image` copies the chart as a PNG to the clipboard where the browser allows it **(browser)**.
- `share-download-image` saves `llm-graphs-<metric>-vs-<metric>.png` **(browser)**.
- `share-download-csv` saves `llm-graphs-<metric>-vs-<metric>.csv` with the plotted rows **(browser)**.

## How to get to it (user POV)

- Choose `Share` beside the chart's Pareto toggle. The menu offers `Copy link`, `Copy image` (only where the clipboard accepts images), `Download image` (PNG), and `Download data` (CSV).
- The `Share` button's label changes to `Link copied`, `Image copied`, `Image saved`, or `CSV saved`, or to a `Couldn't …` message on failure. A polite live region announces the same text.
- Open a shared URL.

## Driving it with llmg

Preconditions:

- Doctor passes and `deepswe` has data.
- Read two entry ids from the snapshot, as in [model picks](./model-picks.md).

- **Open a shared link.** Shared links pin every source except cost and duration, and carry `models` as a JSON array. Run `llmg page '/?x=cost&y=score&ySource=deepswe&models=%5B%22<idA>%22%2C%22<idB>%22%5D' --name share-open`. `models.chips` are exactly A and B, and `axes.y.source` is `deepswe`.
- **Link beats the recipient's picks.** Run the same path with `--name share-open-other --cookie 'picked-models=["<idC>"]'`. The chips are still A and B.
- **Copy link (browser).** Pick two models, open `Share`, and choose `Copy link`. The button reads `Link copied`. The clipboard text is the page URL plus `ySource` and a `models` array. Feed that path to `llmg page` and compare it with `share-open`.
- **Download image and data (browser).** Choose `Download image`, then `Download data`. The button reads `Image saved` and then `CSV saved`. Files named `llm-graphs-…-vs-….png` and `.csv` land in the download directory. The CSV starts with a UTF-8 byte-order mark and has one row per plotted point. Copy both into the run's evidence directory.
- **Proof.** Keep the `share-open` and `share-open-other` facts. For browser steps, keep the clipboard text and the downloaded files next to them.

## Gotchas

- The `Share` menu lives inside the drawn chart, which the server never renders. Nothing in this feature except opening a link can be checked over HTTP.
- `Copy image` is missing in browsers without `ClipboardItem`. Its absence there is correct, not a bug.
- Clipboard reads in automation need clipboard permission granted to the page. Without it, `Copy link` reports `Couldn't copy link`.
- CSV cells that start with `=`, `+`, `-`, `@`, a tab, or a carriage return are prefixed with `'`, so spreadsheets don't run them as formulas. A model name starting with `-` shows up quoted, and that is intended.
