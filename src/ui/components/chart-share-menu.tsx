import {
  RiCheckLine,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiImageLine,
  RiLinkM,
  RiLoader4Line,
  RiShareLine,
  RiTableLine,
} from "@remixicon/react"
import { useEffect, useRef, useState } from "react"

import type { PlotImage } from "#/ui/lib/chart-image"
import type { PlotSources } from "#/ui/lib/chart-share"
import type { PlotData } from "#/ui/lib/comparison-plot-data"

import { Button } from "#/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "#/ui/components/ui/dropdown-menu"
import { APP_NAME } from "#/ui/lib/app-meta"
import { downloadBlob, shareCardBlob } from "#/ui/lib/chart-image"
import { plotCsv, shareFilename, shareSubtitle, shareTitle } from "#/ui/lib/chart-share"
import { useProvidersInfo } from "#/ui/lib/use-providers-info"
import { cn } from "#/ui/lib/utils"

/** Twice the CSS size, so the image stays sharp on a retina screen or a social card. */
const EXPORT_SCALE = 2
const STATUS_MS = 2000

type Status = { kind: "idle" | "busy" } | { kind: "done" | "error"; message: string }

/**
 * The chart's share menu: the link to this exact comparison, the chart as an image,
 * and the plotted numbers as CSV. The trigger reports each result in place, since the
 * menu has already closed by the time a copy or download finishes.
 */
export function ChartShareMenu({
  data,
  sources,
  renderPlot,
  getLink,
  className,
}: {
  data: PlotData
  sources: PlotSources
  /** Draws the plot as it stands. Called inside the click, so a WebGL frame is still readable. */
  renderPlot: (scale: number) => PlotImage | Promise<PlotImage>
  /** The page's link to this comparison; the address bar's URL when the page has none. */
  getLink?: () => string
  className?: string
}) {
  const info = useProvidersInfo()
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [canCopyImage, setCanCopyImage] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setCanCopyImage(typeof ClipboardItem !== "undefined" && navigator.clipboard?.write != null)

    return () => clearTimeout(resetTimer.current)
  }, [])

  function run(task: () => Promise<unknown>, done: string, failed: string) {
    if (status.kind === "busy") return

    clearTimeout(resetTimer.current)
    setStatus({ kind: "busy" })

    const settle = (next: Status) => {
      setStatus(next)
      resetTimer.current = setTimeout(() => setStatus({ kind: "idle" }), STATUS_MS)
    }

    // Started synchronously, not after a microtask, so the click still counts as the gesture.
    let pending: Promise<unknown>

    try {
      pending = task()
    } catch (error) {
      pending = Promise.reject(error)
    }

    pending.then(
      () => settle({ kind: "done", message: done }),
      () => settle({ kind: "error", message: failed }),
    )
  }

  async function imageBlob() {
    const plot = await renderPlot(EXPORT_SCALE)

    return shareCardBlob(
      plot,
      {
        title: shareTitle(data),
        subtitle: shareSubtitle(data, sources, info),
        credit: `${APP_NAME} · ${window.location.host}`,
      },
      EXPORT_SCALE,
    )
  }

  function copyLink() {
    run(
      () => navigator.clipboard.writeText(getLink?.() ?? window.location.href),
      "Link copied",
      "Couldn't copy link",
    )
  }

  function copyImage() {
    // Safari only grants the clipboard to a write started inside the click, so the
    // item takes the image as a promise rather than waiting for it first.
    run(
      () => navigator.clipboard.write([new ClipboardItem({ "image/png": imageBlob() })]),
      "Image copied",
      "Couldn't copy image",
    )
  }

  function downloadImage() {
    run(
      async () => downloadBlob(await imageBlob(), shareFilename(data, "png")),
      "Image saved",
      "Couldn't save image",
    )
  }

  function downloadCsv() {
    run(
      async () =>
        downloadBlob(
          // The byte-order mark makes Excel read the file as UTF-8, so "·" survives.
          new Blob([`﻿${plotCsv(data, sources, info)}`], { type: "text/csv;charset=utf-8" }),
          shareFilename(data, "csv"),
        ),
      "CSV saved",
      "Couldn't save CSV",
    )
  }

  const message = status.kind === "done" || status.kind === "error" ? status.message : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            // Matches the 3D view presets: a quiet ghost button that fills in only while open.
            <Button
              variant="ghost"
              size="sm"
              aria-busy={status.kind === "busy"}
              className={cn("text-muted-foreground px-2 font-normal", className)}
            />
          }
        >
          {status.kind === "busy" ? (
            <RiLoader4Line aria-hidden="true" className="animate-spin" />
          ) : status.kind === "done" ? (
            <RiCheckLine aria-hidden="true" />
          ) : status.kind === "error" ? (
            <RiErrorWarningLine aria-hidden="true" className="text-destructive" />
          ) : (
            <RiShareLine aria-hidden="true" />
          )}
          {message ?? "Share"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={copyLink}>
            <RiLinkM aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canCopyImage ? (
            <DropdownMenuItem onClick={copyImage}>
              <RiFileCopyLine aria-hidden="true" />
              Copy image
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={downloadImage}>
            <RiImageLine aria-hidden="true" />
            Download image
            <DropdownMenuShortcut>PNG</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={downloadCsv}>
            <RiTableLine aria-hidden="true" />
            Download data
            <DropdownMenuShortcut>CSV</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only" aria-live="polite">
        {message ?? ""}
      </span>
    </>
  )
}
