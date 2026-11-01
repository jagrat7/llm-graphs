import { Img, staticFile, useCurrentFrame } from "remotion"

import { HEADLINE } from "./layout"
import { useTheme } from "./theme-context"
import { at, easeInOut, easeInOutSoft, easeOut, FONT, lerp, progress } from "./theme"

/** Remix Icon paths (24×24), the icons chart-share-menu.tsx uses. */
const ICON = {
  share:
    "M13.1202 17.0228L8.92129 14.7324C8.19135 15.5125 7.15261 16 6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C7.15255 8 8.19125 8.48746 8.92118 9.26746L13.1202 6.97713C13.0417 6.66441 13 6.33707 13 6C13 3.79086 14.7909 2 17 2C19.2091 2 21 3.79086 21 6C21 8.20914 19.2091 10 17 10C15.8474 10 14.8087 9.51251 14.0787 8.73246L9.87977 11.0228C9.9583 11.3355 10 11.6629 10 12C10 12.3371 9.95831 12.6644 9.87981 12.9771L14.0788 15.2675C14.8087 14.4875 15.8474 14 17 14C19.2091 14 21 15.7909 21 18C21 20.2091 19.2091 22 17 22C14.7909 22 13 20.2091 13 18C13 17.6629 13.0417 17.3355 13.1202 17.0228ZM6 14C7.10457 14 8 13.1046 8 12C8 10.8954 7.10457 10 6 10C4.89543 10 4 10.8954 4 12C4 13.1046 4.89543 14 6 14ZM17 8C18.1046 8 19 7.10457 19 6C19 4.89543 18.1046 4 17 4C15.8954 4 15 4.89543 15 6C15 7.10457 15.8954 8 17 8ZM17 20C18.1046 20 19 19.1046 19 18C19 16.8954 18.1046 16 17 16C15.8954 16 15 16.8954 15 18C15 19.1046 15.8954 20 17 20Z",
  link: "M17.6567 14.8284L16.2425 13.4142L17.6567 12C19.2188 10.4379 19.2188 7.90524 17.6567 6.34314C16.0946 4.78105 13.5619 4.78105 11.9998 6.34314L10.5856 7.75736L9.17139 6.34314L10.5856 4.92893C12.9287 2.58578 16.7277 2.58578 19.0709 4.92893C21.414 7.27208 21.414 11.0711 19.0709 13.4142L17.6567 14.8284ZM14.8282 17.6569L13.414 19.0711C11.0709 21.4142 7.27189 21.4142 4.92875 19.0711C2.5856 16.7279 2.5856 12.9289 4.92875 10.5858L6.34296 9.17157L7.75717 10.5858L6.34296 12C4.78086 13.5621 4.78086 16.0948 6.34296 17.6569C7.90506 19.2189 10.4377 19.2189 11.9998 17.6569L13.414 16.2426L14.8282 17.6569ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z",
  copy: "M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z",
  image:
    "M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z",
  table:
    "M4 8H20V5H4V8ZM14 19V10H10V19H14ZM16 19H20V10H16V19ZM8 19V10H4V19H8ZM3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3Z",
  check: "M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z",
} as const

/** The app's menu at three times its CSS size, so the 12px control step reads at 36px. */
const S = 3
const MENU = { left: HEADLINE.x, top: 318, width: 176 * S, pad: 4 * S }
const ROW = 32 * S
const SEPARATOR = 9 * S
const TRIGGER = { height: 24 * S, top: MENU.top - 24 * S - 4 * S }

type Item = { icon: keyof typeof ICON; label: string; shortcut?: string }

/** chart-share-menu.tsx, in order: the link, the image twice, then the data. */
const GROUPS: Array<Array<Item>> = [
  [{ icon: "link", label: "Copy link" }],
  [
    { icon: "copy", label: "Copy image" },
    { icon: "image", label: "Download image", shortcut: "PNG" },
  ],
  [{ icon: "table", label: "Download data", shortcut: "CSV" }],
]

/** Each row's top inside the menu, separators included. */
const ROWS = GROUPS.flatMap((group, g) =>
  group.map((item, i) => ({
    ...item,
    y: MENU.pad + (GROUPS.slice(0, g).reduce((n, prev) => n + prev.length, 0) + i) * ROW + g * SEPARATOR,
  })),
)
const DOWNLOAD_IMAGE = ROWS.findIndex((row) => row.label === "Download image")

// Bar 14: the trigger just after the downbeat (as the chart settles), the menu on beat 2, the highlight on "Copy link" on beat 3
// and down to "Download image" on beat 4. The bar-15 downbeat picks it: the menu closes, the
// trigger reports "Image saved" as the app's does, and the saved image lands on the chart it was
// taken from, lifts off it, and settles back just before the chart turns into the cube (bar 17).
export const SHARE_CUES = {
  trigger: at(14) + 4,
  open: at(14, 1) + 2,
  firstRow: at(14, 2),
  moveRow: at(14, 3),
  pick: at(15),
  card: at(15) + 6,
  settle: at(17) - 14,
} as const

/** Short crossfades between the chart and its image, so the two are rarely seen at once. */
const LAND = 8
const SETTLE = 10

/** The beat ends as the chart starts to turn (Chart.tsx). */
const SHARE_END = at(17)

/**
 * The PNG the app's "Download image" saved for the default 2D chart (DeepSWE score against task
 * cost, log scale), 1648×1142 at 2× scale. Shown at its own aspect, right of the trigger.
 */
const CARD = { width: 1097, height: 760, right: 56, top: 206 }
const CARD_LEFT = 1920 - CARD.right - CARD.width
const PNG = { width: 1648, plot: { left: 173.5, right: 1574.5, top: 216.5, bottom: 993.5 } }
const K = CARD.width / PNG.width

/** Where the image's plot frame falls on screen; the live chart pulls back into it. */
export const SHARE_PLOT = {
  x: CARD_LEFT + PNG.plot.left * K,
  y: CARD.top + PNG.plot.top * K,
  width: (PNG.plot.right - PNG.plot.left) * K,
  height: (PNG.plot.bottom - PNG.plot.top) * K,
}

/** The image's axes, read off its ticks: $0.5 to $20 a doubling every 213.5 px, 20% to 80%. */
export const SHARE_DOMAIN = {
  x: [0.5 * 2 ** ((PNG.plot.left - 318.5) / 213.5), 0.5 * 2 ** ((PNG.plot.right - 318.5) / 213.5)] as [number, number],
  y: [20, 80] as [number, number],
}

/** How much the saved image covers the chart; the chart steps out from under it meanwhile. */
export function shareCover(frame: number) {
  return progress(frame, SHARE_CUES.card, LAND, easeOut) * (1 - progress(frame, SHARE_CUES.settle, SETTLE, easeInOutSoft))
}

export function ShareMenu() {
  const frame = useCurrentFrame()
  const T = useTheme()
  if (frame < SHARE_CUES.trigger || frame > SHARE_END) return null

  const leave = progress(frame, SHARE_END - 10, 10, easeOut)
  const triggerOn = progress(frame, SHARE_CUES.trigger, 14, easeOut) * (1 - leave)
  const open = progress(frame, SHARE_CUES.open, 9, easeOut)
  const close = progress(frame, SHARE_CUES.pick + 3, 7, easeOut)
  // The image fades in exactly over the plot it shows, then lifts off the sheet; it settles back
  // and clears before the turn, leaving the same chart where it was.
  const land = progress(frame, SHARE_CUES.card, LAND, easeOut)
  const settle = progress(frame, SHARE_CUES.settle, SETTLE, easeInOutSoft)
  const lift = progress(frame, SHARE_CUES.card + 6, 20, easeOut) * (1 - settle)
  const radius = lerp(0, (T.dark ? 8 : 5) * 2, lift)
  const menu = open * (1 - close)
  const highlightOn = progress(frame, SHARE_CUES.firstRow, 6, easeOut)
  const highlightY = lerp(ROWS[0].y, ROWS[DOWNLOAD_IMAGE].y, progress(frame, SHARE_CUES.moveRow, 12, easeInOut))
  const saved = frame >= SHARE_CUES.pick + 3
  const expanded = open > 0 && !saved

  return (
    <>
      {land > 0 && (
        <div
          style={{
            position: "absolute",
            left: CARD_LEFT,
            top: CARD.top,
            width: CARD.width,
            height: CARD.height,
            opacity: land * (1 - settle),
            transform: `translateY(${lerp(0, -10, lift)}px) scale(${lerp(1, 0.985, lift)})`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, borderRadius: radius, boxShadow: T.float, opacity: lift }} />
          <Img
            src={staticFile(T.dark ? "share/score-vs-cost-dark.png" : "share/score-vs-cost-light.png")}
            style={{ position: "absolute", inset: 0, width: CARD.width, height: CARD.height, borderRadius: radius }}
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 1920 - (MENU.left + MENU.width),
          top: TRIGGER.top,
          height: TRIGGER.height,
          display: "flex",
          alignItems: "center",
          gap: 6 * S,
          padding: `0 ${8 * S}px`,
          borderRadius: (T.dark ? 7 : 4) * S,
          background: expanded ? (T.dark ? "oklch(0.92 0 0 / 0.12)" : "oklch(0.23 0.022 262 / 0.12)") : "transparent",
          color: expanded || saved ? T.ink : T.graphite,
          fontFamily: FONT.sans,
          fontSize: 12 * S,
          fontWeight: 500,
          opacity: triggerOn,
          transform: `translateY(${lerp(6, 0, triggerOn)}px)`,
        }}
      >
        <Icon d={saved ? ICON.check : ICON.share} size={14 * S} color="currentColor" />
        {saved ? "Image saved" : "Share"}
      </div>
      {menu > 0 && (
        <div
          style={{
            position: "absolute",
            left: MENU.left,
            top: MENU.top,
            width: MENU.width,
            boxSizing: "border-box",
            padding: MENU.pad,
            background: T.sheet,
            borderRadius: (T.dark ? 8 : 5) * S,
            boxShadow: T.float,
            fontFamily: FONT.sans,
            fontSize: 12 * S,
            fontWeight: 500,
            color: T.ink,
            opacity: menu,
            // zoom-in-95 and slide-in-from-top-2, from the trigger's corner (align="end").
            transformOrigin: "100% 0",
            transform: `translateY(${lerp(-2 * S, 0, open)}px) scale(${lerp(0.95, 1, menu)})`,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: highlightY - MENU.pad,
                height: ROW,
                borderRadius: (T.dark ? 6 : 4) * S,
                background: T.wash,
                opacity: highlightOn,
              }}
            />
            {GROUPS.map((group, g) => (
              <div key={g}>
                {g > 0 && <div style={{ height: 1.5, margin: `${(SEPARATOR - 1.5) / 2}px ${-4 * S}px`, background: T.ruling, opacity: 0.5 }} />}
                {group.map((item) => {
                  const row = ROWS.findIndex((r) => r.label === item.label)
                  const lit = highlightOn > 0 && Math.abs(highlightY - ROWS[row].y) < ROW / 2
                  return (
                    <div
                      key={item.label}
                      style={{
                        position: "relative",
                        height: ROW,
                        display: "flex",
                        alignItems: "center",
                        gap: 8 * S,
                        padding: `0 ${8 * S}px`,
                        color: lit ? T.washInk : T.ink,
                      }}
                    >
                      <Icon d={ICON[item.icon]} size={14 * S} color="currentColor" />
                      {item.label}
                      {item.shortcut && (
                        <span style={{ marginLeft: "auto", fontFamily: FONT.mono, fontSize: 11 * S, color: lit ? T.washInk : T.graphite }}>
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Icon({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d={d} fill={color} />
    </svg>
  )
}
