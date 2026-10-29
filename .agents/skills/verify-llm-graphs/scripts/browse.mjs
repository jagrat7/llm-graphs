/**
 * Runs one browser journey against a verify-llm-graphs server and records evidence for each step.
 * Started by `llmg browse <journey.mjs>`, which passes the run's URL and evidence directory.
 *
 * A journey file default-exports `async ({ page, context, base, step, check, cookies, saveDownload })`:
 *   step(label, fn)     runs fn, then saves a screenshot, an ARIA snapshot, the URL, and the app cookies
 *   check(ok, message)  fails the journey with `message` unless ok is truthy
 *   cookies()           the app's `settings` and `picked-models` cookies, decoded, or null when unset
 *   saveDownload(d)     saves a Playwright download into the evidence directory and returns its path
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    evidence: { type: "string" },
    name: { type: "string" },
    headed: { type: "boolean", default: false },
  },
})
const journeyPath = positionals[0]
if (!journeyPath || !values.base || !values.evidence) {
  console.error("usage: node browse.mjs <journey.mjs> --base <url> --evidence <dir> [--name N]")
  process.exit(2)
}

const require = createRequire(`${process.env.PLAYWRIGHT_ROOT}/`)
const { chromium } = require("playwright")

// A rerun in the same run gets its own directory, so a failed attempt's evidence stays intact.
const name = values.name ?? basename(journeyPath, ".mjs")
let dir = join(values.evidence, name)
for (let attempt = 2; existsSync(dir); attempt++) dir = join(values.evidence, `${name}-${attempt}`)
mkdirSync(dir, { recursive: true })
const log = (entry) => appendFileSync(join(dir, "steps.jsonl"), `${JSON.stringify(entry)}\n`)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium",
  headless: !values.headed,
})
const context = await browser.newContext({
  baseURL: values.base,
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
})
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: values.base })
const page = await context.newPage()
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    appendFileSync(join(dir, "console.txt"), `[${message.type()}] ${message.text()}\n`)
  }
})
page.on("pageerror", (error) => appendFileSync(join(dir, "console.txt"), `[pageerror] ${error}\n`))

async function cookies() {
  const jar = await context.cookies(values.base)
  const read = (cookie) => {
    const raw = jar.find((entry) => entry.name === cookie)?.value
    return raw == null ? null : JSON.parse(decodeURIComponent(raw))
  }
  return { settings: read("settings"), "picked-models": read("picked-models") }
}

let index = 0
async function step(label, fn) {
  index += 1
  const prefix = `${String(index).padStart(2, "0")}-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`
  const startedAt = new Date().toISOString()
  const value = await fn()
  await page.screenshot({ path: join(dir, `${prefix}.png`) })
  writeFileSync(join(dir, `${prefix}.aria.yml`), await page.locator("body").ariaSnapshot())
  const entry = { step: index, label, startedAt, url: page.url(), cookies: await cookies(), value }
  log(entry)
  console.log(`ok    ${index}. ${label}${value === undefined ? "" : ` → ${JSON.stringify(value)}`}`)
  return value
}

function check(ok, message) {
  if (!ok) throw new Error(`check failed: ${message}`)
}

async function saveDownload(download) {
  const path = join(dir, download.suggestedFilename())
  await download.saveAs(path)
  return path
}

const journey = (await import(pathToFileURL(resolve(journeyPath)).href)).default
let failure = null
try {
  await journey({ page, context, base: values.base, step, check, cookies, saveDownload })
} catch (error) {
  failure = error
  await page.screenshot({ path: join(dir, "failure.png") }).catch(() => {})
  log({ step: index + 1, failed: String(error?.message ?? error), url: page.url() })
  console.error(`FAIL  ${error?.message ?? error}`)
}
await browser.close()
writeFileSync(join(dir, "result.json"), JSON.stringify({ journey: journeyPath, ok: !failure, steps: index }, null, 2))
console.log(`evidence: ${dir}`)
process.exit(failure ? 1 : 0)
