/**
 * Renders `dev/app-icon.html` to `public/logo512.png` and `public/logo192.png`
 * with headless Chromium. Needs network access for the Bebas Neue webfont.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
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
await send("Page.navigate", { url: `file://${root}/dev/app-icon.html` })
await sleep(5000)
const { data } = await send("Page.captureScreenshot", { format: "png" })
fs.writeFileSync(path.join(root, "public/logo512.png"), Buffer.from(data, "base64"))
chrome.kill("SIGKILL")
console.log("wrote public/logo512.png")
process.exit(0)
