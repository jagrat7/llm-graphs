# Review log

Three reviewers per round, run in parallel on the rendered artifacts only (mp4, contact sheets,
1080p frames, seam sheets, motion strips, ffprobe and loudness output, bar grid, design docs and
animation guidelines). Pass bar: every part ≥ 8.5. The author capped the loop at 2 rounds.

## Round 1 — light master, 20 bars (40.67 s)

QA gates before review: 0 glitch candidates, 0 dropouts, max 1 flash/s (WCAG 2.3.1 pass),
−14.9 LUFS integrated, true peak −2.3 dBFS, LRA 1.8 LU, first/last frame mean diff 0.0008,
ffprobe h264 yuv420p 1920×1080, bt709/bt709/bt709, range tv.

| Part | Score | Blocking |
|---|---|---|
| A — Story & copy | 7.0 | none (model-set mismatch flagged as "should land before release") |
| B — Motion & sound | 6.6 | run-line streaks across the plot during the three source switches |
| C — Visual craft | 6.8 | cube shot breaches the 96 px bottom margin; URL illegible at 360 px |

Note: reviewer A ran before an accidental interruption; B and C were re-run on the same render.

### Top fixes asked for

- A: (1) make the collapse carry the data (Astra's row should become its point; no empty-grid
  hold); (2) the reasoning/readout lines and tooltip are on screen too briefly; (3) make the
  opening name what hurts (units/layouts) and make the chart's model set match the sheets
  (Terminal-Bench #1 Claude Opus 5.5 vanishes on the chart).
- B: (1) stop the outgoing run lines streaking during switches; switch length to land on a beat;
  (2) SFX: inaudible cues, a loud off-beat out-of-key stack thump, seal off-beat/out of key;
  (3) every headline enters the same way; the cube's linear orbit starts and stops dead.
- C: (1) chart type below the 36–40 px floor, label collisions, URL too small, punch-in framing;
  (2) cube framing (45 px bottom margin, 378 px unused on the right); (3) tooltip covers the
  "max" label it explains.

### Fixes applied for round 2

- Story (A1, C): GPT-6 Astra's DeepSWE row ("GPT-6 Astra 74.1% $4.43") now lifts off its sheet
  during the collapse and lands as the model's label on its xhigh point; sheet content holds until
  the sheets are nearly stacked (no blank sheets); the last sheet squares on the bar-5 downbeat.
- Pacing (A2, C3): the reasoning and source lines merged into one line across bars 12–14
  ("Each reasoning level is its own point, with its source."); the readout now shows from bar 12
  beat 3 to bar 14 (3.5 s) and hangs below its point, clear of the "max" label.
- Copy (A3): "Ten sites. Ten layouts. Ten different units."; "So I put them all on one chart.";
  "Score against task cost, on DeepSWE"; "Nothing is both cheaper and better than the dashed
  line." Sheets no longer show computed ranks except a marked gap ("⋯ #32") where the focus row
  sits further down a board.
- Model set (A3): Claude Opus 5.5 added to the picks, so Terminal-Bench's leader (64.8%) appears
  on the Terminal-Bench and ARC charts and is absent on DeepSWE, which has no result for it.
- Switches (B1, blocking): outgoing run lines clear in the first 30% of a switch, incoming lines
  draw in the last 30%; points unique to one benchmark leave/arrive in those thirds; lines clip to
  the plot exactly. Each switch lasts two beats (31 f, soft in-out) and settles on beat 3. The
  focus label's level text crossfades instead of swapping.
- SFX (B2): stack thump retuned to G#2, −6 dB, moved onto the bar-5 downbeat; seal retuned to
  C#3 and landed on bar 18 beat 3 (seal now leads the end card); "sheets gather" +10 dB; 21
  inaudible key ticks replaced by 5 audible ones on the URL's segments; points arpeggio on
  sixteenth notes; frontier pen draw 46 f with level following draw speed; 200 ms music fade-in.
- Motion (B3): lines that name a capability enter with a left-to-right wipe; story lines keep the
  short rise. Punch-out and cube turn are one camera move over a full bar; the orbit is one eased
  move (yaw −0.6 → −1.0 rad) instead of a linear drift. Run lines draw through points as they land.
- Type and framing (C1, C2, blocking): chart labels 32→42 px, levels 23→30 px, ticks 25→32 px,
  axis titles 30→36 px, URL 31→40 px; DeepSWE y-domain 14–86% so labels stay inside the plot;
  Grok and Fable labels dropped from the 2D view (collisions); label emphasis keyed on the labelled
  point. Cube fit 0.8→0.72, shifted right and up; bottom ink now ends above y 984. Plot height
  676→660 so the x-axis title clears the bottom margin. Sheets moved inside the safe area and lost
  their shadows (Flat Pad rule). Pad rulings lighter behind the end card.
- Dark master (author's request): same timeline rendered with a theme switch (`LaunchDark`,
  src/theme.ts DARK): black sheet 0.13, raised 0.17, white ink 0.92, white pen 0.96, grey ink
  0.68, rulings 0.32; dark vendor lightness/chroma; sheet accents grey and benchmark image marks
  in greyscale, so nothing is blue or green except vendor colours (AutomationBench's orange kept).
- QA after fixes: both masters 0 glitches, 0 dropouts, max 1 flash/s, −15.0 LUFS, true peak
  −1.5 dBFS, first/last frame diff ≤ 0.0007, BT.709 limited range.

## Round 2 — light and dark masters, 20 bars (40.67 s)

QA gates before review (both masters): 0 glitch candidates, 0 dropouts, max 1 flash/s,
−15.0 LUFS integrated, true peak −1.5 dBFS, LRA 1.5 LU, first/last frame diff 0.0007 (light) and
0.0004 (dark), BT.709 limited range.

| Part | Score | Blocking |
|---|---|---|
| A — Story & copy | 6.8 | frontier copy false against the full DeepSWE board (DeepSeek V4 Pro, GLM-5.3-Flash are cheaper and better than five frontier points but were not in the picked set) |
| B — Motion & sound | 7.2 | focus label jumps 18 px at the bar-5 handoff; edge tick labels ("0%", "100%") pop on/off in one frame; "sheets gather" is a whoosh |
| C — Visual craft, light | 7.4 | cube shot: cost-axis title through tick labels, "20%" over a mark, bottom margin 73 px |
| C — Visual craft, dark | 6.6 | same cube collisions; hunt highlight near-invisible at 360 px |

Pass bar (8.5) not met in any part. The author capped the loop at 2 rounds, so round-2 fixes
below were applied and the result shipped without a third review; the scores above are the last
measured ones and describe the render before these fixes.

### Fixes applied after round 2 (shipped, not re-reviewed)

- A (blocking): frontier line now scoped to what is plotted: "Nothing here beats the dashed line
  on both cost and score." (true for the picked set; the full DeepSWE board has cheaper-and-better
  models, which the README now notes). Opening: "Ten leaderboards. Ten tables. No common scale."
  "So I put them all in one place." Comma dropped from "Score against task cost on DeepSWE".
- B (blocking): the focus label is placed from its point's resting position, so the handoff from
  the lifted row at bar 5 no longer jumps; tick labels fade as a moving domain carries them to
  the plot edge (no one-frame pops). The "sheets gather" swell is gone: ten 60 ms paper-contact
  grains, one per sheet as it lands. Switch slides and pen line +6 dB, opening slide +4 dB, seal
  −3 dB, pen ticks more click than ring.
- B3: the close is on the bar line: the orbit ends at bar 18, the chart clears into the seal,
  which lands with its stamp on the bar-18 downbeat.
- C (blocking): cube fit 0.68 and moved right/down; cost-axis title offset along the edge normal
  clear of its ticks; y tick labels further from the box; bottom ink and the URL both clear.
  ARC-AGI-2 domain 0–115% so the focus label sits inside the plot, under the headline.
- C dark (blocking): the hunt row on the dark pad takes a lighter grey plus a 4 px white pen rule
  (the pen rule in light too); the flipping benchmark name is underlined in the pen, so it reads
  on the dark pad where pen and ink are close; AutomationBench's orange accent dropped in dark.
- C: level labels 30→34 px, tooltip labels 30→34 px, "Score (%)" inside the left margin, chart
  rulings clipped below the headline band, end-card URL in the pen (it is the link), wordmark
  spacing scaled from the app's 15 px TokenWordmark (gap 9, padding 9, rule 26 px at 132 px).
- Final QA (both masters): 0 glitch candidates, 0 dropouts, 0 near-uniform holds, max 1 flash/s,
  −14.9 LUFS integrated, true peak −2.3 dBFS, LRA 1.8 LU, first/last frame diff 0.0006,
  h264 yuv420p 1920×1080 30 fps, bt709 primaries/transfer/matrix, limited range.

### Not addressed (known, still open)

- A2: the product's cross-source chart (one benchmark per axis, e.g. Arena rating vs DeepSWE
  score) is not shown; the switch beat shows one benchmark at a time. Five feature beats remain
  (one over the 3–4 target).
- A: the charts use the app's opening cast plus Claude Opus 5.5; GPT-6.1 Sol and others on the
  sheets are not on the charts.
- B: the audio does not loop (the music fades out over bars 18–19 and restarts on the intro); SFX
  are mono; text steps by whole pixels during the slow orbit; headline exits are all 8-frame fades.
- C: effort labels are lowercase where the app uses small caps; tick labels stay at 32 px; Gemini's
  hue (251) follows the snapshot, while the older app screenshot shows indigo (~280).

## Final scores (last measured)

| Part | Round 1 | Round 2 |
|---|---|---|
| A — Story & copy | 7.0 | 6.8 |
| B — Motion & sound | 6.6 | 7.2 |
| C — Visual craft, light | 6.8 | 7.4 |
| C — Visual craft, dark | — | 6.6 |

No part reached 8.5. The shipped masters include the post-round-2 fixes above, which were not
re-reviewed under the 2-round cap.

## After review: the share beat (author's request)

Bars 16-18 no longer type the chart's link. They show the app's share menu instead: the cube
eases right, the menu opens under its trigger, the highlight moves from "Copy link" to
"Download image", and the trigger reports "Image saved". The URL key ticks became four soft
ticks on the menu's moves. This edit was not reviewed by the reviewer agents. QA gates pass on
both masters: no dropouts, at most 1 flash a second, -14.9 LUFS, -2.3 dBTP, last frame matches
the first.

## After review: the shared image (author's request)

The share beat now ends on the real thing: after "Image saved", the PNG that the app's "Download
image" exported for the 2D DeepSWE chart lands where the cube was, on graph paper, and holds for
about 3 s. The film grew one bar (20 to 21, 42.7 s) to give it that time; the end card moved to
bar 19. Not reviewed by the reviewer agents. QA gates pass on both masters: no dropouts, at most
1 flash a second, -14.8 LUFS, -2.3 dBTP, last frame matches the first.
