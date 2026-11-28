import type { XPost } from "#/server/api"

import {
  PostModels,
  X_POST_ROW_CLASS,
  XPostCard,
  type PostModel,
} from "#/ui/components/x-post-card"
import { vendorColor } from "#/ui/lib/model-view"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "X post card",
  components: ["dialog"],
  custom: { file: "src/ui/components/x-post-card.tsx", exports: "XPostCard, PostModels" },
}

const MARK = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2 22 12 12 22 2 12Z"/></svg>',
)}`

const ASTRA: PostModel = {
  displayName: "GPT-6.2 Astra",
  logoUrl: MARK,
  chartColor: vendorColor({ hue: 160, shade: 0 }),
}
const FABLE: PostModel = {
  displayName: "Claude Fable 5.2",
  logoUrl: MARK,
  chartColor: vendorColor({ hue: 25 }),
}
const UNLISTED: PostModel = {
  displayName: "A model the catalog doesn't list",
  logoUrl: null,
  chartColor: vendorColor({ hue: null }),
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

const photo: XPost["media"][number] = {
  kind: "photo",
  previewUrl: "https://pbs.twimg.com/media/HRt4TpTbUAAM4d0.jpg",
  width: 2530,
  height: 2506,
  alt: "Two scrambled Rubik's Cubes in front of a mirror",
  videoUrl: null,
  durationMs: null,
}
const wide = { ...photo, width: 2560, height: 1440 }

const CARDS: Array<{ post: XPost; models: Array<PostModel> }> = [
  { post: post("1", "A photo the model made.", [photo]), models: [ASTRA] },
  {
    post: post("2", "A video opens in the viewer and plays there.", [
      { ...wide, kind: "video", durationMs: 16068 },
    ]),
    models: [FABLE],
  },
  {
    post: post("3", "A comparison names every model it shows, and a wide plate takes more room.", [
      wide,
      photo,
      photo,
    ]),
    models: [ASTRA, FABLE],
  },
  {
    post: post("4", "A GIF, from a model with no logo.", [{ ...photo, kind: "gif" }]),
    models: [UNLISTED],
  },
  { post: post("5", "A post with no media shows its text on the plate.", []), models: [FABLE] },
]

export default function XPostCardDemo() {
  return (
    <Rows>
      <Row label="plates" className={`${X_POST_ROW_CLASS} items-start sm:[--row:7rem]`}>
        {CARDS.map((card) => (
          <XPostCard key={card.post.id} {...card} />
        ))}
      </Row>
      <Row label="models">
        <PostModels models={[FABLE]} />
        <PostModels models={[ASTRA, FABLE, UNLISTED]} />
      </Row>
    </Rows>
  )
}
