import { waitUntil } from "@vercel/functions"

import { SourceCache } from "../cache/cache"
import { xPostsSource } from "./x-posts"

let cache: SourceCache | undefined

export const XPostsService = {
  async examples() {
    cache ??= new SourceCache()
    return (await cache.read(xPostsSource, waitUntil))?.payload ?? null
  },
}

export type { XPost, XPostsPayload } from "./x-posts"
