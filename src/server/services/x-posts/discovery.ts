import { z } from "zod"

import { env } from "#/env"

import { SourceCache } from "../cache/cache"
import { fetchOk } from "../providers/utils"
import {
  BLOCKED_AUTHORS,
  BLOCKED_POSTS,
  type ExampleCategory,
  type ModelExamples,
} from "./examples"
import { loadPost, type XPost } from "./x-posts"

export type DiscoveryModel = {
  id: string
  name: string
  vendor: string | null
  releaseDate: string | null
  /** Scored on DesignArena, so its outputs are images whatever Jev calls them. */
  makesImages: boolean
}

export type DiscoveredPost = {
  url: string
  alt: string
  model: string
  modelName: string
  category: ExampleCategory
  likes: number
  pOutput: number
  foundAt: string
}

type RunSource = "search" | "submitted"

type DiscoveryState = {
  posts: Array<DiscoveredPost>
  seen: Array<string>
  filters?: number
  blockedPosts: Array<string>
  blockedAuthors: Array<string>
  runs: Array<{
    at: string
    source: RunSource
    model?: string
    searches: number
    candidates: number
    screened: number
    accepted: number
    errors: number
  }>
}

export type DiscoveryReport = {
  searches: number
  candidates: number
  screened: number
  accepted: Array<DiscoveredPost>
  errors: Array<string>
}

const STATE_KEY = "llm-scores:x-posts:discovered:v1"
const STATE_TTL_SECONDS = 180 * 24 * 60 * 60
const MAX_SEEN = 20_000
const MAX_RUNS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Firecrawl's free plan allows 500 searches a month. */
const DAILY_SEARCHES = 15
const SEARCH_GAP_MS = 7_000
const PHRASES = ["one-shot", "built with OR made with", "prompt"]

/** Bumped whenever the filters change, so posts they rejected are screened again. */
const FILTERS_VERSION = 2
const MIN_LIKES = 5
const MIN_P_OUTPUT = 0.7
const MIN_P_SUITABLE = 0.5
const SWITCH_MARGIN = 0.1
const KEEP_PER_MODEL = 24
const KEEP_PER_AUTHOR = 4
const SCREENS_AT_ONCE = 6

const JEV_URL = "https://api.typesafe.ai/v1/systemone"
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search"
/** Jev rejects an image with either side outside this range. */
const JEV_MIN_SIDE = 280
const JEV_MAX_SIDE = 1568

const CATEGORIES: Record<ExampleCategory, string> = {
  coding: "Apps, games, sites, 3D or visuals written as code.",
  agents: "Multi-step autonomous work, tool use, computer or robot control, automation.",
  reasoning: "Puzzles, maths, science, analysis.",
  chat: "Writing, conversation, tone.",
  speed: "Shows how fast the model generates.",
  image: "Output of an image-generation model.",
}

function isCategory(key: string): key is ExampleCategory {
  return key in CATEGORIES
}

const VERDICTS = {
  output:
    "The post's own media or a playable link shows an artifact a named AI model produced: an app, game, site, 3D scene, image, video, essay or agent run.",
  pointer:
    "Talks about someone else's output that sits in a quoted post, without showing it itself.",
  roundup: "The head of a thread or list collecting other people's examples.",
  announcement: "A lab's launch, availability, pricing, brand film or docs.",
  benchmark: "A leaderboard, chart, score table or eval result.",
  news: "A news recap, rumour, leak or infographic about a model.",
  other: "Opinion, guide, article link, tutorial, complaint, meme or anything else.",
}

/** Newest models daily, the next two months weekly, older ones not at all. */
export function scheduledSearches(models: ReadonlyArray<DiscoveryModel>, now: number) {
  const due = models.flatMap((model) => {
    const age = Math.floor((now - Date.parse(model.releaseDate ?? "")) / DAY_MS)
    if (!Number.isFinite(age) || age < 0 || age > 90 || (age > 30 && age % 7 !== 0)) return []
    return [{ model, age }]
  })

  const newestFirst = due.toSorted((left, right) => left.age - right.age)
  return PHRASES.flatMap((phrase) =>
    newestFirst.map(({ model }) => ({ model, query: `"${model.name}" ${phrase}` })),
  ).slice(0, DAILY_SEARCHES)
}

const familyWord = (name: string) => name.split(/[\s-]/)[0].toLowerCase()

/** Same lab and first word ("GPT", "Gemini"), released within a year of `model`. */
export function siblings(model: DiscoveryModel, models: ReadonlyArray<DiscoveryModel>) {
  const released = Date.parse(model.releaseDate ?? "")

  return models.filter(
    (other) =>
      other.id !== model.id &&
      other.vendor === model.vendor &&
      familyWord(other.name) === familyWord(model.name) &&
      Math.abs(Date.parse(other.releaseDate ?? "") - released) < 365 * DAY_MS,
  )
}

const choiceSchema = z.object({
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
})
const noulSchema = z.object({ noul: z.number() })
const jevSchema = z.object({
  answers: z
    .object({ verdict: choiceSchema, category: choiceSchema, suitable: noulSchema })
    .and(z.record(z.string(), z.unknown())),
})

type Screen = {
  pOutput: number
  pSuitable: number
  verdict: string
  categories: Record<string, number>
  models: Record<string, number>
}

/** The model shown, the category it belongs in, or null when the post isn't a sure output. */
export function judge(
  screen: Screen,
  searched: DiscoveryModel,
  family: ReadonlyArray<DiscoveryModel>,
): { model: DiscoveryModel; category: ExampleCategory } | null {
  if (
    screen.verdict !== "output" ||
    screen.pOutput < MIN_P_OUTPUT ||
    screen.pSuitable < MIN_P_SUITABLE
  ) {
    return null
  }

  // Another version takes the post only when Jev clearly prefers it: its scores run low and close.
  const score = (model: DiscoveryModel) => screen.models[model.id] ?? 0
  const rival = family.reduce<DiscoveryModel | null>(
    (best, candidate) => (best == null || score(candidate) > score(best) ? candidate : best),
    null,
  )
  const model = rival && score(rival) >= score(searched) + SWITCH_MARGIN ? rival : searched
  if (model.makesImages) return { model, category: "image" }

  const [category] = Object.entries(screen.categories)
    .toSorted((left, right) => right[1] - left[1])
    .map(([key]) => key)
    .filter((key) => key !== "image" && isCategory(key))
  return category && isCategory(category) ? { model, category } : null
}

function describe(post: XPost) {
  const media = post.media
    .map((item) => `${item.kind}${item.alt ? ` alt="${item.alt.slice(0, 200)}"` : ""}`)
    .join("; ")
  return [
    "An X post, a candidate for a gallery of real AI model outputs.",
    `author: @${post.author.handle} (${post.author.name})`,
    `posted: ${post.postedAt.slice(0, 10)}  likes: ${post.likes}`,
    `media: ${media || "none"}`,
    `text: """${post.text.slice(0, 1200)}"""`,
  ].join("\n")
}

/** X's own resize that fits Jev's limits, or null when none does. */
function coverForJev(post: XPost) {
  const cover = post.media[0]
  if (!cover) return null
  for (const [name, longest] of [
    ["small", 680],
    ["medium", 1200],
  ] as const) {
    const scale = Math.min(1, longest / Math.max(cover.width, cover.height))
    const sides = [cover.width * scale, cover.height * scale]
    if (sides.every((side) => side >= JEV_MIN_SIDE && side <= JEV_MAX_SIDE)) {
      const format = cover.previewUrl.endsWith(".png") ? "png" : "jpeg"
      return { url: `${cover.previewUrl}?name=${name}`, format }
    }
  }
  return null
}

async function screenPost(
  post: XPost,
  searched: DiscoveryModel,
  family: ReadonlyArray<DiscoveryModel>,
): Promise<Screen> {
  const cover = coverForJev(post)
  const placeholder = crypto.randomUUID()
  const questions: Record<string, unknown> = {
    verdict: { type: "choice", instructions: "What is this post?", criteria: VERDICTS },
    category: {
      type: "choice",
      instructions: "If this post shows a model's output, which kind of output is it?",
      criteria: CATEGORIES,
    },
    suitable: {
      type: "noul",
      instructions:
        "The post is fine to show on a public gallery: not sexualised, graphic, hateful, a scam or engagement bait.",
    },
  }
  for (const model of [searched, ...family]) {
    questions[`m:${model.id}`] = {
      type: "noul",
      instructions: `The output shown in this post was made by exactly ${model.name} (that exact version, not a similarly named one). A model that is only mentioned does not count.`,
    }
  }

  const request: Record<string, unknown> = {
    model: "jev-latest",
    state: cover ? `${describe(post)}\ncover image: ${placeholder}` : describe(post),
    questions,
  }
  if (cover) {
    const image = await fetchOk("X media", cover.url, { timeoutMs: 10_000 })
    const data = Buffer.from(await image.arrayBuffer()).toString("base64")
    request.assets = { [placeholder]: { type: "image", format: cover.format, data_base64: data } }
  }

  const response = await fetchOk("Jev", JEV_URL, {
    timeoutMs: 30_000,
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
      ...(cover ? { "TypeSafe-Danger-Zone-Images": "true" } : {}),
    },
    body: JSON.stringify(request),
  })
  const { answers } = jevSchema.parse(await response.json())
  const models: Record<string, number> = {}
  for (const [key, value] of Object.entries(answers)) {
    const noul = noulSchema.safeParse(value)
    if (key.startsWith("m:") && noul.success) models[key.slice(2)] = noul.data.noul
  }

  return {
    verdict: answers.verdict.choice,
    pOutput: answers.verdict.probabilities.output ?? 0,
    pSuitable: answers.suitable.noul,
    categories: answers.category.probabilities,
    models,
  }
}

const searchSchema = z.object({
  data: z.object({ web: z.array(z.object({ url: z.string() })).default([]) }),
})

async function search(query: string) {
  const response = await fetchOk("Firecrawl", FIRECRAWL_URL, {
    timeoutMs: 30_000,
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 10, includeDomains: ["x.com"], tbs: "qdr:m" }),
  })
  const { data } = searchSchema.parse(await response.json())
  return data.web.flatMap(
    ({ url }) => /^https:\/\/(?:x|twitter)\.com\/\w{1,15}\/status\/(\d{5,25})/.exec(url)?.[1] ?? [],
  )
}

const postSchema = z.object({
  url: z.string(),
  alt: z.string(),
  model: z.string(),
  modelName: z.string(),
  category: z.enum(["coding", "agents", "reasoning", "chat", "speed", "image"]),
  likes: z.number(),
  pOutput: z.number(),
  foundAt: z.string(),
})

const runSchema = z.object({
  at: z.string(),
  source: z.enum(["search", "submitted"]),
  model: z.string().optional(),
  searches: z.number(),
  candidates: z.number(),
  screened: z.number(),
  accepted: z.number(),
  errors: z.number(),
})

const stateSchema = z.object({
  posts: z.array(postSchema),
  seen: z.array(z.string()),
  filters: z.number().optional(),
  blockedPosts: z.array(z.string()).default([]),
  blockedAuthors: z.array(z.string()).default([]),
  runs: z.array(runSchema).default([]),
})

let cache: SourceCache | undefined

async function readState(): Promise<DiscoveryState> {
  cache ??= new SourceCache()
  const parsed = stateSchema.safeParse(await cache.readShared(STATE_KEY))
  if (!parsed.success) {
    return { posts: [], seen: [], blockedPosts: [], blockedAuthors: [], runs: [] }
  }
  // Posts rejected under older, stricter filters get another look.
  return parsed.data.filters === FILTERS_VERSION ? parsed.data : { ...parsed.data, seen: [] }
}

/** Applies `change` to the latest state, so a write never drops what another run saved meanwhile. */
async function updateState(change: (state: DiscoveryState) => DiscoveryState) {
  const next = change(await readState())
  cache ??= new SourceCache()
  await cache.writeShared(
    STATE_KEY,
    {
      ...next,
      seen: next.seen.slice(-MAX_SEEN),
      runs: next.runs.slice(-MAX_RUNS),
      filters: FILTERS_VERSION,
    },
    STATE_TTL_SECONDS,
  )
}

const idOf = (url: string) => url.split("/").at(-1) ?? ""
const authorOf = (url: string) => url.split("/")[3]?.toLowerCase() ?? ""

function blocklist(state: DiscoveryState) {
  return {
    posts: new Set([...BLOCKED_POSTS, ...state.blockedPosts]),
    authors: new Set([...BLOCKED_AUTHORS, ...state.blockedAuthors].map((h) => h.toLowerCase())),
  }
}

/** The posts the page shows: most liked first, capped per model and per author, blocked ones left out. */
function shownPosts(state: DiscoveryState) {
  const blocked = blocklist(state)
  const perGroup = new Map<string, number>()
  const perAuthor = new Map<string, number>()
  return state.posts
    .toSorted((left, right) => right.likes - left.likes)
    .filter((post) => {
      if (blocked.posts.has(idOf(post.url)) || blocked.authors.has(authorOf(post.url))) return false
      const group = `${post.category}:${post.model}`
      const author = `${group}:${authorOf(post.url)}`
      const fromGroup = perGroup.get(group) ?? 0
      const fromAuthor = perAuthor.get(author) ?? 0
      if (fromGroup >= KEEP_PER_MODEL || fromAuthor >= KEEP_PER_AUTHOR) return false
      perGroup.set(group, fromGroup + 1)
      perAuthor.set(author, fromAuthor + 1)
      return true
    })
}

/** The discovered posts as example groups, one per model and category. */
export async function discoveredExamples(): Promise<Array<ModelExamples>> {
  const groups = new Map<string, ModelExamples & { posts: Array<{ url: string; alt: string }> }>()
  for (const post of shownPosts(await readState())) {
    const key = `${post.category}:${post.model}`
    const group = groups.get(key) ?? {
      label: post.modelName,
      category: post.category,
      models: [post.model],
      posts: [],
    }
    group.posts.push({ url: post.url, alt: post.alt })
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Runs at most `limit` tasks at once; `done` waits for every task started so far. */
function limited(limit: number) {
  let active = 0
  const waiting: Array<() => void> = []
  const started: Array<Promise<void>> = []
  return {
    run(task: () => Promise<void>) {
      started.push(
        (async () => {
          // A finishing task hands its slot straight to the next waiting one.
          if (active < limit) active++
          else await new Promise<void>((resolve) => waiting.push(resolve))
          try {
            await task()
          } finally {
            const next = waiting.shift()
            if (next) next()
            else active--
          }
        })(),
      )
    },
    done: () => Promise.all(started),
  }
}

/** Loads, filters and screens each post it hasn't seen, then saves the sure outputs. */
async function screening(source: RunSource, now: number) {
  if (!env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is needed to screen posts")

  const state = await readState()
  const blocked = blocklist(state)
  const known = new Set([
    ...state.seen,
    ...state.posts.map((post) => idOf(post.url)),
    ...blocked.posts,
  ])
  const fresh: Array<string> = []
  const pool = limited(SCREENS_AT_ONCE)
  const report: DiscoveryReport = {
    searches: 0,
    candidates: 0,
    screened: 0,
    accepted: [],
    errors: [],
  }

  async function consider(id: string, model: DiscoveryModel, family: Array<DiscoveryModel>) {
    let post: XPost
    try {
      post = await loadPost(id)
    } catch {
      report.errors.push(`${id}: unavailable`)
      return
    }
    if (
      post.media.length === 0 ||
      post.likes < MIN_LIKES ||
      Date.parse(post.postedAt) < Date.parse(model.releaseDate ?? "") - DAY_MS ||
      blocked.authors.has(post.author.handle.toLowerCase())
    ) {
      return
    }

    report.screened++
    try {
      const screened = await screenPost(post, model, family)
      const verdict = judge(screened, model, family)
      if (!verdict) return
      report.accepted.push({
        url: post.url,
        alt: post.media[0]?.alt ?? `Output from ${verdict.model.name}`,
        model: verdict.model.id,
        modelName: verdict.model.name,
        category: verdict.category,
        likes: post.likes,
        pOutput: screened.pOutput,
        foundAt: new Date(now).toISOString(),
      })
    } catch (error) {
      report.errors.push(`${id}: ${String(error)}`)
    }
  }

  return {
    report,
    /** Queues the posts not seen before, judged against `model` and its `family`. */
    offer(ids: ReadonlyArray<string>, model: DiscoveryModel, family: Array<DiscoveryModel>) {
      for (const id of ids.filter((candidate) => !known.has(candidate))) {
        known.add(id)
        fresh.push(id)
        report.candidates++
        pool.run(() => consider(id, model, family))
      }
    },
    async finish(model?: string) {
      await pool.done()
      const accepted = new Set(report.accepted.map((post) => post.url))
      await updateState((latest) => ({
        ...latest,
        posts: [...latest.posts.filter((post) => !accepted.has(post.url)), ...report.accepted],
        seen: [...new Set([...latest.seen, ...fresh])],
        runs: [
          ...latest.runs,
          {
            at: new Date(now).toISOString(),
            source,
            ...(model ? { model } : {}),
            searches: report.searches,
            candidates: report.candidates,
            screened: report.screened,
            accepted: report.accepted.length,
            errors: report.errors.length,
          },
        ],
      }))
      return report
    },
  }
}

/** Searches X for each due model, screens new posts with Jev, and keeps the sure outputs. */
export async function discover(
  models: ReadonlyArray<DiscoveryModel>,
  now = Date.now(),
): Promise<DiscoveryReport> {
  if (!env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is needed to search for posts")
  const run = await screening("search", now)

  // Started a gap apart rather than one after another, so a slow answer doesn't add to the wait.
  const searches = scheduledSearches(models, now).map(async ({ model, query }, index) => {
    await new Promise((resolve) => setTimeout(resolve, index * SEARCH_GAP_MS))
    try {
      const ids = await search(query)
      run.report.searches++
      run.offer(ids, model, siblings(model, models))
    } catch (error) {
      run.report.errors.push(`${query}: ${String(error)}`)
    }
  })
  await Promise.all(searches)
  return run.finish()
}

const POST_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/\w{1,15}\/status\/(\d{5,25})/

/** A post id from an id or a post link, or null. */
export function toPostId(input: string) {
  const trimmed = input.trim()
  if (/^\d{5,25}$/.test(trimmed)) return trimmed
  return POST_LINK.exec(trimmed)?.[1] ?? null
}

/** Screens posts someone found for `modelId`, keeping the sure outputs like a search would. */
export async function submit(
  posts: ReadonlyArray<string>,
  modelId: string,
  models: ReadonlyArray<DiscoveryModel>,
  now = Date.now(),
) {
  const model = models.find((candidate) => candidate.id === modelId)
  if (!model) throw new Error(`Unknown model "${modelId}"; list_models gives the ids`)
  const ids = [...new Set(posts.map(toPostId))]
  const valid = ids.filter((id): id is string => id != null)

  const run = await screening("submitted", now)
  run.offer(valid, model, siblings(model, models))
  const report = await run.finish(model.id)
  return {
    ...report,
    invalid: ids.length - valid.length,
    alreadySeen: valid.length - report.candidates,
  }
}

export type BlockTarget = { post?: string; author?: string }

/** Hides a post or every post by an author, or shows them again with `blocked` false. */
export async function setBlocked(target: BlockTarget, blocked: boolean) {
  const post = target.post == null ? null : toPostId(target.post)
  if (target.post != null && post == null) throw new Error(`Not a post id or link: ${target.post}`)
  const author = target.author?.trim().replace(/^@/, "").toLowerCase() || null
  if (!post && !author) throw new Error("Give a post or an author")

  const toggle = (list: Array<string>, item: string | null) => {
    if (item == null) return list
    const rest = list.filter((entry) => entry.toLowerCase() !== item)
    return blocked ? [...rest, item] : rest
  }
  await updateState((state) => ({
    ...state,
    blockedPosts: toggle(state.blockedPosts, post),
    blockedAuthors: toggle(state.blockedAuthors, author),
  }))
  return { post, author, blocked }
}

export type PostFilter = { model?: string; category?: ExampleCategory; limit?: number }

/** Kept posts, most liked first, each marked with whether the page shows it. */
export async function listPosts({ model, category, limit = 50 }: PostFilter) {
  const state = await readState()
  const shown = new Set(shownPosts(state).map((post) => post.url))
  const blocked = blocklist(state)
  const matching = state.posts
    .filter(
      (post) =>
        (model == null || post.model === model) && (category == null || post.category === category),
    )
    .toSorted((left, right) => right.likes - left.likes)
  return {
    total: matching.length,
    posts: matching.slice(0, limit).map((post) => ({
      ...post,
      shown: shown.has(post.url),
      blocked: blocked.posts.has(idOf(post.url)) || blocked.authors.has(authorOf(post.url)),
    })),
  }
}

/** Posts kept and shown per model, the block lists, and the latest runs. */
export async function discoveryStats() {
  const state = await readState()
  const shown = shownPosts(state)
  const perModel = new Map<
    string,
    { model: string; modelName: string; kept: number; shown: number }
  >()
  for (const post of state.posts) {
    const entry = perModel.get(post.model) ?? {
      model: post.model,
      modelName: post.modelName,
      kept: 0,
      shown: 0,
    }
    entry.kept++
    perModel.set(post.model, entry)
  }
  for (const post of shown) {
    const entry = perModel.get(post.model)
    if (entry) entry.shown++
  }
  return {
    kept: state.posts.length,
    shown: shown.length,
    seen: state.seen.length,
    limits: {
      perModelAndCategory: KEEP_PER_MODEL,
      perAuthor: KEEP_PER_AUTHOR,
      minLikes: MIN_LIKES,
    },
    models: [...perModel.values()].toSorted((left, right) => right.kept - left.kept),
    blockedPosts: state.blockedPosts,
    blockedAuthors: state.blockedAuthors,
    runs: state.runs.slice(-10).toReversed(),
  }
}
