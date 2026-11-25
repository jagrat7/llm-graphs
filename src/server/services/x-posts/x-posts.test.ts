import { expect, it } from "vitest"
import { parseEmbed, postId } from "./x-posts"

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
      },
    ],
  })

  expect(post).toMatchObject({
    url: "https://x.com/DanDr1s/status/2097402355251593558",
    text: "Passed the mirror test 🧊",
    author: { avatarUrl: "https://pbs.twimg.com/profile_images/1/a_bigger.jpg" },
    media: [{ kind: "gif", width: 2530, height: 2506 }],
  })
})

it("only takes links to posts on x.com", () => {
  expect(postId("https://x.com/cfryant/status/2107552426148745491")).toBe("2107552426148745491")
  expect(() => postId("https://example.com/cfryant/status/2107552426148745491")).toThrow()
})
