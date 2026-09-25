# How DeepSWE and Artificial Analysis encode model identity and reasoning effort

Research for [#6](https://github.com/jagrat7/llm-graphs/issues/6). Data pulled 2026-09-25:

- DeepSWE `leaderboard-live.json` v1.1, `generated_at` 2026-09-22: 70 rows, 28 models.
- Artificial Analysis (AA) `/api/v2/language/models/free`, 4 pages: 673 models from 58 creators.
- AA history: 122 daily snapshots of the same data, 2026-04-10 to 2026-09-25, from
  [antoniovho/artificial-analysis-leaderboards](https://github.com/antoniovho/artificial-analysis-leaderboards).
  There is a gap from 2026-07-11 to 2026-08-26.

Reproduce with `python3 docs/research/source_conventions.py --env /path/to/.env [--history DIR]`.
The script uses only the Python standard library. It caches payloads outside the repo and prints every
table below, plus the full per-row tables. To fill `--history DIR`, save each
`https://raw.githubusercontent.com/antoniovho/artificial-analysis-leaderboards/main/data/<date>/llms.json`
as `DIR/<date>.json` (about 300 MB for all dates).

## Answer

**DeepSWE** states effort explicitly. `reasoning_effort` is one of `low`, `medium`, `high`, `xhigh`,
`max`, or `null`. The `model` field is the vendor's API id with dots turned into hyphens, and it carries
no snapshot date. All 70 rows use a single harness (`mini-swe-agent`). `config` is always
`<harness>_<model>_<effort or "default">`.

**AA** keeps effort in two places:

- A slug suffix (`-minimal`, `-low`, `-medium`, `-high`, `-xhigh`) for the secondary configs.
- The display name's parenthetical, e.g. `(high)`, `(Adaptive Reasoning, Max Effort)`, `(Non-reasoning)`.
  This is the only place that says what the bare slug means.

AA never uses `-max` as an effort suffix. The bare slug is AA's headline config, and its meaning changes
by vendor and by model generation:

| Generation | What the bare slug usually is |
|---|---|
| 2025 families | Non-reasoning (43 of 62 families) |
| 2026-H2 families | Top effort (13 `max`, 2 `xhigh`, 3 `high`) |

So the bare slug's effort is not consistent within a vendor. Only the name tells you. AA's `id` is the
stable key: in 5 months, 6 bare slugs were repointed to newer snapshots. The old record usually kept its
id under a new, often dated, slug.

**Under today's join** (`src/ui/lib/use-models.ts`), 12 of the 70 DeepSWE (model, effort) rows join
wrongly or not at all:

- 9 fall back to a `max` bare slug with the wrong effort.
- 1 lands on a non-reasoning config.
- 1 lands on a newer snapshot, probably the wrong one.
- 1 finds nothing (`qwen3-8-max`).

Two more rows can't be checked because the AA name carries no effort. 10 of the 56 correct rows are only
correct because the default-fallback happened to hit the right config.

## 1. Pattern catalogue

### 1.1 AA slug suffixes

Suffixes are peeled from the end of the slug. An `-<level>` suffix counts as effort only when the name
states that level. Otherwise it is part of the model name (`qwen3-8-max`, `magistral-medium`).

| Suffix category | Slugs | Values (count) |
|---|---|---|
| effort | 85 | `-low` 27, `-medium` 27, `-high` 15, `-xhigh` 12, `-minimal` 4, **`-max` 0** |
| reasoning on | 77 | `-reasoning` 61, `-thinking` 14, `-adaptive` 2 |
| date | 61 | `-NNNN` (MMDD or YYMM) 37, `-NN-NNNN` 8, `-NN-NN` 7, `-may-NNNN` 2, `-dec-NNNN` 2, `-NNNN-NN-NN` 2, `-sep-NNNN` 1, `-june-NN` 1, `-decNN` 1 |
| non-reasoning | 49 | `-non-reasoning` 48, `-non-reasoning-low-effort` 1 |
| instruct (Qwen-style non-reasoning) | 48 | `-instruct` 46, `-chat` 2 |
| preview | 22 | `-preview` 18, `-exp` 2, `-experimental` 2 |
| version pin | 1 | `-001` |

Suffix combinations (outermost suffix first):

| Signature | Slugs | Examples |
|---|---|---|
| none (bare) | 373 | `gemini-3-5-flash`, `gpt-6-astra`, `kimi-k2-7-code` |
| effort | 77 | `gpt-6-astra-low`, `gemini-3-5-flash-minimal` |
| reasoning | 51 | `claude-3-7-sonnet-thinking`, `sonar-reasoning` |
| non-reasoning | 46 | `gpt-5-6-sol-non-reasoning`, `gemma-4-12b-non-reasoning` |
| date | 41 | `grok-4-20-0309`, `qwen3-8-max-0803`, `deepseek-v4-pro-0424` |
| instruct | 36 | `qwen3-coder-480b-a35b-instruct` |
| preview | 11 | `o1-preview`, `solar-pro-2-preview` |
| reasoning + instruct | 8 | `qwen3-14b-instruct-reasoning` |
| effort + reasoning | 6 | `nova-2-0-lite-reasoning-low` |
| date + preview | 4 | `gemini-2-5-flash-preview-09-2025` |
| non-reasoning + date | 3 | `deepseek-v4-pro-0424-non-reasoning` |
| effort + date | 2 | `deepseek-v4-pro-0424-high` |
| date + reasoning | 2 | `deepseek-v3-2-reasoning-0925`, `gemini-2-5-flash-reasoning-04-2025` |
| reasoning + date | 1 | `qwen3-30b-a3b-2507-reasoning` |
| 9 other combinations | 1-2 each | `gemini-2-0-flash-thinking-exp-0121`, `gemini-2-5-flash-preview-09-2025-reasoning`, `qwen3-235b-a22b-instruct-2507-reasoning`, `gemini-2-0-flash-lite-001` |

Suffix order is not consistent:

- `-reasoning-04-2025` vs `-09-2025-reasoning`
- `-instruct-2507` vs `-2507-instruct`
- the date goes before the effort in `-0424-high`

**The app's `-(low|medium|high|xhigh|max)$` regex, checked against all 673 slugs:**

| Outcome | Slugs | Examples |
|---|---|---|
| no suffix, labelled `default` | 580 | the bare slug's real effort is only in the name (see 1.2) |
| stripped, and the name agrees | 81 | `gpt-6-astra-xhigh` -> `gpt-6-astra:xhigh` |
| **stripped, but it is part of the model name** | 8 | `qwen3-8-max` -> `qwen3-8:max`, `qwen3-6-max`, `qwen3-7-max`, `qwen3-max`, `qwen-2-5-max`, `mistral-medium`, `magistral-medium`, `devstral-medium` |
| **effort suffix missed** | 4 | `gemini-3-5-flash-minimal`, `gpt-5-minimal`, `gpt-5-mini-minimal`, `gpt-5-nano-minimal` |

No two AA slugs collide on the app's `model:effort` key today.

### 1.2 AA name parentheticals

- 282 names have no parenthetical, 385 have one, and 6 have two (e.g. `Gemini 2.5 Flash Preview (Sep '25) (Reasoning)`).
- Each parenthetical is split on commas into tokens.

| Token class | Tokens | Values | Denotes effort? | Used by |
|---|---|---|---|---|
| `<level>` | 117 | `high` 34, `low` 23, `medium` 23, `xhigh` 22, `max` 11, `minimal` 4 | yes, level | OpenAI 66, Google 12, xAI 11, Amazon 7, Meta 5, + 7 others |
| `<Level> Effort` | 38 | `Max` 15, `High` 10, `Low` 5, `Medium` 4, `Xhigh` 4 | yes, level | Anthropic 30, DeepSeek 8 |
| `Non-reasoning` | 99 | also `Non-Reasoning` x3 | yes, reasoning off | 18 vendors |
| `Reasoning` | 95 | | yes, reasoning on, no level | 17 vendors |
| `Adaptive Reasoning` | 25 | | yes, Anthropic's adaptive thinking | Anthropic only |
| `<X> Fallback` | 11 | `Default Fallback` 10, `Opus 4.8 Fallback` 1 | **no**: Anthropic routing qualifier (Fable 5, Fable 5.1, Opus 5.5) | Anthropic only |
| date | 45 | `Dec '24`, `Sep '25`, `May' 25`, `0902`, `1210`, `0613`, `May 2026`, `June 2026`, `Feb 2026`, `March 2025` | no, snapshot | |
| `Preview` | 6 | | no, maturity | |
| `based on <model>` | 5 | `based on gpt-oss-120b` | no, lineage | |
| other | 9 | `ChatGPT` 2, `chatgpt-4o-latest`, `Vision` 2, `experimental`, `Beta`, `32B`, `V1` | no | |

Parenthetical shapes:

| Shape | Names | Example |
|---|---|---|
| none | 282 | `Kimi K2.7 Code`, `GLM 5.3 Flash`, `Gemini 3.1 Pro Preview` |
| `(<level>)` | 115 | `Gemini 3.8 Flash (high)`, `GPT-6 Astra (max)` |
| `(Non-reasoning)` | 91 | `GLM-5.2 (Non-reasoning)` |
| `(Reasoning)` | 83 | `Qwen3.5 27B (Reasoning)` |
| `(<date>)` | 40 | `Claude 3.5 Sonnet (Oct '24)`, `Qwen3.8 Max (0902)` |
| `(Adaptive Reasoning, <Level> Effort)` | 14 | `Claude Opus 5 (Adaptive Reasoning, Xhigh Effort)` |
| `(Adaptive Reasoning, <Level> Effort, <X> Fallback)` | 11 | `Claude Fable 5.1 (Adaptive Reasoning, Low Effort, Default Fallback)` |
| `(Reasoning, <Level> Effort)` | 8 | `DeepSeek V4 Pro 0424 (Reasoning, High Effort)` |
| `(Non-reasoning, <Level> Effort)` | 5 | `Claude Sonnet 4.6 (Non-reasoning, High Effort)` |
| 14 rarer shapes | 1-4 each | `(Preview)`, `(<level>, based on <model>)`, `(<date>) (Reasoning)` |

Markers outside the parentheses:

| Marker | Names | Examples |
|---|---|---|
| `Flash` | 58 | |
| `Instruct` | 51 | |
| 4-digit stamp | 27 | `DeepSeek V4 Pro 0813`, `Grok 4.20 0309 v2`, `Step 3.5 Flash 2603`, `Qwen3 235B A22B 2507 Instruct` |
| `Preview` | 25 | |
| `Code`/`Coder`/`Codex` | 18 | |
| `Thinking`/`Think`/`Thinker` | 17 | |
| `Max` as a tier name | 9 | |
| inline `Reasoning` | 7 | `Sonar Reasoning` |

**Effort as stated by the name, all 673 models:**

| Stated effort | Models |
|---|---|
| unlabelled | 314 |
| reasoning, no level | 110 |
| non-reasoning | 94 |
| high | 40 |
| low | 27 |
| medium | 27 |
| xhigh | 26 |
| max | 26 |
| minimal | 4 |
| non-reasoning + High Effort | 4 |
| non-reasoning + Low Effort | 1 |

Of the 26 `max` models, 24 have no effort or reasoning suffix; two of those are dated snapshots
(`deepseek-v4-pro-0424`, `deepseek-v4-flash-0420`). The other two are Anthropic 4.6 `-adaptive` slugs.
`max` never appears in a slug.

Formatting inconsistencies:

- `Non-Reasoning` with a capital R (3), e.g. `GPT-5.4 mini (Non-Reasoning)`.
- `Xhigh Effort` in title case (4) vs `(xhigh)`.
- `May' 25` / `Mar' 25` with the apostrophe after the month.
- Dots in 7 slugs (`qwen3-0.6b-instruct`, `glm-4.5`) and one uppercase slug (`QwQ-32B-Preview`).
- Old version numbers run together (`claude-35-sonnet`, `claude-21`, `gpt-35-turbo`).
- Word order flips between generations (`claude-4-5-sonnet` vs `claude-sonnet-4-6`).

## 2. What the bare slug means, per vendor

A "family" is the set of slugs that share a stem once the effort and reasoning suffixes are removed. Date
and preview suffixes stay in the stem. 120 families have 2 or more members.

Where the bare slug sits inside its family:

| Position | Families | Examples |
|---|---|---|
| highest config in the family | 62 | `gpt-6-astra`, `claude-opus-5`, `gemini-3-8-flash`, `qwen3-5-27b`, `glm-5-3` |
| non-reasoning, with reasoning siblings | 45 | `qwen3-32b-instruct`, `gemini-2-5-flash`, `claude-4-5-sonnet`, `claude-sonnet-4-6` |
| no effort label | 12 | `kimi-k2-6`, `qwen3-max`, `o3-mini`, `exaone-4-5-33b` |
| one level below a higher sibling | 1 | `grok-4-6` is `(high)` but `grok-4-6-xhigh` exists |

Bare-slug meaning by release half-year, all vendors:

| Release | non-reasoning | reasoning (no level) | unlabelled | high | xhigh | max | NR + High Effort |
|---|---|---|---|---|---|---|---|
| 2025-H1 | 15 | 0 | 3 | 0 | 0 | 0 | 0 |
| 2025-H2 | 28 | 2 | 5 | 8 | 1 | 0 | 0 |
| 2026-H1 | 0 | 23 | 3 | 2 | 4 | 5 | 2 |
| 2026-H2 | 0 | 0 | 1 | 3 | 2 | 13 | 0 |

Per vendor (vendors relevant to DeepSWE first):

| Vendor (`model_creator.name`) | Families w/ variants | Bare slug means | Consistent? |
|---|---|---|---|
| OpenAI | 18 | `max`: `gpt-5-6-{sol,terra,luna}`, `gpt-6-{astra,sol,luna}`. `xhigh`: `gpt-5-2`, `gpt-5-4`, `gpt-5-4-mini`/`nano`, `gpt-5-5`. `high`: `gpt-5`, `gpt-5-1`, `gpt-5-mini`/`nano`, `gpt-oss-*`. unlabelled: `o3-mini`. Single-entry models: the Codex and Pro models are `(high)` (4) or `(xhigh)` (4). | **No.** It tracks the top effort each generation shipped with (high, then xhigh, then max). |
| Anthropic | 14 | `Adaptive Reasoning, Max Effort`: `claude-opus-4-7`, `-4-8`, `-5`, `-5-5`, `claude-sonnet-5`, `claude-fable-5`, `-5-1`. `Non-reasoning, High Effort`: `claude-opus-4-6`, `claude-sonnet-4-6` (their max config is on `-adaptive`). `Non-reasoning`: every model up to 4.5 (reasoning is on `-thinking`). | **No.** It flipped with Opus 4.7 (Apr 2026). |
| Google | 14 | `(high)`: `gemini-3-pro`, `gemini-3-5`/`3-6`/`3-7`/`3-8-flash`. Unlabelled: `gemini-3-1-pro-preview`, `gemini-3-1-flash-lite-preview`. `Non-reasoning`: `gemini-2-5-*`, `gemini-3-flash`. `Reasoning`: `gemma-4-*`. | **No.** Current Gemini is `high`, the top of Gemini's scale. |
| SpaceXAI (xAI) | 8 | `(high)`: `grok-4-3`, `grok-4-5`, `grok-4-6` (which has an `-xhigh` sibling). `(xhigh)`: `grok-4-7`. `Reasoning`: `grok-4-20`. `Non-reasoning`: the `*-fast` models. | **No.** Not even within the current wave. |
| Z AI | 9 | `(max)`: `glm-5-2`, `glm-5-3`. Unlabelled: `glm-5-3-flash`. `Reasoning`: `glm-4-7`, `glm-5`, `glm-5-1`. `Non-reasoning`: `glm-4-5v`, `glm-4-6`, `glm-4-6v`. | No |
| DeepSeek | 6 | `Reasoning, Max Effort`: all V4 models (`deepseek-v4-pro`, `-flash`, the `-0424`/`-0420` snapshots, `v4-1-flash`). `Non-reasoning`: V3.x. | No, by generation |
| Kimi | 4 | `(max)`: `kimi-k3`. `Reasoning`: `kimi-k2-5`. Unlabelled: `kimi-k2`, `kimi-k2-6`, `kimi-k2-7-code`. | No |
| Meta | 1 | `(max)`: `muse-spark-1-3` (has an `-xhigh` sibling). Single-entry models: `muse-spark-1-1`, `-1-2` are `(xhigh)`, `muse-glimmer` is `(high)`. | No |
| Alibaba | 23 | `(xhigh)`: `qwen3-8-27b`. `Reasoning`: Qwen3.5/3.6 open models. `Non-reasoning`: Qwen3 2025 `-instruct`. Unlabelled: `qwen3-max`, `qwen3-6/7/8-max`, `-plus`. | No |
| Amazon | 3 | `Non-reasoning`: `nova-2-0-{lite,omni,pro}`. `-reasoning` means `(high)` and `-reasoning-{low,medium}` are the lower levels. | Yes |
| NVIDIA, Nous, Upstage | 9 | `Non-reasoning` | Yes |
| Institute of Foundation Models | 1 | `(high)`: `k2-v2` | n/a |
| LG, Xiaomi, Tencent, Mistral, OpenBMB, Perplexity | 10 | mix of `Non-reasoning`, `Reasoning`, and unlabelled | No (mixed) |

Takeaways:

- Within one release wave of one vendor, the bare slug usually means the same thing. For example, every
  GPT-5.6 and GPT-6 bare slug is `max`, and every Gemini 3.5 to 3.8 Flash is `high`. The one exception is
  `grok-4-6`.
- Across waves the meaning drifts, so it can't be inferred from the vendor.
- 314 of 673 names state no effort at all, including 302 single-entry models. The DeepSWE-relevant
  single-entry models (see section 3) are the ones that matter.

## 3. The 28 DeepSWE models against AA

Today's rules: the AA parser strips `-(low|medium|high|xhigh|max)$` and treats the bare slug as `default`.
The join looks up `model:effort`, with DeepSWE `max` mapped to AA `default`, and falls back to
`model:default`. Every DeepSWE `model` string exists verbatim as an AA slug (28 of 28), but that doesn't
mean it's the same snapshot or effort.

Row outcomes:

| Status | Rows |
|---|---|
| clean: suffix match (`-low`, `-medium`, `-high`, `-xhigh`) | 33 |
| clean: `max` mapped to a bare slug labelled `max` | 12 |
| clean, by luck: fell back to a bare slug whose label equals the DeepSWE effort (`high`/`xhigh`) | 10 |
| clean: both sides unlabelled (`kimi-k2-7-code`) | 1 |
| **wrong effort**: fell back to a bare slug labelled `max` | 9 |
| **wrong reasoning mode**: AA config is non-reasoning | 1 |
| **wrong snapshot (likely)** | 1 |
| **unmatched** | 1 |
| unverifiable: the AA name has no effort | 2 |

Per model:

| DeepSWE model | DeepSWE efforts | AA configs (bare = stated effort) | Today | Correct AA match / note |
|---|---|---|---|---|
| `gpt-6-astra` | low, medium, high, xhigh, max | bare=`max`, `-low`, `-medium`, `-high`, `-xhigh` | 5 clean | |
| `gpt-5-6-sol` | low to max (5) | bare=`max`, `-low`...`-xhigh`, `-non-reasoning` | 5 clean | |
| `gpt-5-6-terra` | low to max (5) | same shape | 5 clean | |
| `gpt-5-6-luna` | low to max (5) | same shape | 5 clean | |
| `gpt-5-5` | low, medium, high, xhigh | bare=`xhigh`, `-low`, `-medium`, `-high`, `-non-reasoning` | 4 clean (xhigh by luck) | |
| `gpt-5-4` | xhigh | bare=`xhigh`, `-low`, `-non-reasoning` | 1 clean (by luck) | |
| `claude-opus-5` | low to max (5) | bare=Max, `-low`...`-xhigh` | 5 clean | |
| `claude-sonnet-5` | low to max (5) | bare=Max, `-low`...`-xhigh`, `-non-reasoning` (NR, High) | 5 clean | |
| `claude-fable-5` | low to max (5) | bare only (Max Effort, Opus 4.8 Fallback) | 1 clean, **4 wrong** (low/medium/high/xhigh fall back to Max) | No AA counterpart for the non-max efforts. The `claude-fable-5-1-*` variants are a different model. |
| `claude-opus-4-8` | low to max (5) | bare only (Max) | 1 clean, **4 wrong** | No AA counterpart for the non-max efforts |
| `claude-sonnet-4-6` | high | bare=Non-reasoning High, `-adaptive`=Adaptive Max, `-non-reasoning-low-effort` | **1 wrong mode** | AA has no adaptive-reasoning High config. DeepSWE runs reasoning effort, so the nearest options are NR-High (today's match) or Adaptive-Max. |
| `gemini-3-8-flash` | medium, high | bare=`high`, `-low`, `-medium` | 2 clean (high by luck) | |
| `gemini-3-7-flash` | low, medium, high | bare=`high`, `-low`, `-medium` | 3 clean (high by luck) | |
| `gemini-3-6-flash` | high | bare=`high` | 1 clean (by luck) | |
| `gemini-3-5-flash` | high | bare=`high`, `-medium`, `-minimal` | 1 clean (by luck) | |
| `gemini-3-1-pro-preview` | high | bare, unlabelled (`Gemini 3.1 Pro Preview`) | unverifiable | Probably high: Gemini Pro's default, and `gemini-3-pro` is `(high)` |
| `grok-4-6` | low, medium, high, xhigh | bare=`high`, `-low`, `-medium`, `-xhigh` | 4 clean (high by luck) | |
| `grok-4-5` | high | bare=`high` | 1 clean (by luck) | |
| `glm-5-3` | max | bare=`max`, `-low` | 1 clean | |
| `glm-5-3-flash` | max | bare, unlabelled (`GLM 5.3 Flash`) | unverifiable | |
| `glm-5-2` | high, max | bare=`max`, `-non-reasoning` | 1 clean, **1 wrong** (high falls back to max) | No AA counterpart for high |
| `kimi-k3` | max | bare=`max`, `-low` | 1 clean | |
| `kimi-k2-7-code` | `null` (config `_default`) | bare, unlabelled | 1 clean (both unlabelled) | |
| `deepseek-v4-pro` | max | bare=**0813** (Reasoning, Max), `-0424` (Max), `-0424-high`, `-0424-non-reasoning` | **1 wrong snapshot (likely)** | `deepseek-v4-pro-0424` (id `bf220674`). See 4.3. |
| `deepseek-v4-flash` | max | bare=**0731** (Reasoning, Max), `-0420` family | 1 clean | DeepSWE added it on Aug 6, after the 0731 release |
| `muse-spark-1-2` | xhigh | bare=`xhigh` | 1 clean (by luck) | |
| `muse-spark-1-1` | xhigh | bare=`xhigh` | 1 clean (by luck) | |
| `qwen3-8-max` | xhigh | bare=**0902** (unlabelled), `-0803` (unlabelled) | **unmatched** | The parser turns AA `qwen3-8-max` into `qwen3-8:max`, so the lookup misses. The right snapshot is `qwen3-8-max-0803` (id `5e5b4ce7`; DeepSWE added it Aug 4). AA doesn't label its effort. |

About the `max` to `default` mapping: it gives the right effort for 13 of the 14 DeepSWE `max` rows,
because each of those AA bare slugs says `max`. The 14th, `glm-5-3-flash`, is unlabelled.
`deepseek-v4-pro` gets the right effort but, likely, the wrong snapshot. The mapping only works because
no DeepSWE `max` row belongs to a family whose bare slug is `high`, like `grok-4-6` or the Gemini models.

About the default fallback: 21 rows used it. 10 got the right effort, 10 got the wrong effort or mode
(9 wrong effort, 1 wrong mode), and 1 can't be checked. Each outcome depended only on what AA happened
to put on the bare slug.

## 4. Identity quirks

### 4.1 DeepSWE

- **`model`** is the vendor API id with `.` turned into `-` (`gpt-5.5` becomes `gpt-5-5`; also
  `gemini-3-1-pro-preview`). It keeps `-preview`, `-code`, `-flash`, and tier words that clash with effort
  words (`qwen3-8-max`). It has **no snapshot or date**. `deepseek-v4-pro` has been one string since v1
  (May 2026) while DeepSeek shipped 0424 and 0813.
- **`reasoning_effort`** is `null` on 1 row (`kimi-k2-7-code`); its `config` ends in `_default`. In the
  older v1 artifact (`/artifacts/v1/leaderboard-live.json`, June 2026), 12 of 29 rows were `null`,
  including `gemini-3-1-pro-preview` and `deepseek-v4-pro`. v1.1 labels those `high` and `max`.
  So `null` means "not set / provider default", and DeepSWE's labels for the same model changed between
  artifact versions.
- **`provider`** is present only on the 5 `gpt-6-astra` rows (`openai`). The same 5 rows are the only
  ones with `cost_basis`, reasoning-token, cache-token, and compute-unit fields.
- **The v1 artifact's model names differ from AA's older slugs**: `claude-haiku-4-5` vs AA
  `claude-4-5-haiku`, `gemini-3-flash-preview` vs AA `gemini-3-flash`, `grok-build-0-1` vs AA
  `grok-build-0-1-06-16`. All 28 current v1.1 models happen to match AA slugs exactly.
- **Early access**: the `gpt-6-astra` job finished 2026-09-01. AA dates GPT-6 Astra 2026-09-03, and the
  DeepSWE changelog says it was "priced at the expected launch rate card". Gemini 3.8 Flash was added
  2026-09-01, while AA dates it 2026-09-02. So a DeepSWE results date can come before AA's
  `release_date`.

### 4.2 AA

- **Dates in slugs** use at least 9 formats: `0424`, `2507`, `09-2025`, `05-06`, `05-26`, `2024-05-13`,
  `may-2024`, `june-24`, `dec28`. The same `NNNN` can be MMDD (`0424`) or YYMM (`2507`).
- **Which snapshot is dated** varies. In 30 dated/undated sibling pairs, the undated slug is the newer
  snapshot 21 times (`deepseek-v4-pro` = 0813 vs `-0424`, `qwen3-8-max` = 0902 vs `-0803`). The dated slug
  is newer 9 times (`deepseek-v3-0324`, `kimi-k2-0905`, `magistral-medium-2509`, `mimo-v2-omni-0327`).
- **Names carry their own date stamps**, separate from the slug: `DeepSeek V4 Pro 0813`,
  `Qwen3.8 Max (0902)`, `Step 3.5 Flash 2603`, `Grok 4.20 0309 v2`. A name stamp and a slug date can
  disagree: `mi-dm-k-2-5-pro-dec28` has `release_date` 2025-12-11.
- **`release_date` is often the family's launch date, not the snapshot's**:
  - `mimo-v2-0206` "(Feb 2026)" is dated 2025-12-16.
  - The Opus 5.5 effort variants are dated 09-17, but the bare slug is dated 09-22.
- **`-preview` appears inconsistently**:
  - In the slug only: `gemini-3-1-flash-lite-preview`, whose name dropped "Preview" on 2026-05-27.
  - In the name only: `gemini-3-flash` ("Preview"), `nova-2-0-pro` ("Pro Preview"),
    `qwen3-6-max` ("Max Preview"), `step-5` ("Step 5 Preview"), `hy3-non-reasoning` ("Hy3-preview").
  - In both: `gemini-3-1-pro-preview`.
- **Reasoning markers** differ by era and vendor:
  - Slugs: `-thinking` (14: Anthropic ≤4.5, Google, Alibaba, Kimi, and others), `-reasoning` (61, most
    vendors), `-adaptive` (2, Anthropic 4.6 only), `-think` (Olmo; part of the name).
  - Names: `Thinking`/`Think` in the name itself vs a `(Reasoning)` parenthetical.
- **`-code` / `-codex` / `-coder`, `-flash`, `-lite`, `-mini`, `-nano`, `-pro`, `-max`, `-plus`,
  `-turbo`, `-fast`** are identity. They are part of the model, not configs. `-max` and `-medium` collide
  with effort words (8 slugs).
- **`Fallback`** (`Opus 4.8 Fallback`, `Default Fallback`) is on Fable 5, Fable 5.1, and Opus 5.5. It
  names the model's fallback routing, not its effort.

### 4.3 Does AA's stable `id` help? Yes, with limits

AA's API reference says:

> id: Unique identifier (stable) · name: Full name (may change) · slug: URL-friendly identifier
> (infrequently changed) … we recommend using model and creator IDs as primary identifiers since they
> remain stable, while slugs and names may change over time.

The 122-snapshot history confirms this, and shows how AA versions a model.

**14 ids were re-slugged.** When a new snapshot arrives, the old record keeps its id and gains a dated
slug:

| id | old slug | new slug |
|---|---|---|
| `bf220674` | `deepseek-v4-pro` | `deepseek-v4-pro-0424` |
| `d8ddb241` | `deepseek-v4-flash` | `deepseek-v4-flash-0420` |
| `5e5b4ce7` | `qwen3-8-max` | `qwen3-8-max-0803` |

The same happened to `-high` and `-non-reasoning` siblings, and to `step-3-5-flash` (renamed
`-0202`) and `hy3` (renamed `hy3-preview`). Four IFM slugs were renamed from internal codenames
(`k2-7b-ph2` to `k2-horizon-7b`).

**6 bare slugs were repointed to a new id:**

| Slug | Old snapshot | New snapshot |
|---|---|---|
| `deepseek-v4-pro` | 0424 | 0813 (between 07-10 and 08-27) |
| `deepseek-v4-flash` | 0420 | 0731 (same window) |
| `qwen3-8-max` | 0803 | 0902 (on 2026-09-16) |
| `step-3-5-flash` | original | 2603 |
| `hy3` | preview | GA |
| `muse-spark-1-3` | `58a40aba` | `9999672c`, with the same name. The record was recreated, so ids are not immortal either. |

**24 ids changed name.** Examples:

- `claude-opus-4-6`: `(Non-reasoning, High Effort)`, then `(Non-reasoning)`, then back again, within 2026-04-19 to 04-22.
- `grok-4-3` gained `(high)` 2 weeks after launch.
- The DeepSeek V4 records gained `0424`/`0420` in their names 3 weeks after their slugs changed.
- `deepseek-v4-flash-vision` briefly showed "0731".
- `glm-5-3-flash` changed from `GLM-5.3-Flash` to `GLM 5.3 Flash`.

**6 ids disappeared**, including `gpt-6-astra-non-reasoning` (last seen 2026-09-12).

Limits:

- There is one id per (snapshot, config), not per model.
- The free API has nothing that links an id to its sibling configs or to its predecessor.
  `reasoning_model` is Pro-tier only.
- DeepSWE has no id and no snapshot at all.

So the id lets us pin a match once we've picked it, and notice when a slug gets repointed. It can't pick
the match for us.

**Evidence for `deepseek-v4-pro` being the 0424 snapshot:**

- DeepSWE's changelog added "DeepSeek v4 Pro results" on 2026-08-12. AA dates 0813 to 2026-08-13.
- DeepSWE ran `deepseek-v4-pro` in v1 in May, which could only have been 0424.
- The Aug 14 changelog cost correction refers to DeepSeek's May 22 price cut, not a new release.

Because labs do give DeepSWE early access (see 4.1), this is "likely", not certain.

## 5. DeepSWE `config` and `harness`

- `scope`: "Every DeepSWE rollout across imported Pier jobs, grouped by configuration (harness + model +
  reasoning effort)". So the schema allows several harnesses per model.
- In the live data, `harness` is `mini-swe-agent` on all 70 rows. `source` is `deep-swe` on all 70.
  `n_runs` is 4 on all 70.
- `config` is fully derived: `<harness>_<model>_<effort|default>` with `-` turned into `_`, on 70 of 70
  rows. It adds no information beyond harness, model, and effort.
- There are no duplicates. Each (model, effort) pair appears once, and so does each
  (model, effort, harness). DeepSWE never lists one model under several harnesses or configs.
- The DeepSWE blog says "Every model runs through mini-swe-agent". The GitHub README says "All
  leaderboard scores were produced with Pier running `mini-swe-agent` on Modal". Pier can also drive
  `claude-code`, `codex`, `gemini-cli`, and `opencode`, but none appear on the leaderboard.
- The site's config picker shows "Configs (57/70)", a default subset of the 70 rows. The artifact has no
  field for this.

## 6. Documented conventions

**Artificial Analysis:**

- The [API reference](https://artificialanalysis.ai/api-reference) has the id/slug/name stability
  statement quoted in 4.3.
- The [data API docs](https://artificialanalysis.ai/data-api/docs) say "We keep the wire format
  stable: fields are deprecated, not renamed", and describe the `/free` list endpoint and pagination.
- Neither documents how reasoning variants, effort levels, or snapshot dates are encoded in slugs or
  names. The docs' own example shows the name drifting: `gpt-oss-20B (high)` in the docs vs
  `gpt-oss-20b (high)` live, same id `36f73aaf`.

**DeepSWE:**

- The [blog](https://deepswe.datacurve.ai/blog/deepswe) says "We tested most models at their highest
  reasoning effort" and describes a fixed mini-swe-agent harness.
- Nothing documents how `reasoning_effort` maps to provider parameters (OpenAI `reasoning_effort`,
  Anthropic effort/adaptive thinking, Gemini thinking level), or which snapshot a model name refers to.
- The [changelog](https://deepswe.datacurve.ai/changelog) has dates for when each model was added. The
  script uses them as `DEEPSWE_ADDED` to check snapshots. It also records pricing corrections for
  DeepSeek, OpenAI, and Google. `glm-5-3` and `glm-5-3-flash` have no changelog entry.
- The [GitHub repo](https://github.com/datacurve-ai/deep-swe) has the tasks only, not the model configs.

## Implications for the matching decisions (#9, #10)

These are inputs, not decisions:

1. **Read AA's effort from the name, not the slug.** The slug suffix only covers the configs that
   aren't the headline, and the bare slug's effort is stated only in the name.
2. **`max` never appears as an AA effort suffix.** Keeping it in the regex only produces errors
   (5 Qwen slugs). `-minimal` is missing from it (4 slugs).
3. **The silent fall-back to the bare slug is a coin flip**: 10 right, 10 wrong. A missing config should
   show as missing.
4. **DeepSWE model strings don't identify snapshots**, and AA repoints bare slugs, which 3 DeepSWE models
   have already hit. A curated DeepSWE-model to AA-id map is the only stable join. The changelog dates
   are the only evidence for which snapshot DeepSWE ran.
5. **10 DeepSWE rows have no AA counterpart at all**: Fable 5 and Opus 4.8 at low through xhigh
   (8 rows), GLM-5.2 high, and Sonnet 4.6 with reasoning at high. Qwen3.8 Max has an AA entry (`-0803`),
   but AA doesn't state its effort.

## Sources

- DeepSWE: [leaderboard-live.json v1.1](https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json),
  [v1](https://deepswe.datacurve.ai/artifacts/v1/leaderboard-live.json),
  [changelog](https://deepswe.datacurve.ai/changelog), [blog](https://deepswe.datacurve.ai/blog/deepswe),
  [GitHub](https://github.com/datacurve-ai/deep-swe)
- AA: `/api/v2/language/models/free`, [API reference](https://artificialanalysis.ai/api-reference),
  [data API docs](https://artificialanalysis.ai/data-api/docs)
- AA history: [antoniovho/artificial-analysis-leaderboards](https://github.com/antoniovho/artificial-analysis-leaderboards)
  (`data/<date>/llms.json`). Until 2026-07-10 it scraped the leaderboard page payload; from 2026-08-27
  it uses the v2 free API. Ids are consistent across both sources.
