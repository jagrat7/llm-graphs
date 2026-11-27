import { z } from "zod"

import type { SourceDefinition } from "../providers"

import { fetchOk } from "../providers/utils"
import { discoveredExamples } from "./discovery"
import type { ExamplePost, ModelExamples } from "./examples"

const EMBED_DATA = "https://cdn.syndication.twimg.com/tweet-result"
const STATUS_URL = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})$/

const mediaSchema = z.object({
  type: z.enum(["photo", "video", "animated_gif"]),
  media_url_https: z.url(),
  original_info: z.object({ width: z.number().positive(), height: z.number().positive() }),
  ext_alt_text: z.string().trim().min(1).nullish(),
  video_info: z
    .object({
      duration_millis: z.number().nonnegative().optional(),
      variants: z.array(
        z.object({ content_type: z.string(), url: z.url(), bitrate: z.number().optional() }),
      ),
    })
    .optional(),
})

type VideoVariants = NonNullable<z.infer<typeof mediaSchema>["video_info"]>["variants"]

const MAX_720P_BITRATE = 2_500_000

function videoUrl(variants: VideoVariants = []) {
  const files = variants
    .filter((variant) => variant.content_type === "video/mp4")
    .toSorted((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0))
  const fitting = files.find((variant) => (variant.bitrate ?? 0) <= MAX_720P_BITRATE)

  return (fitting ?? files.at(-1))?.url ?? null
}

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
    videoUrl: string | null
    durationMs: number | null
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
      videoUrl: videoUrl(media.video_info?.variants),
      durationMs: media.video_info?.duration_millis ?? null,
    })),
  }
}

export async function loadPost(id: string): Promise<XPost> {
  const response = await fetchOk("X", `${EMBED_DATA}?id=${id}&token=${embedToken(id)}&lang=en`, {
    timeoutMs: 10_000,
  })
  return parseEmbed(await response.json())
}

async function fetchPost({ url, alt }: ExamplePost): Promise<XPost> {
  const post = await loadPost(postId(url))
  const [cover, ...rest] = post.media
  return cover ? { ...post, media: [{ ...cover, alt: cover.alt ?? alt }, ...rest] } : post
}

export async function fetchExamples(
  examples: ReadonlyArray<ModelExamples>,
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
  if (requested.length > 0 && byUrl.size === 0) {
    throw new Error("X returned none of the example posts")
  }

  return {
    groups: examples.map((example) => ({
      ...example,
      posts: example.posts.flatMap((post) => byUrl.get(post.url)?.id ?? []),
    })),
    posts: [...byUrl.values()],
    dropped,
  }
}

export const xPostsSource: SourceDefinition<XPostsPayload> = {
  name: "xPosts",
  cacheKey: "llm-scores:x-posts:v3",
  refreshWindowMs: 6 * 60 * 60 * 1000,
  fetchPayload: async () => fetchExamples(await discoveredExamples()),
  validatePayload(payload, previous) {
    const loaded = payload.posts.length
    const requested = loaded + payload.dropped.length
    if (previous && loaded < previous.posts.length && loaded * 2 < requested)
      throw new Error(`X returned only ${payload.posts.length} of ${requested} example posts`)
  },
}
