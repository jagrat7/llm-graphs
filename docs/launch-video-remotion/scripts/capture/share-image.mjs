/**
 * Share → Download image on the 2D chart the film shows (DeepSWE score against task cost, log
 * scale), light then dark, saved as public/share/score-vs-cost-{light,dark}.png. From the repo root:
 *   SHARE_PATH="/?x=cost&y=score&log=cost" SHARE_OUT=docs/launch-video-remotion/public/share \
 *     .claude/skills/verify-llm-graphs/scripts/llmg browse docs/launch-video-remotion/scripts/capture/share-image.mjs
 */
export default async function shareImage({ page, step, check }) {
  const loaded = () => page.locator('[data-chart-frame="loaded"]').waitFor({ timeout: 120_000 })
  const download = async (label) => {
    await page.getByRole("button", { name: "Share" }).click()
    const pending = page.waitForEvent("download", { timeout: 60_000 })
    await page.getByRole("menuitem", { name: /Download image/ }).click()
    const file = await pending
    const name = file.suggestedFilename()
    await file.saveAs(`${process.env.SHARE_OUT ?? "."}/score-vs-cost-${label}.png`)
    await page.getByRole("button", { name: "Image saved" }).waitFor({ timeout: 10_000 })
    await page.getByRole("button", { name: "Share" }).waitFor({ timeout: 10_000 })
    return { label, name }
  }
  const light = await step("download the light share image", async () => {
    await page.goto(process.env.SHARE_PATH ?? "/")
    await loaded()
    await page.waitForTimeout(1500)
    return download("light")
  })
  check(light.name.endsWith(".png"), `light download is a PNG: ${light.name}`)
  const dark = await step("switch to dark and download again", async () => {
    await page.getByRole("button", { name: "Switch to dark theme" }).click()
    await page.waitForTimeout(1500)
    return download("dark")
  })
  check(dark.name.endsWith(".png"), `dark download is a PNG: ${dark.name}`)
}
