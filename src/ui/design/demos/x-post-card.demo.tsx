import type { XPost } from "#/server/api"

import { XPostCard } from "#/ui/components/x-post-card"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "X post card",
  components: [],
  custom: { file: "src/ui/components/x-post-card.tsx", exports: "XPostCard" },
}

const author = {
  name: "Dan",
  handle: "DanDr1s",
  avatarUrl: "https://pbs.twimg.com/profile_images/2021291774556372992/FMt8YoVI_bigger.jpg",
}

function post(id: string, text: string, media: XPost["media"]): XPost {
  return {
    id,
    url: `https://x.com/${author.handle}/status/${id}`,
    author,
    text,
    postedAt: "2026-09-08T19:11:04.000Z",
    likes: 2905,
    media,
  }
}

const photo = {
  previewUrl: "https://pbs.twimg.com/media/HRt4TpTbUAAM4d0.jpg",
  width: 2530,
  height: 2506,
  alt: "Two scrambled Rubik's Cubes in front of a mirror",
}

const POSTS = [
  post("1", "A photo the model made.", [{ ...photo, kind: "photo" }]),
  post("2", "A video or GIF the model made.", [{ ...photo, kind: "video" }]),
  post("3", "Several images in one post.", [
    { ...photo, kind: "photo" },
    { ...photo, kind: "photo" },
    { ...photo, kind: "photo" },
  ]),
  post("4", "A post with no media keeps its text and author.", []),
]

export default function XPostCardDemo() {
  return (
    <Rows>
      <Row label="states">
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
          {POSTS.map((item) => (
            <XPostCard key={item.id} post={item} />
          ))}
        </div>
      </Row>
    </Rows>
  )
}
