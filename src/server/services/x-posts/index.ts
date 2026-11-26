import { waitUntil } from "@vercel/functions"

import { SourceCache } from "../cache/cache"
import { discover, type DiscoveryModel } from "./discovery"
import { xPostsSource } from "./x-posts"

let cache: SourceCache | undefined

export const XPostsService = {
  async examples() {
    cache ??= new SourceCache()
    return (await cache.read(xPostsSource, waitUntil))?.payload ?? null
  },

  /** Finds new example posts on X, then refreshes the examples so they show. */
  async discover(models: ReadonlyArray<DiscoveryModel>) {
    const report = await discover(models)
    cache ??= new SourceCache()
    if (report.accepted.length > 0) await cache.refreshNow(xPostsSource)
    return report
  },
}

export type { XPost, XPostsPayload } from "./x-posts"
export type { DiscoveryModel, DiscoveryReport } from "./discovery"
