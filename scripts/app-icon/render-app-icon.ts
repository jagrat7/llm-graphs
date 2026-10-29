/**
 * Renders `scripts/app-icon/app-icon.html` with headless Chromium, then derives every icon
 * size from it with ImageMagick: the 512/192 app icons, the 96px PNG favicon,
 * and a multi-size ICO. Every size keeps the full seal, ring text included, on a
 * transparent background. Needs network access for the Bebas Neue webfont.
 */
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..")
const port = 9345
const chrome = spawn(
  "chromium",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-extensions",
    `--user-data-dir=${fs.mkdtempSync("/tmp/app-icon-")}`,
    `--remote-debugging-port=${port}`,
    "--window-size=512,512",
  ],
  { stdio: "ignore" },
)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let page: { webSocketDebuggerUrl: string } | undefined
for (let i = 0; i < 60 && !page; i++) {
  try {
    const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    if (Array.isArray(targets)) page = targets.find((t) => t.type === "page")
  } catch {
    await sleep(250)
  }
}
if (!page) throw new Error("Chromium did not expose a page target")
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener("open", r))
let id = 0
const pending = new Map<number, (v: any) => void>()
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data))
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)!(m.result)
    pending.delete(m.id)
  }
})
const send = (method: string, params: object = {}) =>
  new Promise<any>((r) => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })

await send("Emulation.setDeviceMetricsOverride", {
  width: 512,
  height: 512,
  deviceScaleFactor: 1,
  mobile: false,
})
// Transparent page background so the PNGs carry alpha instead of Chromium's white.
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
await send("Page.navigate", { url: `file://${root}/scripts/app-icon/app-icon.html` })
await sleep(5000)
const { data } = await send("Page.captureScreenshot", { format: "png" })
const master = path.join(root, "public/logo512.png")
fs.writeFileSync(master, Buffer.from(data, "base64"))
chrome.kill("SIGKILL")

const pub = (name: string) => path.join(root, "public", name)
const resize = (size: number, out: string) =>
  execFileSync("magick", [master, "-resize", `${size}x${size}`, "PNG32:" + out])
resize(192, pub("logo192.png"))
resize(96, pub("favicon-96.png"))
const tmp = fs.mkdtempSync("/tmp/favicon-")
const sizes = [16, 32, 48, 64]
for (const s of sizes) resize(s, path.join(tmp, `${s}.png`))
execFileSync("magick", [...sizes.map((s) => path.join(tmp, `${s}.png`)), pub("favicon.ico")])
console.log("wrote logo512.png, logo192.png, favicon-96.png, favicon.ico")
process.exit(0)
