/** Fresh-reader defaults (Pareto off, linear axes), log in the link, and settings saved as changes only. */
export default async function logAndDefaults({ page, step, check, cookies }) {
  const loaded = () => page.locator('[data-chart-frame="loaded"]').waitFor({ timeout: 60_000 })
  const pareto = page.getByRole("button", { name: "Pareto frontier" })
  const logCost = page.getByRole("button", { name: "Log scale for Task cost" })
  const frame = page.locator('[data-chart-frame="loaded"]')
  const pressed = async (button) => (await button.getAttribute("aria-pressed")) === "true"
  const settings = async () => (await cookies()).settings

  const fresh = await step("open as a fresh reader", async () => {
    await page.goto("/")
    await loaded()
    return {
      pareto: await pressed(pareto),
      logCost: await pressed(logCost),
      logText: (await frame.textContent()).includes("log scale"),
      settings: await settings(),
    }
  })
  check(fresh.settings === null, "a fresh browser has no settings cookie")
  check(!fresh.pareto, "Pareto starts off")
  check(!fresh.logCost && !fresh.logText, "Task cost starts linear")

  const logged = await step("turn on log for Task cost", async () => {
    await logCost.click()
    await page.waitForFunction(() => (new URLSearchParams(location.search).get("log") ?? "").includes("cost"))
    return { url: page.url(), logCost: await pressed(logCost), logText: (await frame.textContent()).includes("log scale") }
  })
  check(logged.logCost && logged.logText, "Task cost is drawn on a log scale")

  const shared = await step("copy the share link", async () => {
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("menuitem", { name: /Copy link/ }).click()
    await page.waitForTimeout(300)
    return { link: await page.evaluate(() => navigator.clipboard.readText()) }
  })
  // The router writes arrays as JSON, as it does for `models`: log=["cost"].
  check(new URL(shared.link).searchParams.get("log") === '["cost"]', `the share link carries log, got ${shared.link}`)

  const opened = await step("open the shared link in place", async () => {
    await page.goto(shared.link)
    await loaded()
    return { logCost: await pressed(logCost), logText: (await frame.textContent()).includes("log scale") }
  })
  check(opened.logCost && opened.logText, "the shared link opens on a log scale")

  const handWritten = await step("open a hand-written log=cost link", async () => {
    await page.goto("/?x=cost&y=score&log=cost")
    await loaded()
    return { logCost: await pressed(logCost) }
  })
  check(handWritten.logCost, "a plain log=cost, as llms.txt documents, works too")

  const linear = await step("turn log back off", async () => {
    await logCost.click()
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("log"))
    return { url: page.url(), logCost: await pressed(logCost) }
  })
  check(!linear.logCost, "Task cost back to linear, and log left the link")

  const frontierOn = await step("turn Pareto on from the toolbar", async () => {
    await pareto.click()
    await page.waitForTimeout(300)
    return { pareto: await pressed(pareto), settings: await settings() }
  })
  check(frontierOn.pareto, "Pareto toggled on")
  check(
    JSON.stringify(frontierOn.settings) === JSON.stringify({ paretoFrontier: true }),
    `cookie holds only the change, got ${JSON.stringify(frontierOn.settings)}`,
  )

  const menu = await step("turn provider logos off in Settings", async () => {
    await page.getByRole("button", { name: "Settings" }).click()
    const dialog = page.getByRole("dialog", { name: "Settings" })
    await dialog.waitFor()
    const paretoSwitch = dialog.getByRole("switch", { name: "Pareto frontier" })
    const logos = dialog.getByRole("switch", { name: "Provider logos" })
    const paretoChecked = await paretoSwitch.getAttribute("aria-checked")
    await logos.click()
    await page.waitForTimeout(300)
    return { paretoChecked, logos: await logos.getAttribute("aria-checked"), settings: await settings() }
  })
  check(menu.paretoChecked === "true", "the menu's Pareto switch matches the toolbar")
  check(menu.logos === "false", "Provider logos switched off")
  check(
    JSON.stringify(menu.settings) === JSON.stringify({ paretoFrontier: true, vendorLogos: false }),
    `cookie holds both changes only, got ${JSON.stringify(menu.settings)}`,
  )

  const reset = await step("reset to defaults", async () => {
    await page.getByRole("button", { name: "Reset to defaults" }).click()
    await page.waitForTimeout(300)
    return { settings: await settings() }
  })
  check(reset.settings === null, "resetting deletes the cookie")
}
