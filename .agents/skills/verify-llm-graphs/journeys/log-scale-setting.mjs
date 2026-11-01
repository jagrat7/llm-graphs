/** The Log scale setting opens log-capable axes on log, while the link still sets one back to linear. */
export default async function logScaleSetting({ page, context, step, check, cookies }) {
  const loaded = () => page.locator('[data-chart-frame="loaded"]').waitFor({ timeout: 120_000 })
  const logCost = page.getByRole("button", { name: "Log scale for Task cost" })
  const pressed = async (button) => (await button.getAttribute("aria-pressed")) === "true"
  const param = (name) => new URL(page.url()).searchParams.get(name)
  const dialog = page.getByRole("dialog", { name: "Settings" })

  const opened = await step("open settings", async () => {
    await page.goto("/")
    await loaded()
    // The open dialog hides the chart from the accessibility tree, so read the axis first.
    const linearAtFirst = !(await pressed(logCost))
    await page.getByRole("button", { name: "Settings" }).click()
    await dialog.waitFor()
    await page.waitForTimeout(400)
    const text = await dialog.textContent()
    return { effortLevels: text.includes("Effort levels"), logScale: text.includes("Log scale"), logCost: !linearAtFirst }
  })
  check(!opened.effortLevels, "the Effort levels setting is gone")
  check(opened.logScale, "the dialog has a Log scale setting")
  check(!opened.logCost, "Task cost starts linear")

  const on = await step("turn on Log scale", async () => {
    await dialog.getByRole("switch", { name: "Log scale" }).click()
    await page.waitForTimeout(300)
    return { settings: (await cookies()).settings }
  })
  check(JSON.stringify(on.settings) === JSON.stringify({ logScale: true }), `cookie holds logScale only, got ${JSON.stringify(on.settings)}`)

  const drawn = await step("close settings, chart on log", async () => {
    await page.getByRole("button", { name: "Done" }).click()
    await dialog.waitFor({ state: "hidden" })
    return { logCost: await pressed(logCost), log: param("log"), linear: param("linear") }
  })
  check(drawn.logCost, "Task cost is on log from the setting alone")
  check(drawn.log === null && drawn.linear === null, "the setting writes nothing into the link")

  const off = await step("switch Task cost back to linear", async () => {
    await logCost.click()
    await page.waitForFunction(() => new URLSearchParams(location.search).has("linear"))
    return { logCost: await pressed(logCost), linear: param("linear") }
  })
  check(!off.logCost && off.linear === '["cost"]', `the link keeps cost linear, got linear=${off.linear}`)

  const back = await step("switch Task cost to log again", async () => {
    await logCost.click()
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("linear"))
    return { logCost: await pressed(logCost), log: param("log"), linear: param("linear") }
  })
  check(back.logCost && back.log === null && back.linear === null, "back on the setting, the link is clean")

  const reloaded = await step("reload keeps the setting", async () => {
    await page.reload()
    await loaded()
    return { logCost: await pressed(logCost) }
  })
  check(reloaded.logCost, "the cookie keeps Task cost on log after a reload")

  const shared = await step("copy the share link", async () => {
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("menuitem", { name: /Copy link/ }).click()
    await page.waitForTimeout(300)
    return { link: await page.evaluate(() => navigator.clipboard.readText()) }
  })
  check(new URL(shared.link).searchParams.get("log") === '["cost"]', `the share link pins log, got ${shared.link}`)

  const other = await step("open the share link without the setting", async () => {
    await context.clearCookies()
    await page.goto(shared.link)
    await loaded()
    return { logCost: await pressed(logCost), settings: (await cookies()).settings }
  })
  check(other.settings === null, "this reader has no settings")
  check(other.logCost, "the shared link still opens on log")
}
