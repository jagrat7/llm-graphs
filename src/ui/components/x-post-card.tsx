import type { CSSProperties } from "react"

import {
  RiArrowRightUpLine,
  RiHeart3Line,
  RiPlayFill,
  RiStackLine,
  RiTwitterXLine,
} from "@remixicon/react"

import type { XPost } from "#/server/api"

import type { PickableModel } from "#/ui/lib/model-view"

import { ModelLogo } from "#/ui/components/model-logo"
import { buttonVariants } from "#/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/ui/components/ui/dialog"
import { seriesLabelColor } from "#/ui/lib/plot-labels"
import { COUNT_TEXT_CLASS } from "#/ui/lib/text-styles"
import { cn } from "#/ui/lib/utils"

export type PostModel = Pick<PickableModel, "displayName" | "logoUrl" | "chartColor">

type Media = XPost["media"][number]
type RatioStyle = CSSProperties & { "--ratio": number }

export const X_POST_ROW_CLASS = "flex flex-wrap gap-x-3 gap-y-6 [--row:8.5rem] sm:[--row:14rem]"

const RATIO_RANGE = [3 / 4, 2.2] as const
const TEXT_RATIO = 4 / 3
const BADGE_CLASS = cn(
  COUNT_TEXT_CLASS,
  "bg-background/85 text-foreground flex h-5 items-center gap-1 rounded-sm px-1.5 text-2xs backdrop-blur-sm",
)

function plateRatio(cover: Media | undefined) {
  if (!cover) return TEXT_RATIO
  return Math.min(RATIO_RANGE[1], Math.max(RATIO_RANGE[0], cover.width / cover.height))
}

function clock(durationMs: number) {
  const seconds = Math.round(durationMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function postedOn(post: XPost) {
  return new Date(post.postedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function PostModels({
  models,
  className,
}: {
  models: ReadonlyArray<PostModel>
  className?: string
}) {
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      {models.map((model, index) => (
        <span key={model.displayName} className="contents">
          {index > 0 ? (
            <span className={cn(COUNT_TEXT_CLASS, "text-muted-foreground text-2xs font-normal")}>
              vs
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5">
            <ModelLogo logoUrl={model.logoUrl} color={model.chartColor} className="size-3.5" />
            <span className="truncate" style={{ color: seriesLabelColor(model.chartColor) }}>
              {model.displayName}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}

function PostMedia({ media, autoPlay }: { media: Media; autoPlay: boolean }) {
  const className = "block max-h-[calc(100dvh-2rem)] w-full object-contain"
  const style = { aspectRatio: `${media.width} / ${media.height}` }

  if (media.videoUrl) {
    return (
      <video
        src={media.videoUrl}
        poster={media.previewUrl}
        aria-label={media.alt ?? undefined}
        controls={media.kind === "video"}
        autoPlay={autoPlay || media.kind === "gif"}
        muted={media.kind === "gif"}
        loop={media.kind === "gif"}
        playsInline
        className={className}
        style={style}
      />
    )
  }

  return (
    <img
      src={`${media.previewUrl}?name=large`}
      alt={media.alt ?? ""}
      className={className}
      style={style}
    />
  )
}

export function XPostCard({
  post,
  models,
  className,
}: {
  post: XPost
  models: ReadonlyArray<PostModel>
  className?: string
}) {
  const [cover, ...more] = post.media
  const style: RatioStyle = { "--ratio": plateRatio(cover) }
  const credit = `@${post.author.handle}`

  return (
    <figure
      style={style}
      className={cn(
        "flex min-w-0 grow-(--ratio) basis-[calc(var(--ratio)*var(--row))] flex-col gap-2 sm:max-w-[calc(var(--ratio)*var(--row)*1.5)]",
        className,
      )}
    >
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className="border-border bg-muted hover:border-foreground/40 relative block aspect-(--ratio) w-full cursor-zoom-in overflow-hidden rounded-md border text-left transition-colors"
            />
          }
        >
          {cover ? (
            <img
              src={cover.previewUrl}
              alt={cover.alt ?? ""}
              loading="lazy"
              className="size-full object-cover object-top"
            />
          ) : (
            <span className="text-field line-clamp-6 p-3">{post.text}</span>
          )}
          <span className="absolute bottom-1.5 left-1.5 flex gap-1">
            {cover && cover.kind !== "photo" ? (
              <span className={BADGE_CLASS}>
                <RiPlayFill aria-hidden="true" className="size-3" />
                {cover.kind === "gif" ? "GIF" : cover.durationMs ? clock(cover.durationMs) : null}
              </span>
            ) : null}
            {more.length > 0 ? (
              <span className={BADGE_CLASS}>
                <RiStackLine aria-hidden="true" className="size-3" />
                {post.media.length}
              </span>
            ) : null}
          </span>
        </DialogTrigger>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-xl lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
          <DialogHeader className="p-4 lg:col-start-2">
            <DialogTitle render={<h2 />} className="text-field">
              <PostModels models={models} />
            </DialogTitle>
          </DialogHeader>
          {post.media.length > 0 ? (
            <div className="border-border bg-muted flex shrink-0 flex-col gap-px max-lg:border-y lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:overflow-y-auto lg:border-r">
              {post.media.map((media, index) => (
                <PostMedia
                  key={`${index}:${media.previewUrl}`}
                  media={media}
                  autoPlay={index === 0}
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-4 p-4 lg:col-start-2 lg:overflow-y-auto lg:pt-0">
            <DialogDescription className="text-field text-foreground wrap-anywhere whitespace-pre-line">
              {post.text}
            </DialogDescription>
            <div className="text-control flex items-center gap-2">
              <img
                src={post.author.avatarUrl}
                alt=""
                loading="lazy"
                className="size-8 shrink-0 rounded-full"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{post.author.name}</span>
                <span className="text-muted-foreground truncate">{credit}</span>
              </span>
            </div>
            <p
              className={cn(
                COUNT_TEXT_CLASS,
                "text-muted-foreground text-control flex items-center gap-3",
              )}
            >
              <time dateTime={post.postedAt}>{postedOn(post)}</time>
              <span className="flex items-center gap-1">
                <RiHeart3Line aria-label="Likes" className="size-3" />
                {post.likes.toLocaleString("en-US")}
              </span>
            </p>
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "self-start")}
            >
              <RiTwitterXLine aria-hidden="true" />
              Open post
              <RiArrowRightUpLine aria-hidden="true" data-icon="inline-end" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
      <figcaption className="flex min-w-0 flex-col gap-1">
        <PostModels models={models} className="text-field font-medium" />
        {cover ? (
          <p className="text-muted-foreground text-control/relaxed line-clamp-2 wrap-anywhere">
            {post.text}
          </p>
        ) : null}
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${credit} on X, opens in a new tab`}
          className="text-muted-foreground hover:text-foreground text-2xs flex min-h-5 items-center gap-1 self-start rounded-sm"
        >
          <RiTwitterXLine aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{credit}</span>
          <RiArrowRightUpLine aria-hidden="true" className="size-3 shrink-0" />
        </a>
      </figcaption>
    </figure>
  )
}
