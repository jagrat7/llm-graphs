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

type DiscoveryState = { posts: Array<DiscoveredPost>; seen: Array<string> }

export type DiscoveryReport = {
  searches: number
  candidates: number
  screened: number
  accepted: Array<DiscoveredPost>
  errors: Array<string>
}

const STATE_KEY = "llm-scores:x-posts:discovered:v1"
const STATE_TTL_SECONDS = 180 * 24 * 60 * 60
const MAX_SEEN = 5000
const DAY_MS = 24 * 60 * 60 * 1000

/** Firecrawl's free plan allows 500 searches a month. */
const DAILY_SEARCHES = 15
const SEARCH_GAP_MS = 7_000
const PHRASES = ["one-shot", "built with OR made with", "prompt"]

const MIN_LIKES = 20
const MIN_P_OUTPUT = 0.9
const MIN_P_SUITABLE = 0.6
const SWITCH_MARGIN = 0.1
const KEEP_PER_MODEL = 6
const KEEP_PER_AUTHOR = 2
const SCREENS_AT_ONCE = 4

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
    body: JSON.stringify({ query, limit: 10, includeDomains: ["x.com"], tbs: "qdr:w" }),
  })
  const { data } = searchSchema.parse(await response.json())
  return data.web.flatMap(
    ({ url }) => /^https:\/\/(?:x|twitter)\.com\/\w{1,15}\/status\/(\d{5,25})/.exec(url)?.[1] ?? [],
  )
}

const stateSchema = z.object({
  posts: z.array(
    z.object({
      url: z.string(),
      alt: z.string(),
      model: z.string(),
      modelName: z.string(),
      category: z.enum(["coding", "agents", "reasoning", "chat", "speed", "image"]),
      likes: z.number(),
      pOutput: z.number(),
      foundAt: z.string(),
    }),
  ),
  seen: z.array(z.string()),
})

let cache: SourceCache | undefined

async function readState(): Promise<DiscoveryState> {
  cache ??= new SourceCache()
  const parsed = stateSchema.safeParse(await cache.readShared(STATE_KEY))
  return parsed.success ? parsed.data : { posts: [], seen: [] }
}

/** The discovered posts as example groups, one per model and category. */
export async function discoveredExamples(): Promise<Array<ModelExamples>> {
  const { posts } = await readState()
  const blocked = new Set(BLOCKED_POSTS)
  const perAuthor = new Map<string, number>()
  const groups = new Map<string, ModelExamples & { posts: Array<{ url: string; alt: string }> }>()
  for (const post of posts.toSorted((left, right) => right.likes - left.likes)) {
    if (blocked.has(post.url.split("/").at(-1) ?? "")) continue
    const key = `${post.category}:${post.model}`
    const group = groups.get(key) ?? {
      label: post.modelName,
      category: post.category,
      models: [post.model],
      posts: [],
    }
    const authorKey = `${key}:${post.url.split("/")[3]?.toLowerCase()}`
    const fromAuthor = perAuthor.get(authorKey) ?? 0
    if (group.posts.length < KEEP_PER_MODEL && fromAuthor < KEEP_PER_AUTHOR) {
      group.posts.push({ url: post.url, alt: post.alt })
      perAuthor.set(authorKey, fromAuthor + 1)
    }
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

/** Searches X for each due model, screens new posts with Jev, and keeps the sure outputs. */
export async function discover(
  models: ReadonlyArray<DiscoveryModel>,
  now = Date.now(),
): Promise<DiscoveryReport> {
  if (!env.FIRECRAWL_API_KEY || !env.TYPESAFE_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY and TYPESAFE_API_KEY are needed to discover posts")
  }

  const state = await readState()
  const known = new Set([
    ...state.seen,
    ...state.posts.map((post) => post.url.split("/").at(-1) ?? ""),
    ...BLOCKED_POSTS,
  ])
  const blockedAuthors = new Set(BLOCKED_AUTHORS.map((handle) => handle.toLowerCase()))
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
      blockedAuthors.has(post.author.handle.toLowerCase())
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

  const screens = limited(SCREENS_AT_ONCE)

  // Started a gap apart rather than one after another, so a slow answer doesn't add to the wait.
  const searches = scheduledSearches(models, now).map(async ({ model, query }, index) => {
    await new Promise((resolve) => setTimeout(resolve, index * SEARCH_GAP_MS))
    let ids: Array<string>
    try {
      ids = await search(query)
      report.searches++
    } catch (error) {
      report.errors.push(`${query}: ${String(error)}`)
      return
    }

    const family = siblings(model, models)
    for (const id of ids.filter((candidate) => !known.has(candidate))) {
      known.add(id)
      report.candidates++
      screens.run(() => consider(id, model, family))
    }
  })
  await Promise.all(searches)
  await screens.done()

  cache ??= new SourceCache()
  await cache.writeShared(
    STATE_KEY,
    {
      posts: [...state.posts, ...report.accepted],
      seen: [...known].slice(-MAX_SEEN),
    } satisfies DiscoveryState,
    STATE_TTL_SECONDS,
  )
  return report
}
