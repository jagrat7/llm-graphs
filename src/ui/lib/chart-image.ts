import { resolveCssColor } from "#/ui/lib/theme-colors"

/** A plot drawn at `scale` device pixels per CSS pixel; `width` and `height` are CSS pixels. */
export type PlotImage = { image: CanvasImageSource; width: number; height: number }

/** Marks the element whose `<defs>` and `<style>` a chart's SVG resolves masks against. */
export const CHART_EXPORT_DEFS_ATTRIBUTE = "data-chart-export-defs"

/**
 * Everything that paints an SVG mark. The app styles marks through CSS variables and
 * classes, neither of which survives into a standalone image, so each mark gets its
 * resolved value written onto it.
 */
const PAINT_PROPERTIES = [
  "color",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linejoin",
  "stroke-linecap",
  "stroke-dasharray",
  "paint-order",
  "opacity",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "font-variant-numeric",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "stop-color",
  "stop-opacity",
] as const

function inlinePaint(source: Element, clone: Element) {
  if (clone instanceof SVGElement) {
    const computed = getComputedStyle(source)

    for (const property of PAINT_PROPERTIES) {
      const value = computed.getPropertyValue(property)

      if (value) clone.style.setProperty(property, value)
    }
  }

  const cloneChildren = clone.children

  Array.from(source.children).forEach((child, index) => {
    const cloneChild = cloneChildren[index]

    if (cloneChild) inlinePaint(child, cloneChild)
  })
}

const sheetCache = new Map<string, Promise<CSSStyleSheet | null>>()
const fontCache = new Map<string, Promise<string | null>>()

/** Cross-origin sheets, such as Google Fonts, hide their rules until fetched directly. */
function fetchSheet(href: string) {
  let sheet = sheetCache.get(href)

  if (!sheet) {
    sheet = fetch(href)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(href))))
      .then((text) => {
        const parsed = new CSSStyleSheet()

        parsed.replaceSync(text)

        return parsed
      })
      .catch(() => null)
    sheetCache.set(href, sheet)
  }

  return sheet
}

function fetchDataUrl(url: string) {
  let data = fontCache.get(url)

  if (!data) {
    data = fetch(url)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(url))))
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader()

            reader.addEventListener("load", () =>
              resolve(typeof reader.result === "string" ? reader.result : null),
            )
            reader.addEventListener("error", () => resolve(null))
            reader.readAsDataURL(blob)
          }),
      )
      .catch(() => null)
    fontCache.set(url, data)
  }

  return data
}

type FontFaceSource = { rule: CSSFontFaceRule; base: string }

async function collectFontFaces(sheet: CSSStyleSheet, base: string, found: Array<FontFaceSource>) {
  let rules: CSSRuleList

  try {
    rules = sheet.cssRules
  } catch {
    const fetched = sheet.href ? await fetchSheet(sheet.href) : null

    if (fetched && sheet.href) await collectFontFaces(fetched, sheet.href, found)

    return
  }

  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSFontFaceRule) found.push({ rule, base })
    else if (rule instanceof CSSImportRule && rule.styleSheet) {
      await collectFontFaces(rule.styleSheet, new URL(rule.href, base).href, found)
    }
  }
}

function unquote(family: string) {
  return family.trim().replaceAll(/^["']|["']$/g, "")
}

/** Whether a `unicode-range` covers any of the code points; an absent range covers all. */
export function coversText(range: string, codePoints: ReadonlyArray<number>) {
  if (!range.trim()) return true

  return range.split(",").some((part) => {
    const token = part.trim().replace(/^U\+/i, "")
    const [start, end] = token.includes("?")
      ? [token.replaceAll("?", "0"), token.replaceAll("?", "F")]
      : token.split("-")
    const low = Number.parseInt(start, 16)
    const high = Number.parseInt(end ?? start, 16)

    return codePoints.some((point) => point >= low && point <= high)
  })
}

/**
 * `@font-face` rules for the families the text uses, with each font inlined as a data
 * URL. An SVG drawn as an image cannot load the page's web fonts, so without these its
 * labels fall back to a system face and stop fitting the layout measured in Inter.
 */
async function embeddedFontCss(families: ReadonlySet<string>, text: string) {
  const found: Array<FontFaceSource> = []

  for (const sheet of Array.from(document.styleSheets)) {
    await collectFontFaces(sheet, sheet.href ?? document.baseURI, found)
  }

  const codePoints = Array.from(new Set(text), (character) => character.codePointAt(0) ?? 0)
  const faces = await Promise.all(
    found.map(async ({ rule, base }) => {
      const style = rule.style
      const family = style.getPropertyValue("font-family")
      const range = style.getPropertyValue("unicode-range")

      if (!families.has(unquote(family)) || !coversText(range, codePoints)) return null

      const source = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(style.getPropertyValue("src"))?.[2]
      const data = source ? await fetchDataUrl(new URL(source, base).href) : null

      if (!data) return null

      return `@font-face{font-family:${family};font-style:${style.getPropertyValue("font-style") || "normal"};font-weight:${style.getPropertyValue("font-weight") || "normal"};src:url("${data}");${range ? `unicode-range:${range};` : ""}}`
    }),
  )

  return faces.filter((face) => face != null).join("")
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", () => reject(new Error("Unable to decode chart SVG")))
    image.src = url
  })
}

function scaledCanvas(width: number, height: number, scale: number) {
  const canvas = document.createElement("canvas")

  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const context = canvas.getContext("2d")

  if (!context) throw new Error("Canvas 2D is unavailable")

  context.scale(scale, scale)

  return { canvas, context }
}

/**
 * The mounted TanStack chart under `host` as standalone SVG markup: resolved paint,
 * the logo masks it borrows from a sibling SVG, and the fonts its labels were laid out
 * in. Focus rings and guides are left out, as the library's own exporter does.
 */
export async function standaloneChartSvg(host: Element, scale: number) {
  const svg = host.querySelector<SVGSVGElement>("svg.ts-chart")

  if (!svg) throw new Error("No chart to export")

  // The scene is laid out in viewBox units; the box on screen can lag it mid-resize.
  const bounds = svg.getBoundingClientRect()
  const viewBox =
    svg
      .getAttribute("viewBox")
      ?.trim()
      .split(/[\s,]+/)
      .map(Number) ?? []
  const width = viewBox[2] || bounds.width
  const height = viewBox[3] || bounds.height
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a deep clone keeps its element type
  const clone = svg.cloneNode(true) as SVGSVGElement

  inlinePaint(svg, clone)
  for (const layer of Array.from(clone.querySelectorAll("[data-ts-focus-layer]"))) layer.remove()

  const borrowed = host.querySelector(`[${CHART_EXPORT_DEFS_ATTRIBUTE}]`)

  for (const node of borrowed ? Array.from(borrowed.children).toReversed() : []) {
    clone.prepend(node.cloneNode(true))
  }

  // Every face the chart sets, not just the root's: the tick values read in the mono face.
  const families = new Set(
    [svg, ...Array.from(svg.querySelectorAll("text, tspan"))]
      .flatMap((node) => getComputedStyle(node).fontFamily.split(","))
      .map(unquote)
      .filter((family) => family !== ""),
  )
  const fontCss = await embeddedFontCss(families, clone.textContent ?? "")

  if (fontCss) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style")

    style.textContent = fontCss
    clone.prepend(style)
  }

  if (!clone.hasAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`)
  // Rasterized at the target density, so the image is drawn 1:1 rather than upscaled.
  clone.setAttribute("width", String(width * scale))
  clone.setAttribute("height", String(height * scale))

  // The serializer declares the SVG namespace itself; setting `xmlns` too would repeat it.
  return { markup: new XMLSerializer().serializeToString(clone), width, height }
}

export async function svgPlotImage(host: Element, scale: number): Promise<PlotImage> {
  const { markup, width, height } = await standaloneChartSvg(host, scale)
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }))

  try {
    const image = await loadImage(url)
    const { canvas, context } = scaledCanvas(width, height, scale)

    context.drawImage(image, 0, 0, width, height)

    return { image: canvas, width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Every ancestor's opacity up to `root`, which CSS composes but `getComputedStyle` reports singly. */
function effectiveOpacity(element: Element, root: Element) {
  let opacity = 1

  for (let node: Element | null = element; node; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity)
    if (node === root) break
  }

  return opacity
}

/** A label's rotation in radians, from the `rotate()` the 3D chart gives axis titles. */
function labelAngle(label: Element) {
  const transform = getComputedStyle(label).transform

  if (!transform || transform === "none") return 0

  const { a, b } = new DOMMatrix(transform)

  return Math.atan2(b, a)
}

/**
 * Draws the visible text of an HTML label layer where the browser laid it out, with
 * the background halo the labels wear on screen. Each text node is placed from its
 * own range, so stacked lines land where they are drawn. A rotated label (an axis
 * title following a cube edge) is a single line, drawn turned about its centre: its
 * range box is the rotated text's bounds, not where the text starts.
 */
function drawHtmlText(
  context: CanvasRenderingContext2D,
  layer: HTMLElement,
  origin: DOMRect,
  halo: string,
) {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  const range = document.createRange()

  context.lineJoin = "round"
  context.lineWidth = 3
  context.strokeStyle = halo

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ""
    const element = node.parentElement

    if (!text.trim() || !element) continue

    const opacity = effectiveOpacity(element, layer)

    if (opacity < 0.01) continue

    range.selectNodeContents(node)
    const box = range.getBoundingClientRect()

    if (box.width === 0 || box.height === 0) continue

    let label: Element = element

    while (label.parentElement && label.parentElement !== layer) label = label.parentElement

    const angle = labelAngle(label)
    const rotated = Math.abs(angle) > 0.001
    const style = getComputedStyle(element)

    context.save()
    context.globalAlpha = opacity
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    context.textBaseline = "middle"
    context.fillStyle = style.color

    if (rotated) {
      context.translate(
        box.left - origin.left + box.width / 2,
        box.top - origin.top + box.height / 2,
      )
      context.rotate(angle)
      context.textAlign = "center"
      context.strokeText(text, 0, 0)
      context.fillText(text, 0, 0)
    } else {
      const x = box.left - origin.left
      const y = box.top - origin.top + box.height / 2

      context.textAlign = "left"
      context.strokeText(text, x, y)
      context.fillText(text, x, y)
    }

    context.restore()
  }
}

/**
 * The 3D plot: the WebGL frame, rendered and read in one task so the drawing buffer
 * is still intact, with the HTML axis and point labels drawn over it.
 */
export function glPlotImage(
  plot: HTMLElement,
  renderFrame: () => HTMLCanvasElement,
  labels: HTMLElement | null,
  scale: number,
): PlotImage {
  const origin = plot.getBoundingClientRect()
  const { canvas, context } = scaledCanvas(origin.width, origin.height, scale)
  const frame = renderFrame()
  const frameBox = frame.getBoundingClientRect()

  context.drawImage(
    frame,
    frameBox.left - origin.left,
    frameBox.top - origin.top,
    frameBox.width,
    frameBox.height,
  )

  if (labels) drawHtmlText(context, labels, origin, resolveCssColor("var(--background)"))

  return { image: canvas, width: origin.width, height: origin.height }
}

function fitText(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text

  let fitted = text

  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > width) {
    fitted = fitted.slice(0, -1)
  }

  return `${fitted.trimEnd()}…`
}

const CARD_PADDING = 28
const TITLE_SIZE = 18
const SUBTITLE_SIZE = 13
const FOOTER_SIZE = 12
const HEADER_GAP = 20
const FOOTER_GAP = 16

export type ShareCardText = {
  title: string
  subtitle: string
  /** Bottom-left credit; the date the image was made sits opposite it. */
  credit: string
}

/**
 * The plot framed for sharing: a title and its sources above, credit and date below,
 * on the page's own background so the image matches what the reader was looking at.
 */
export async function shareCardBlob(plot: PlotImage, text: ShareCardText, scale: number) {
  await document.fonts.ready

  const width = Math.round(plot.width + CARD_PADDING * 2)
  const top = CARD_PADDING + TITLE_SIZE + 8 + SUBTITLE_SIZE + HEADER_GAP
  const height = Math.round(top + plot.height + FOOTER_GAP + FOOTER_SIZE + CARD_PADDING)
  const { canvas, context } = scaledCanvas(width, height, scale)
  const fontFamily = getComputedStyle(document.body).fontFamily
  const textWidth = width - CARD_PADDING * 2
  const muted = resolveCssColor("var(--muted-foreground)")

  context.fillStyle = resolveCssColor("var(--background)", "#ffffff")
  context.fillRect(0, 0, width, height)
  context.textBaseline = "top"

  context.font = `600 ${TITLE_SIZE}px ${fontFamily}`
  context.fillStyle = resolveCssColor("var(--foreground)", "#1a1a1a")
  context.fillText(fitText(context, text.title, textWidth), CARD_PADDING, CARD_PADDING)

  context.font = `400 ${SUBTITLE_SIZE}px ${fontFamily}`
  context.fillStyle = muted
  context.fillText(
    fitText(context, text.subtitle, textWidth),
    CARD_PADDING,
    CARD_PADDING + TITLE_SIZE + 8,
  )

  context.drawImage(plot.image, CARD_PADDING, top, plot.width, plot.height)

  const footerTop = top + plot.height + FOOTER_GAP
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  context.font = `400 ${FOOTER_SIZE}px ${fontFamily}`
  context.fillText(text.credit, CARD_PADDING, footerTop)
  context.textAlign = "right"
  context.fillText(date, width - CARD_PADDING, footerTop)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))),
      "image/png",
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Revoked on the next task, after the click has handed the URL to the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
