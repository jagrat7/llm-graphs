/** Picker add/remove, persistence, and Reset from features/model-picks.md, driven as a reader. */
export default async function modelPicks({ page, step, check, cookies }) {
  const trigger = page.getByRole("button", { name: /^Models \d+$/ })
  const picker = page.getByRole("dialog", { name: "Models" })
  const count = async () => Number((await trigger.textContent()).replaceAll(/\D+/g, ""))
  // Visible chips only; the rest sit behind "Show N more selected models". The visible chips'
  // remove buttons have no accessible name, so they are found by data-slot instead.
  const chips = page.locator('[data-slot="combobox-chip"]')
  const chipNames = async () => (await chips.allTextContents()).map((text) => text.trim())
  const picks = async () => (await cookies())["picked-models"]

  // The chart frame loads once the browser has the snapshot, and the controls enable with it.
  const loaded = () => page.locator('[data-chart-frame="loaded"]').waitFor({ timeout: 60_000 })

  const defaults = await step("open default page", async () => {
    await page.goto("/")
    await loaded()
    return { count: await count(), chips: await chipNames(), saved: await picks() }
  })
  check(defaults.saved === null, "a fresh browser has no saved picks")
  check(defaults.count >= 2, "default comparison has at least two models")

  const added = await step("check an unpicked model in the picker", async () => {
    await trigger.click()
    await picker.waitFor()
    const box = picker.getByRole("checkbox", { checked: false }).first()
    const label = (await box.locator("xpath=ancestor::label").textContent()).trim()
    await box.click()
    await page.waitForURL(/models=/)
    return { label, count: await count(), saved: await picks() }
  })
  check(added.count === defaults.count + 1, `count rose to ${defaults.count + 1}, got ${added.count}`)
  check(added.saved?.length === added.count, "picked-models cookie holds every pick after adding")

  const removed = await step("remove the first chip", async () => {
    await page.keyboard.press("Escape")
    await picker.waitFor({ state: "hidden" })
    const label = (await chips.first().textContent()).trim()
    await chips.first().locator('[data-slot="combobox-chip-remove"]').click()
    await page.getByRole("button", { name: `Models ${added.count}`, exact: true }).waitFor({ state: "detached" })
    return { label, count: await count(), chips: await chipNames(), saved: await picks() }
  })
  check(removed.count === defaults.count, `count back to ${defaults.count}, got ${removed.count}`)
  check(!removed.chips.includes(removed.label), `${removed.label} left the chips`)
  check(removed.saved?.length === removed.count, "picked-models cookie holds the edited picks")
  const gone = added.saved.filter((id) => !removed.saved.includes(id))
  check(gone.length === 1, `exactly one id left the cookie, got ${JSON.stringify(gone)}`)

  const reloaded = await step("reload bare page with saved picks", async () => {
    await page.goto("/")
    await loaded()
    return { url: page.url(), count: await count(), chips: await chipNames(), saved: await picks() }
  })
  check(!reloaded.url.includes("models="), "bare page carries no models param")
  check(reloaded.count === removed.count, "same count after reload")
  check(
    JSON.stringify(reloaded.chips) === JSON.stringify(removed.chips),
    "saved picks come back from the cookie alone",
  )

  const reset = await step("reset picks", async () => {
    await trigger.click()
    await picker.waitFor()
    await picker.getByRole("button", { name: "Reset" }).click()
    await page.waitForFunction(() => !document.cookie.includes("picked-models="))
    await page.keyboard.press("Escape")
    return { url: page.url(), count: await count(), chips: await chipNames(), saved: await picks() }
  })
  check(reset.saved === null, "Reset deletes the picked-models cookie")
  check(!reset.url.includes("models="), "Reset drops the models param")
  check(JSON.stringify(reset.chips) === JSON.stringify(defaults.chips), "Reset restores the default chips")
}
