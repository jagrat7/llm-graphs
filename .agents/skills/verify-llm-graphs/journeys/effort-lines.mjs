/**
 * One model's effort line on one benchmark: opens a chart that plots MODELS (comma-separated
 * entry ids) from SOURCE on both axes, and counts how many points read
 * "reasoning unknown" in their tooltips. An unlabeled run beside named efforts should not be
 * drawn: `SOURCE=automationBench MODELS=gpt-5-6-luna llmg browse effort-lines.mjs`.
 */
const SOURCE = process.env.SOURCE ?? "automationBench"
const MODELS = process.env.MODELS ?? "gpt-5-6-luna"
const UNKNOWN = "reasoning unknown"

export default async function effortLines({ page, step, check }) {
  const frame = page.locator('[data-chart-frame="loaded"]')
  const marks = frame.locator(
    '[data-slot="chart-plot"] .ts-chart__marks :is(circle, rect[class*="chart-logo"])',
  )
  const tooltip = page.locator(".ts-chart-tooltip")
  const models = encodeURIComponent(JSON.stringify(MODELS.split(",")))
  const link = `/?x=cost&y=score&xSource=${SOURCE}&ySource=${SOURCE}&models=${models}`

  const drawn = await step("plot the effort lines", async () => {
    await page.goto(link)
    await frame.waitFor({ timeout: 60_000 })
    await marks.first().waitFor()
    let last = -1
    for (let count = await marks.count(); count !== last; count = await marks.count()) {
      last = count
      await page.waitForTimeout(750)
    }
    return { url: page.url(), marks: last, frame: await frame.boundingBox() }
  })
  check(drawn.marks > 0, "the chart draws points")

  const labels = await step("read every point's effort", async () => {
    const efforts = []
    for (let index = 0; index < drawn.marks; index++) {
      const box = await marks.nth(index).boundingBox()
      if (!box) continue
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await tooltip.first().waitFor({ timeout: 5_000 })
      efforts.push((await tooltip.first().textContent()).trim().slice(0, 80))
      await page.mouse.move(0, 0)
      await page.waitForTimeout(150)
    }
    return { efforts, unknown: efforts.filter((text) => text.includes(UNKNOWN)).length }
  })

  return labels
}
