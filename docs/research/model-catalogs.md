# Which public model catalogs can supply names, vendors, release dates, and logos?

Research for issue #5, checked against live data on 2026-09-25.

## Answer

models.dev is the only catalog that supplies all four fields (display name, vendor, release date, and a vendor logo) with no hand-maintained data. Its canonical `models.json` matches all 28 DeepSWE ids after the issue's normalization. It picks up new frontier models on the day they ship and serves a monochrome SVG logo for each lab. Artificial Analysis (AA), which we already fetch, also matches 28/28, so it's the natural fallback. Its display names carry effort qualifiers, its vendor names follow its own branding ("Kimi", "Z AI", "SpaceXAI"), and it has no logos.

### Recommendation

- **Primary: models.dev** (no auth, MIT, CDN-served)
  - Model: `https://models.dev/models.json`. The id is `creator/model` (e.g. `xai/grok-4.6`), and each entry has `name` and `release_date`.
  - Vendor key: the id prefix (`openai`, `anthropic`, `google`, `xai`, `zhipuai`, `moonshotai`, `alibaba`, `meta`, `deepseek`).
  - Vendor display name: `https://models.dev/api.json` → `[creator].name`.
  - Logo: `https://models.dev/logos/labs/{creator}.svg`. It's an SVG that uses `fill="currentColor"`, so it follows the theme's text color.
- **Fallback: AA's own fields** (already fetched with `AA_API_KEY`)
  - `name` with the trailing parenthetical stripped, `model_creator.name`, and `release_date`.
  - To get a vendor key and logo, take the models.dev canonical id with the longest common prefix. In a leave-one-out test this picked the right vendor for 28/28 ids, and it needs no mapping table.
  - If there's no match, use the models.dev default logo.
- **Backup if models.dev ever disappears: Vercel AI Gateway** `https://ai-gateway.vercel.sh/v1/models`. No auth, 28/28, clean names, `owned_by` creator slug, and `released` timestamps. It has no logos.
- **Not recommended:**
  - OpenRouter: 27/28, no release date, no logos, and its ToS has an anti-scraping clause.
  - LiteLLM: only pricing and capability data (no names, release dates, creators, or logos), and some models appear up to about 5 weeks after release.

## Comparison

| | AA free API | **models.dev** | OpenRouter | LiteLLM map | Vercel AI Gateway | LobeHub icons |
|---|---|---|---|---|---|---|
| Id format | `slug` like `gpt-6-astra`; `id` is a UUID | `creator/model` like `openai/gpt-6-astra` (canonical); per-host ids in `api.json` | `author/model` like `x-ai/grok-4.6`, plus `:batch`/`:free` variants | Free-form keys: `gpt-6-astra`, `xai/grok-4.6`, `us.anthropic.claude-opus-5` ... | `creator/model` like `spacexai/grok-4.6` | Icon slug like `openai`, `moonshot` |
| Matches (of 28) | **28** | **28** | 27 (no `qwen3-8-max`) | 28 (via host-prefixed keys) | **28** | n/a (logos only) |
| Recent: gpt-6-astra, claude-opus-5-5, grok-4-6, qwen3-8-max | all 4 | all 4 | 3 of 4 | all 4 | all 4 | n/a |
| Lag after release | ≤3 days (no add timestamp; had the 09-21/22 releases by 09-25) | same day to 1 day (git history) | same day to 1 day (`created`) | same day to ~5 weeks (git history) | ≤3 days (no usable add timestamp) | n/a |
| Display name | Has effort suffix: "GPT-6 Astra (max)" | Clean: "GPT-6 Astra" | Vendor prefix: "OpenAI: GPT-6 Astra" | none | Clean: "GPT-6 Astra" | n/a |
| Release date | `release_date` (of the checkpoint AA benchmarks) | `release_date` | none (`created` = date listed; date suffix in `canonical_slug`) | none (`deprecation_date` only) | `released` (epoch) | n/a |
| Vendor | `model_creator{id: UUID, name}` | id prefix, plus provider `name` | id prefix, plus the name prefix | `litellm_provider` = the host, not the creator | `owned_by` slug | n/a |
| Vendor logo | none | **SVG** `/logos/labs/{creator}.svg` and `/logos/{provider}.svg`, `currentColor` | none in API | none | none in API | SVG/PNG/WebP on unpkg CDN; mono and `-color` variants |
| Auth | `x-api-key` required (401 without) | none | none needed in practice (docs list bearer auth) | none (raw GitHub) | none (documented) | none |
| Rate limit | Docs: 1,000/day. Live free endpoint: `X-Ratelimit-Limit: 100`, reset ~24h | none documented (Cloudflare static, ETag) | none documented (`max-age=120`) | GitHub raw limits | none documented | unpkg CDN |
| License / terms | Attribution to artificialanalysis.ai required; keep key server-side; cache responses | MIT repo (anomalyco/models.dev) | ToS §7 bans scripts that "scrape or copy any information on the Site or the Services" | MIT (outside `enterprise/`) | Vercel ToS; endpoint documented as public | MIT (the brand marks remain trademarks) |

## Id match counts

Normalization is exactly as specified in the issue: lowercase, `.`→`-`, and drop everything up to the last `/`. The 28 ids come from the live DeepSWE leaderboard. The live run is reproducible with `docs/research/catalog_id_match.py`.

| Catalog | Entries | Matched | Missing (nearest candidates) |
|---|---|---|---|
| AA free (`slug`) | 673 | 28/28 | – |
| models.dev `models.json` (canonical) | 427 | 28/28 | – |
| models.dev `api.json` (any of 223 hosts) | 8,180 | 28/28 | – |
| OpenRouter `/api/v1/models` | 458 | 27/28 | `qwen3-8-max` (`qwen/qwen3.8-max-0902`, `qwen/qwen3.8-max-prime`) |
| Vercel AI Gateway `/v1/models` | 390 | 28/28 | – |
| LiteLLM `model_prices_and_context_window.json` | 4,356 | 28/28 | – |

Matching ids is not what separates these catalogs. Every source except OpenRouter hits 28/28. They differ in metadata quality, logos, and whether the vendor is the creator or just a host.

## Recent releases and lag

"Added" means the first git commit of the model's file (models.dev canonical `models/...toml`), OpenRouter's `created`, or the first LiteLLM commit containing the key. The LiteLLM value comes from a binary search over the commits touching the file since July, so it's approximate.

| Model | Released (per sources) | models.dev added | OpenRouter added | LiteLLM added |
|---|---|---|---|---|
| gpt-6-astra | 09-03 (AA, OR slug) / 09-04 (models.dev, Vercel) | 09-04 | 09-04 | 09-03 |
| claude-opus-5-5 | 09-22 | 09-22 | 09-22 | 09-22 |
| grok-4-6 | 08-12 | 08-12 | 08-12 | 08-13 (`xai/grok-4.6`) |
| qwen3-8-max | 08-02/03 (first checkpoint) | 08-03 | not listed; `-0902` added 09-03 | 08-12 (`dashscope/`) |
| glm-5-3 | 08-14 to 08-18 | 08-14 | 08-18 | 08-27 (`zai/`) |
| kimi-k3 | 07-16 | 07-16 (provider file) | 07-16 | 08-20 (`fireworks_ai/`), 08-21 (`moonshot/`) |

AA and Vercel expose no usable "added" timestamp; every Vercel `created` is the same 2025-08-21 value. On 09-25 both already listed `claude-opus-5-5`, `gpt-6-sol`, and `gpt-6-luna` (all released 09-22), plus `grok-4-7` (09-21).

## Vendor naming

| Vendor | AA `model_creator.name` (key) | models.dev creator → name | OpenRouter slug → name prefix | Vercel `owned_by` | LiteLLM `litellm_provider` |
|---|---|---|---|---|---|
| OpenAI | OpenAI (UUID) | `openai` → OpenAI | `openai` → OpenAI | `openai` | `openai` |
| Anthropic | Anthropic (UUID) | `anthropic` → Anthropic | `anthropic` → Anthropic | `anthropic` | `anthropic` |
| Google | Google (UUID) | `google` → Google | `google` → Google | `google` | `gemini` / `vertex_ai-language-models` |
| xAI / SpaceXAI | **SpaceXAI** (UUID) | `xai` → xAI | `x-ai` → SpaceXAI | **`spacexai`** | `xai` |
| Moonshot | **Kimi** (UUID) | `moonshotai` → Moonshot AI | `moonshotai` → MoonshotAI | `moonshotai` | `moonshot` |
| Zhipu / Z.ai | **Z AI** (UUID) | `zhipuai` → Zhipu AI | `z-ai` → Z.ai | `zai` | `zai` |
| Alibaba / Qwen | Alibaba (UUID) | `alibaba` → Alibaba | **`qwen`** → Qwen | `alibaba` | `dashscope` |
| DeepSeek | DeepSeek (UUID) | `deepseek` → DeepSeek | `deepseek` → DeepSeek | `deepseek` | `deepseek` |
| Meta | Meta (UUID) | `meta` → Meta | `meta` → Meta (`meta-llama` for Llama) | `meta` | `meta` |

How stable the keys are:

- **AA:** `model_creator.id` is a UUID, and the docs call it a "Unique identifier (stable)". Names follow rebrands; xAI became SpaceXAI in July 2026. The deprecated `/api/v2/data/llms/models` endpoint also returned `model_creator.slug` (`xai`, `kimi`, `zai`, `aws`...). The new free endpoint drops it, and the old one sunsets 2026-11-04.
- **models.dev:** the creator key is the repo directory name (`models/<creator>/`, `labs/<creator>/`). It's stable, and so far it has not followed the SpaceXAI rebrand (still `xai` / "xAI").
- **Vercel:** did re-key `xai` → `spacexai`. No `xai/` ids remain, so its slugs can change.
- **OpenRouter:** kept the `x-ai` slug and changed only the display prefix.
- **LiteLLM:** its provider field names the API route, not the model creator (e.g. `dashscope` for Qwen, `vertex_ai-language-models` for bare Gemini keys).

## Per-catalog evidence

### Artificial Analysis (`/api/v2/language/models/free`)

- **Fields:** `id` (UUID), `name`, `slug`, `release_date`, and `model_creator{id,name}`. There's no logo or URL field.
- **Name suffixes:** names include effort or variant suffixes, such as "Claude Opus 5 (Adaptive Reasoning, Max Effort)", "GPT-6 Astra (max)", and "Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)". Stripping the trailing `(...)` works for all 28 ids. What's left is the checkpoint label: "DeepSeek V4 Pro 0813" and "Qwen3.8 Max (0902)" (the second loses its suffix when stripped).
- **Checkpoints:** the slug tracks the latest checkpoint AA benchmarks. `deepseek-v4-pro` is the 0813 checkpoint (released 2026-08-13), while models.dev, OpenRouter, and Vercel date `deepseek-v4-pro` to 04-23/24. Likewise `qwen3-8-max` is the 0902 checkpoint and the older one is `qwen3-8-max-0803`. A DeepSWE id doesn't say which checkpoint it ran, so "release date" is ambiguous for these ids no matter which source we use.
- **Rate limit and terms:** the live response headers were `X-Aa-Tier: free`, `X-Ratelimit-Limit: 100`, and a reset about 23.7h out. The docs say 1,000/day and require attribution: "Attribution is required for all use of our free API. Please provide attribution to https://artificialanalysis.ai/". The docs also say to keep the key server-side and cache responses.

### models.dev (anomalyco/models.dev, formerly sst/models.dev)

- **Endpoints:**
  - `api.json` is keyed by 223 *hosting* providers (8,180 entries); a provider here is a host, not the model's creator.
  - `models.json` holds 427 provider-agnostic canonical models keyed `creator/model`. Fields include `name`, `family`, `release_date`, `last_updated`, `open_weights`, `knowledge`, and sometimes `benchmarks`.
  - `catalog.json` is `{providers, models}`.
  - All three are served from Cloudflare with `access-control-allow-origin: *` and an ETag, so conditional GETs are cheap.
- **Labs:** the repo has 23 `labs/<creator>/lab.toml` files (a description only, no name field). 19 of those labs also have a `logo.svg`; `deepreinforce`, `sakana`, `sarvam`, and `stepfun` don't.
- **Logos:** the worker (`packages/function/src/worker.ts`) serves `/logos/...` from static assets. Any path that 404s falls back to `/logos/default.svg` *with status 200*, so a missing logo has to be detected by comparing against the default SVG or by checking the creator against the lab list.
  - `https://models.dev/logos/labs/{creator}.svg` resolved real logos for all 9 of our vendors, and also for labs that aren't hosts, such as `tencent` (`/logos/tencent.svg` returns the default).
  - The older `/logos/{provider}.svg` only covers ids that are also hosting providers.
  - All 9 of our logos use `fill="currentColor"`.
- **Vendor display name:** comes from `api.json[creator].name`. That exists for all 9 of our vendors but not for 20 of the 44 creators in `models.json` (e.g. `amazon`, `microsoft`, `tencent`), which would need a title-cased slug.
- **Data-quality issues found:**
  - `meta/muse-spark-1.1` has `release_date` 2026-04-08, which is the date of the original Muse Spark. AA, Vercel, and OpenRouter all say 2026-07-09, and the models.dev file itself was first committed 2026-07-09.
  - The GLM dates run 2 to 4 days earlier than the other sources, which look like announcement dates versus API availability.
- **Lag:** see the table above; it was same-day for every frontier model checked.

### OpenRouter (`/api/v1/models`)

- **Access and naming:** it returned 200 without auth; the docs list bearer auth. The id prefix is the author slug. `name` is "Vendor: Model", e.g. "SpaceXAI: Grok 4.6", "Z.ai: GLM 5.3", or "MoonshotAI: Kimi K3".
- **Dates:** `created` is when the model was listed on OpenRouter. `canonical_slug` embeds a date (`openai/gpt-6-astra-20260903`) that is usually, but not always, the release date: `claude-opus-5.5-20260921` versus a 09-22 release, and `grok-4.6-20260810` versus 08-12.
- **Missing id:** `qwen3-8-max` is missing because OpenRouter only lists dated checkpoints (`qwen3.8-max-0902`, `qwen3.8-max-prime`). LiteLLM still carries a stale `openrouter/qwen/qwen3.8-max`.
- **Logos:** there's no logo field. `/api/v1/providers` lists inference hosts (name, slug, and policy URLs) with no icons. `/api/frontend/models` returns 404.
- **Terms:** ToS §7 prohibits using "scripts, robots or any other means ... to scrape or copy any information on the Site or the Services". The docs' CC BY 4.0 grant covers only the Datasets endpoints.

### LiteLLM (`model_prices_and_context_window.json`)

- **Contents:** 4,356 keys. The fields are pricing, context limits, `supports_*` flags, `litellm_provider`, `mode`, `source`, and `deprecation_date`. There's no display name, release date, creator, or logo.
- **Keys:** they mix bare ids (`gpt-6-astra`), host prefixes (`fireworks_ai/kimi-k3`, `perplexity/perplexity/kimi-k3`), Bedrock regional ids (`us.anthropic.claude-opus-5`), and odd casing (`together_ai/moonshotai/Kimi-K3`). Normalization still finds all 28, but only because host-prefixed copies exist.
- **Lag:** first-party frontier models were added the same day. `kimi-k3` took about 5 weeks and `qwen3.8-max` and `glm-5.3` about 9 to 13 days.

### Vercel AI Gateway (`/v1/models`), the best extra catalog found

- **Access:** documented as "requires no authentication". Ids follow the documented `creator/model-name` format.
- **Fields:** `owned_by` equals the id prefix for all 390 models. `name` is clean ("GPT-6 Astra", "GPT 5.4", "GLM 5.3") and `released` is a Unix epoch. `created` is a constant (2025-08-21) and useless.
- **Dates:** mostly agree with AA and models.dev. The outlier is `claude-fable-5`, which Vercel dates 2026-07-01 while every other source says 06-09.
- **Logos and keys:** there are no logos. Vendor slugs follow rebrands (`spacexai`), which is bad for a stable key.

### LobeHub icons (logos only)

- **CDN:** `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/{slug}.svg` (mono) and `{slug}-color.svg`, with PNG and WebP packages too. Missing icons return a real 404. MIT licensed.
- **Coverage:** slugs are brand names, not catalog keys. `openai`, `anthropic`, `google`, `xai`, `deepseek`, `zai`, `zhipu`, `alibaba`, `qwen`, and `meta` exist, but `moonshotai` and `spacexai` 404 (`moonshot` and `kimi` exist), and `openai` and `anthropic` have no `-color` variant.
- **Mapping:** the React package ships `ModelIcon`/`ProviderIcon` with keyword configs (`src/features/modelConfig.ts`, `providerEnum.ts`) that map model ids to icons. That's automatic for us but pulls in a React dependency and its own naming. It's only useful if we want colored logos; models.dev lab logos need no mapping.

## Names and dates per id

Names come from each catalog as-is. `md` = models.dev canonical; `OR slug` = the date inside OpenRouter's `canonical_slug`. Release dates disagree across AA, models.dev, and Vercel on 10 of the 28 ids.

| id | AA name | models.dev name | OpenRouter name | Vercel name | AA date | md date | Vercel date | OR slug date |
|---|---|---|---|---|---|---|---|---|
| claude-fable-5 | Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback) | Claude Fable 5 | Anthropic: Claude Fable 5 | Claude Fable 5 | 2026-06-09 | 2026-06-09 | 2026-07-01 | 2026-06-09 |
| claude-opus-4-8 | Claude Opus 4.8 (Adaptive Reasoning, Max Effort) | Claude Opus 4.8 | Anthropic: Claude Opus 4.8 | Claude Opus 4.8 | 2026-05-28 | 2026-05-28 | 2026-05-28 | 2026-05-28 |
| claude-opus-5 | Claude Opus 5 (Adaptive Reasoning, Max Effort) | Claude Opus 5 | Anthropic: Claude Opus 5 | Claude Opus 5 | 2026-07-24 | 2026-07-24 | 2026-07-24 | 2026-07-23 |
| claude-sonnet-4-6 | Claude Sonnet 4.6 (Non-reasoning, High Effort) | Claude Sonnet 4.6 | Anthropic: Claude Sonnet 4.6 | Claude Sonnet 4.6 | 2026-02-17 | 2026-02-17 | 2026-02-17 | 2026-02-17 |
| claude-sonnet-5 | Claude Sonnet 5 (Adaptive Reasoning, Max Effort) | Claude Sonnet 5 | Anthropic: Claude Sonnet 5 | Claude Sonnet 5 | 2026-06-30 | 2026-06-30 | 2026-06-29 | 2026-06-30 |
| deepseek-v4-flash | DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | DeepSeek V4 Flash | DeepSeek: DeepSeek V4 Flash 0423 | DeepSeek V4 Flash | 2026-07-31 | 2026-04-24 | 2026-04-23 | 2026-04-23 |
| deepseek-v4-pro | DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | DeepSeek V4 Pro | DeepSeek: DeepSeek V4 Pro 0423 | DeepSeek V4 Pro | 2026-08-13 | 2026-04-24 | 2026-04-23 | 2026-04-23 |
| gemini-3-1-pro-preview | Gemini 3.1 Pro Preview | Gemini 3.1 Pro Preview | Google: Gemini 3.1 Pro Preview | Gemini 3.1 Pro Preview | 2026-02-19 | 2026-02-19 | 2026-02-19 | 2026-02-19 |
| gemini-3-5-flash | Gemini 3.5 Flash (high) | Gemini 3.5 Flash | Google: Gemini 3.5 Flash | Gemini 3.5 Flash | 2026-05-19 | 2026-05-19 | 2026-05-19 | 2026-05-19 |
| gemini-3-6-flash | Gemini 3.6 Flash (high) | Gemini 3.6 Flash | Google: Gemini 3.6 Flash | Gemini 3.6 Flash | 2026-07-21 | 2026-07-21 | 2026-07-21 | 2026-07-21 |
| gemini-3-7-flash | Gemini 3.7 Flash (high) | Gemini 3.7 Flash | Google: Gemini 3.7 Flash | Gemini 3.7 Flash | 2026-08-13 | 2026-08-13 | 2026-08-13 | 2026-08-13 |
| gemini-3-8-flash | Gemini 3.8 Flash (high) | Gemini 3.8 Flash | Google: Gemini 3.8 Flash | Gemini 3.8 Flash | 2026-09-02 | 2026-09-02 | 2026-09-02 | 2026-09-02 |
| glm-5-2 | GLM-5.2 (max) | GLM-5.2 | Z.ai: GLM 5.2 | GLM 5.2 | 2026-06-16 | 2026-06-13 | 2026-06-16 | 2026-06-16 |
| glm-5-3 | GLM-5.3 (max) | GLM-5.3 | Z.ai: GLM 5.3 | GLM 5.3 | 2026-08-18 | 2026-08-14 | 2026-08-18 | 2026-08-16 |
| glm-5-3-flash | GLM 5.3 Flash | GLM-5.3-Flash | Z.ai: GLM 5.3 Flash | GLM 5.3 Flash | 2026-08-26 | 2026-08-26 | 2026-08-26 | 2026-08-26 |
| gpt-5-4 | GPT-5.4 (xhigh) | GPT-5.4 | OpenAI: GPT-5.4 | GPT 5.4 | 2026-03-05 | 2026-03-05 | 2026-03-05 | 2026-03-05 |
| gpt-5-5 | GPT-5.5 (xhigh) | GPT-5.5 | OpenAI: GPT-5.5 | GPT 5.5 | 2026-04-23 | 2026-04-23 | 2026-04-24 | 2026-04-23 |
| gpt-5-6-luna | GPT-5.6 Luna (max) | GPT-5.6 Luna | OpenAI: GPT-5.6 Luna | GPT 5.6 Luna | 2026-07-09 | 2026-07-09 | 2026-07-09 | 2026-07-09 |
| gpt-5-6-sol | GPT-5.6 Sol (max) | GPT-5.6 Sol | OpenAI: GPT-5.6 Sol | GPT 5.6 Sol | 2026-07-09 | 2026-07-09 | 2026-07-09 | 2026-07-09 |
| gpt-5-6-terra | GPT-5.6 Terra (max) | GPT-5.6 Terra | OpenAI: GPT-5.6 Terra | GPT 5.6 Terra | 2026-07-09 | 2026-07-09 | 2026-07-09 | 2026-07-09 |
| gpt-6-astra | GPT-6 Astra (max) | GPT-6 Astra | OpenAI: GPT-6 Astra | GPT-6 Astra | 2026-09-03 | 2026-09-04 | 2026-09-04 | 2026-09-03 |
| grok-4-5 | Grok 4.5 (high) | Grok 4.5 | SpaceXAI: Grok 4.5 | Grok 4.5 | 2026-07-08 | 2026-07-08 | 2026-07-08 | 2026-07-08 |
| grok-4-6 | Grok 4.6 (high) | Grok 4.6 | SpaceXAI: Grok 4.6 | Grok 4.6 | 2026-08-12 | 2026-08-12 | 2026-08-12 | 2026-08-10 |
| kimi-k2-7-code | Kimi K2.7 Code | Kimi K2.7 Code | MoonshotAI: Kimi K2.7 Code | Kimi K2.7 Code | 2026-06-12 | 2026-06-12 | 2026-06-12 | 2026-06-12 |
| kimi-k3 | Kimi K3 (max) | Kimi K3 | MoonshotAI: Kimi K3 | Kimi K3 | 2026-07-16 | 2026-07-16 | 2026-07-16 | 2026-07-15 |
| muse-spark-1-1 | Muse Spark 1.1 (xhigh) | Muse Spark 1.1 | Meta: Muse Spark 1.1 | Muse Spark 1.1 | 2026-07-09 | 2026-04-08 | 2026-07-09 | 2026-07-09 |
| muse-spark-1-2 | Muse Spark 1.2 (xhigh) | Muse Spark 1.2 | Meta: Muse Spark 1.2 | Muse Spark 1.2 | 2026-08-05 | 2026-08-05 | 2026-08-05 | 2026-08-05 |
| qwen3-8-max | Qwen3.8 Max (0902) | Qwen3.8 Max | – | Qwen 3.8 Max | 2026-09-02 | 2026-08-03 | 2026-08-02 | – |

## Implications for the registry design

- **Vendor keys:** use the models.dev creator slug. It's the only key that doubles as a logo key and hasn't churned on rebrands; AA's UUID is stable but opaque, and Vercel's slug moved to `spacexai`.
- **Missing ids:** for an id models.dev lacks, infer the vendor from the nearest models.dev canonical id by longest common prefix. Leaving each of the 28 ids out in turn, this found the right creator 28/28 times, e.g. a future `grok-4-8` would resolve to `xai` through `grok-4-7`.
- **Release dates:** they are soft data. Checkpoint re-releases (DeepSeek V4, Qwen3.8 Max) and announcement-versus-availability gaps (GLM) mean the sources disagree on 10/28 ids. Pick one source per field instead of merging.
- **Logo fallback:** the fallback returns 200, so check whether the creator has a lab logo rather than trusting the status code.
- **AA endpoint:** stay on the `language/models/free` endpoint. The `data/llms/models` endpoint that still returns creator slugs is deprecated and returns 410 after 2026-11-04.

## Method

- **Id matching:** `docs/research/catalog_id_match.py` fetches every catalog live and prints the match counts, near misses, and vendor keys. The AA key is read from the environment and never printed.
- **Lag:** the first commit of each model file came from the GitHub commits API for models.dev (`models/<creator>/<id>.toml`). LiteLLM was a binary search of raw file contents across the 854 commits to `model_prices_and_context_window.json` since 2026-07-01. OpenRouter lag is its `created` field.
- **Logos:** probed with `curl`, comparing hashes against the models.dev default logo (`/logos/default.svg`) and checking unpkg status codes for LobeHub.
- **Terms and limits:** read from each service's docs and ToS, plus the live AA response headers.
