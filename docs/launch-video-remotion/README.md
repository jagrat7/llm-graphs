# LLM Graphs launch video

A 42.7 s launch film for [LLM Graphs](https://llm-graphs.jr7.dev), built in
[Remotion](https://www.remotion.dev/) with one [remocn](https://remocn.dev) component. One sheet
of graph paper carries the whole film: ten real leaderboards land on it, fold into one chart, the
chart switches benchmarks, draws its Pareto frontier, punches in on one model's reasoning levels
and source, turns into a cube, opens its share menu, saves the chart as an image, and closes on the wordmark. The last frame matches
the first, so it loops. The published copies are `docs/launch.mp4` and `docs/launch-dark.mp4`;
everything in `out/` is a local build product and is not committed.

| Output | File |
|---|---|
| Light master (1920×1080, H.264 yuv420p, BT.709 limited range, AAC 48 kHz) | `out/launch.mp4` |
| Dark master, same timeline on the dark pad | `out/launch-dark.mp4` |
| Contact sheets, one frame a second | `out/contact-sheet.png`, `out/contact-sheet-dark.png` |
| Critique rounds, scores and fixes | `review_log.md` |

## Re-render from scratch

Needs bun (or npm), node, ffmpeg/ffprobe, jq, and Python 3 with `librosa numpy soundfile scipy pillow`.

```bash
cd launch-video-remotion
bun install
python3 -m venv /tmp/lv-venv && /tmp/lv-venv/bin/pip install librosa numpy soundfile scipy pillow
PY=/tmp/lv-venv/bin/python scripts/build.sh          # data -> both renders -> soundtrack -> -15 LUFS -> mux
/tmp/lv-venv/bin/python -I scripts/qa/qa.py          # light QA: out/qa/, out/contact-sheet.png
/tmp/lv-venv/bin/python -I scripts/qa/qa.py --dark   # dark QA: out/qa-dark/, out/contact-sheet-dark.png
/tmp/lv-venv/bin/python -I scripts/qa/artifacts.py final   # out/qa/artifacts.md, the reviewers' index
bunx remotion studio src/index.ts                    # preview; compositions Launch and LaunchDark
```

`scripts/build.sh` runs `scripts/derive-data.mjs`, downloads the music if it is missing
(`scripts/audio/fetch-music.sh`), measures the beat grid if `data/beat-grid.json` is missing
(`scripts/audio/analyze.py`), renders both compositions with `--color-space bt709`, builds the
soundtrack (`scripts/audio/mix.py`), normalises it in two loudnorm passes to −15 LUFS / −1.5 dBTP,
and muxes it onto both pictures without re-encoding them.

## How it is built

- `src/theme.ts`: the Graph Pad tokens from `docs/DESIGN.md` for both themes, vendor colour
  rules from `src/ui/styles.css`, the bar grid (`at(bar, beats)`) and the easing curves from Emil
  Kowalski's guidelines (`0.23, 1, 0.32, 1` out; `0.77, 0, 0.175, 1` and a softer cubic in-out).
- `src/Scraps.tsx`: the ten leaderboard sheets, the hunt for GPT-6 Astra across six of them, and
  the collapse into one sheet; Astra's DeepSWE row lifts off and becomes its label on the chart.
- `src/Chart.tsx`: the chart, drawn in the app's style (rulings in fours, logo marks in vendor
  colour, dashed frontier, run lines per evaluation configuration), with animated domains for
  benchmark switches and a projection where the flat plot is the cube at zero depth.
- `src/Headline.tsx`, `src/Tooltip.tsx`, `src/EndCard.tsx`, `src/Pad.tsx`.
- `src/ShareMenu.tsx`: the chart's share menu (`src/ui/components/chart-share-menu.tsx`) at three
  times its CSS size: it opens, the highlight moves from "Copy link" to "Download image", and the
  trigger reports "Image saved"; then the PNG that the app's "Download image" really saved lands
  where the cube was. `public/share/score-vs-cost-{light,dark}.png` are those files, unedited:
  the default 2D chart (`/?x=cost&y=score&log=cost`, DeepSWE, the nine default picks) exported
  from a local run of the app on 2026-11-01 by `scripts/capture/share-image.mjs`.
- remocn: `rolodex-flip` (the benchmark name in the headline; its easing changed to the film's
  curves).
- Fonts are the app's own: Instrument Sans, Martian Mono and Space Mono (wordmark only), copied
  from the app's `@fontsource` packages into `public/fonts/` (SIL Open Font License).

## Data

Every number, model and benchmark on screen comes from `data/snapshot-2026-11-01.json`: the app's
`/api/models/snapshot` response, fetched on **2026-11-01 (08:51 UTC)** from an isolated dev server
started with the repo's verify skill (`.claude/skills/verify-llm-graphs`, `llmg up`). Artificial
Analysis had no data in that run (no API key in this worktree), so it is not in the film.
`scripts/derive-data.mjs` turns it into `src/data/derived.json`: the app's nine opening models plus
Claude Opus 5.5 (Terminal-Bench's leader, absent on DeepSWE), their points on DeepSWE,
Terminal-Bench 4.0 and ARC-AGI-2, the DeepSWE Pareto frontier computed with the app's algorithm
(`src/ui/lib/pareto.ts`), and each sheet's top rows. Benchmark marks are read from the app's
`src/ui/components/source-logo.tsx` and `public/benchmarks/`.

The frontier is over the plotted models only, as in the app; the copy says "Nothing here beats
the dashed line". On the full DeepSWE board some unpicked models (DeepSeek V4 Pro, GLM-5.3-Flash)
are cheaper and better than parts of it.

## Music and sound

- Music: **"Serene View" by Arulo**, [Mixkit](https://mixkit.co/free-stock-music/mood/calm/)
  (`https://assets.mixkit.co/music/443/443.mp3`), under the
  [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree): free for commercial and
  personal projects, no attribution required. It is downloaded by `scripts/audio/fetch-music.sh`
  and kept out of git (`.gitignore`) rather than redistributed.
  - Measured with librosa (`data/beat-grid.json`): 118.0 BPM, 4/4, one bar = 2.0338 s.
  - Video frame 0 is track time 8.149 s, a downbeat. The bass enters at track 16.28 s, which is
    the film's bar 4, where the sheets fold into one.
  - Every scene change starts on a bar line; in-shot accents land on beats.
- Sound effects: all synthesised in `scripts/audio/mix.py` (no third-party samples), placed on the
  animation's own frames (cue list in `out/cues.json`):
  - pen ticks and paper contacts
  - a paper tap and a stamp
  - a pen line for the frontier
  - Pitched ones use C#, D#, F, G# and A#. Those notes fit both C# major (librosa's estimate) and
    G# major, which a chroma read of the mix leans towards.
- Mix: −14.9 LUFS integrated, true peak −2.3 dBFS, LRA 1.8 LU (ffmpeg ebur128 on the final mp4).

## QA gates (both masters, final render)

`scripts/qa/qa.py` checks, for each master:

| Gate | Result |
|---|---|
| Frame-to-frame glitch scan | 0 |
| Blank-frame dropouts | 0 |
| WCAG 2.3.1 general-flash count, per 320×180 region | max 1/s |
| Seam sheets for every bar-line transition and the loop | written |
| Contact sheets (640 px and 360 px) and 1080p frames | written |
| Loudness | see "Mix" above |
| First vs last frame | mean difference 0.0006 |

## Repo tooling

The root `bun run lint`, `bun run typecheck` and `bun run fmt:check` ignore this folder (one line
each in `.oxlintrc.json`, `.oxfmtrc.json`, `tsconfig.json`); it type-checks on its own with
`bunx tsc --noEmit`.
