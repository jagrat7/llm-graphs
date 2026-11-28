import { waitUntil } from "@vercel/functions"

import { SourceCache } from "../cache/cache"
import {
  discover,
  discoveryStats,
  listPosts,
  setBlocked,
  submit,
  type BlockTarget,
  type DiscoveryModel,
  type PostFilter,
} from "./discovery"
import { xPostsSource } from "./x-posts"

let cache: SourceCache | undefined

/** Rebuilds the examples so a change to the kept posts shows straight away. */
async function refresh() {
  cache ??= new SourceCache()
  await cache.refreshNow(xPostsSource)
}

export const XPostsService = {
  async examples() {
    cache ??= new SourceCache()
    return (await cache.read(xPostsSource, waitUntil))?.payload ?? null
  },

  /** Finds new example posts on X, then refreshes the examples so they show. */
  async discover(models: ReadonlyArray<DiscoveryModel>) {
    const report = await discover(models)
    if (report.accepted.length > 0) await refresh()
    return report
  },

  /** Screens posts found elsewhere for one model, keeping the sure outputs. */
  async submit(
    posts: ReadonlyArray<string>,
    modelId: string,
    models: ReadonlyArray<DiscoveryModel>,
  ) {
    const report = await submit(posts, modelId, models)
    if (report.accepted.length > 0) await refresh()
    return report
  },

  async setBlocked(target: BlockTarget, blocked: boolean) {
    const result = await setBlocked(target, blocked)
    await refresh()
    return result
  },

  list: (filter: PostFilter) => listPosts(filter),
  stats: () => discoveryStats(),
}

export type { XPost, XPostsPayload } from "./x-posts"
export type { BlockTarget, DiscoveryModel, DiscoveryReport, PostFilter } from "./discovery"
