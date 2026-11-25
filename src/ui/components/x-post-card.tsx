import { RiHeart3Line, RiPlayFill } from "@remixicon/react"

import type { XPost } from "#/server/api"

import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { cn } from "#/ui/lib/utils"

export function XPostCard({ post, label }: { post: XPost; label?: string }) {
  const [cover, ...more] = post.media

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className="group/post bg-card ring-foreground/10 hover:ring-foreground/25 flex min-w-0 flex-col overflow-hidden rounded-lg ring-1 transition-shadow"
    >
      {cover ? (
        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
          <img
            src={cover.previewUrl}
            alt={cover.alt ?? ""}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover/post:scale-[1.03] motion-reduce:transition-none"
          />
          {cover.kind === "photo" ? null : (
            <span className="bg-background/80 absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-md">
              <RiPlayFill aria-hidden="true" className="size-3.5" />
            </span>
          )}
          {more.length > 0 ? (
            <span
              className={cn(
                COUNT_TEXT_CLASS,
                "bg-background/80 absolute right-2 bottom-2 rounded-md px-1.5",
              )}
            >
              +{more.length}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-3">
        {label ? <p className="text-muted-foreground text-xs font-medium">{label}</p> : null}
        <p className="line-clamp-3 text-sm/snug">{post.text}</p>
        <div className="text-muted-foreground mt-auto flex items-center gap-2 text-xs">
          <img
            src={post.author.avatarUrl}
            alt=""
            loading="lazy"
            className="size-4 shrink-0 rounded-full"
          />
          <span className="truncate">@{post.author.handle}</span>
          <span className={cn(COUNT_TEXT_CLASS, "ml-auto flex shrink-0 items-center gap-1")}>
            <RiHeart3Line aria-hidden="true" className="size-3" />
            {post.likes.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </a>
  )
}
