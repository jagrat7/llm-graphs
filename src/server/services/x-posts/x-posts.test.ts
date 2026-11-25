import { expect, it } from "vitest"
import { parseEmbed, postId, xPostsSource, type XPostsPayload } from "./x-posts"

it("reads a post from X's embed data without its trailing media link", () => {
  const post = parseEmbed({
    id_str: "2097402355251593558",
    text: "Passed the mirror test 🧊 https://t.co/dmH0AAdk2z",
    display_text_range: [0, 24],
    created_at: "2026-09-08T19:11:04.000Z",
    favorite_count: 2905,
    user: {
      name: "Dan",
      screen_name: "DanDr1s",
      profile_image_url_https: "https://pbs.twimg.com/profile_images/1/a_normal.jpg",
    },
    mediaDetails: [
      {
        type: "animated_gif",
        media_url_https: "https://pbs.twimg.com/tweet_video_thumb/a.jpg",
        original_info: { width: 2530, height: 2506 },
        ext_alt_text: "Two cubes and their reflection",
      },
    ],
  })

  expect(post).toMatchObject({
    url: "https://x.com/DanDr1s/status/2097402355251593558",
    text: "Passed the mirror test 🧊",
    author: { avatarUrl: "https://pbs.twimg.com/profile_images/1/a_bigger.jpg" },
    media: [{ kind: "gif", width: 2530, height: 2506, alt: "Two cubes and their reflection" }],
  })
})

it("only takes links to posts on x.com", () => {
  expect(postId("https://x.com/cfryant/status/2107552426148745491")).toBe("2107552426148745491")
  expect(() => postId("https://example.com/cfryant/status/2107552426148745491")).toThrow()
})

it("keeps the last copy only over a refresh that loads fewer posts and loses most", () => {
  const post = parseEmbed({
    id_str: "1",
    text: "One that loaded",
    display_text_range: [0, 15],
    created_at: "2026-09-08T19:11:04.000Z",
    favorite_count: 1,
    user: { name: "A", screen_name: "a", profile_image_url_https: "https://pbs.twimg.com/a.jpg" },
  })
  const partial: XPostsPayload = {
    groups: [],
    posts: [post],
    dropped: [
      { url: "https://x.com/a/status/2", reason: "X returned 503" },
      { url: "https://x.com/a/status/3", reason: "X returned 503" },
    ],
  }

  const full: XPostsPayload = { ...partial, posts: [post, post, post], dropped: [] }

  expect(() => xPostsSource.validatePayload?.(partial)).not.toThrow()
  expect(() => xPostsSource.validatePayload?.(partial, full)).toThrow("only 1 of 3")
  expect(() => xPostsSource.validatePayload?.(partial, partial)).not.toThrow()
  expect(() => xPostsSource.validatePayload?.(full, partial)).not.toThrow()
})
