import { z } from "zod"

import type { SourceDefinition } from "../providers"

import { fetchOk } from "../providers/utils"
import { MODEL_EXAMPLES, type ExamplePost, type ModelExamples } from "./examples"

const EMBED_DATA = "https://cdn.syndication.twimg.com/tweet-result"
const STATUS_URL = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})$/

const mediaSchema = z.object({
  type: z.enum(["photo", "video", "animated_gif"]),
  media_url_https: z.url(),
  original_info: z.object({ width: z.number().positive(), height: z.number().positive() }),
  ext_alt_text: z.string().trim().min(1).nullish(),
})

const embedSchema = z.object({
  id_str: z.string(),
  text: z.string(),
  display_text_range: z.tuple([z.number().int(), z.number().int()]),
  created_at: z.iso.datetime(),
  favorite_count: z.number().int().nonnegative(),
  user: z.object({
    name: z.string(),
    screen_name: z.string(),
    profile_image_url_https: z.url(),
  }),
  mediaDetails: z.array(mediaSchema).default([]),
})

export type XPost = {
  id: string
  url: string
  author: { name: string; handle: string; avatarUrl: string }
  text: string
  postedAt: string
  likes: number
  media: Array<{
    kind: "photo" | "video" | "gif"
    previewUrl: string
    width: number
    height: number
    alt: string | null
  }>
}

export type XPostsPayload = {
  groups: Array<Omit<ModelExamples, "posts"> & { posts: Array<string> }>
  posts: Array<XPost>
  dropped: Array<{ url: string; reason: string }>
}

export function postId(url: string) {
  const id = STATUS_URL.exec(url)?.[1]
  if (!id) throw new Error(`Not an X post link: ${url}`)
  return id
}

/** The token X's own embed script sends with an embed data request. */
export function embedToken(id: string) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")
}

export function parseEmbed(raw: unknown): XPost {
  const embed = embedSchema.parse(raw)
  const [start, end] = embed.display_text_range
  const handle = embed.user.screen_name

  return {
    id: embed.id_str,
    url: `https://x.com/${handle}/status/${embed.id_str}`,
    author: {
      name: embed.user.name,
      handle,
      avatarUrl: embed.user.profile_image_url_https.replace("_normal.", "_bigger."),
    },
    text: Array.from(embed.text).slice(start, end).join("").trim(),
    postedAt: embed.created_at,
    likes: embed.favorite_count,
    media: embed.mediaDetails.map((media) => ({
      kind: media.type === "animated_gif" ? "gif" : media.type,
      previewUrl: media.media_url_https,
      width: media.original_info.width,
      height: media.original_info.height,
      alt: media.ext_alt_text ?? null,
    })),
  }
}

async function fetchPost({ url, alt }: ExamplePost): Promise<XPost> {
  const id = postId(url)
  const response = await fetchOk("X", `${EMBED_DATA}?id=${id}&token=${embedToken(id)}&lang=en`, {
    timeoutMs: 10_000,
  })
  const post = parseEmbed(await response.json())
  const [cover, ...rest] = post.media
  return cover ? { ...post, media: [{ ...cover, alt: cover.alt ?? alt }, ...rest] } : post
}

export async function fetchExamples(
  examples: ReadonlyArray<ModelExamples> = MODEL_EXAMPLES,
): Promise<XPostsPayload> {
  const requested = [
    ...new Map(
      examples.flatMap((example) => example.posts).map((post) => [post.url, post]),
    ).values(),
  ]
  const results = await Promise.allSettled(requested.map(fetchPost))
  const byUrl = new Map<string, XPost>()
  const dropped: XPostsPayload["dropped"] = []
  results.forEach((result, index) => {
    const { url } = requested[index]
    if (result.status === "fulfilled") byUrl.set(url, result.value)
    else dropped.push({ url, reason: String(result.reason) })
  })
  if (byUrl.size * 2 < requested.length)
    throw new Error(`X returned only ${byUrl.size} of ${requested.length} example posts`)

  return {
    groups: examples.map((example) => ({
      ...example,
      posts: example.posts.flatMap((post) => byUrl.get(post.url)?.id ?? []),
    })),
    posts: [...byUrl.values()],
    dropped,
  }
}

function listHash(values: ReadonlyArray<string>) {
  let hash = 5381
  for (const char of values.join("|")) hash = Math.imul(hash, 33) ^ char.charCodeAt(0)
  return (hash >>> 0).toString(36)
}

export const xPostsSource: SourceDefinition<XPostsPayload> = {
  name: "xPosts",
  cacheKey: `llm-scores:x-posts:${listHash(MODEL_EXAMPLES.flatMap((example) => [example.label, ...example.models, ...example.posts.flatMap((post) => [post.url, post.alt])]))}`,
  refreshWindowMs: 6 * 60 * 60 * 1000,
  fetchPayload: () => fetchExamples(),
}
