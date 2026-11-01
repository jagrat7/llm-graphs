/** The Graph paper setting: rulings on by default, off from the Settings dialog, kept by the cookie. */
export default async function paperGrid({ page, step, check, cookies }) {
  const frame = page.locator('[data-chart-frame="loaded"]')
  const loaded = () => frame.waitFor({ timeout: 60_000 })
  const settingsDialog = page.getByRole("dialog", { name: "Settings" })
  // The rulings group is in the SVG either way; off, it has no children.
  const lines = () =>
    page.evaluate(() => ({
      rulings: document.querySelectorAll(".chart-paper-ruling line").length,
      allLines: document.querySelectorAll(".ts-chart line").length,
    }))
  const settle = () => page.waitForTimeout(800)

  const before = await step("default chart has graph paper", async () => {
    await page.goto("/")
    await loaded()
    await settle()
    return { ...(await lines()), settings: (await cookies()).settings }
  })
  check(before.settings === null, "a fresh browser has no settings cookie")
  check(before.rulings > 0, `rulings drawn by default, got ${before.rulings}`)

  const toggled = await step("turn graph paper off in settings", async () => {
    await page.getByRole("button", { name: "Settings" }).click()
    await settingsDialog.waitFor()
    const toggle = settingsDialog.getByRole("switch", { name: /Graph paper/ })
    const wasOn = await toggle.isChecked()
    await toggle.click()
    await page.waitForFunction(() => document.cookie.includes("settings="))
    return { wasOn, nowOn: await toggle.isChecked(), settings: (await cookies()).settings }
  })
  check(toggled.wasOn && !toggled.nowOn, "the Graph paper switch flips from on to off")
  check(toggled.settings?.paperGrid === false, "settings cookie stores paperGrid: false")

  const after = await step("chart without graph paper", async () => {
    await page.keyboard.press("Escape")
    await settingsDialog.waitFor({ state: "hidden" })
    await settle()
    return await lines()
  })
  check(after.rulings === 0, `no rulings once off, got ${after.rulings}`)
  check(after.allLines > 0, "labelled gridlines and axes remain")

  const reloaded = await step("reload keeps graph paper off", async () => {
    await page.goto("/")
    await loaded()
    await settle()
    return await lines()
  })
  check(reloaded.rulings === 0, `still no rulings after reload, got ${reloaded.rulings}`)
}
