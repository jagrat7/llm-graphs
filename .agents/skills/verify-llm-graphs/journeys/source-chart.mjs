/**
 * One score benchmark end to end, as a reader meets it: chosen from the Y-axis source menu,
 * drawn against its task cost, described in a point's tooltip, reopened from its link, and
 * laid out on a phone. Pick the benchmark with SOURCE (its snapshot `variants` key) and LABEL
 * (its name in the menu): `SOURCE=reactBench LABEL='ReactBench 1.2' llmg browse source-chart.mjs`.
 */
const SOURCE = process.env.SOURCE ?? "reactBench"
const LABEL = process.env.LABEL ?? "ReactBench 1.2"

export default async function sourceChart({ page, step, check }) {
  const frame = page.locator('[data-chart-frame="loaded"]')
  const loaded = () => frame.waitFor({ timeout: 60_000 })
  const option = page.getByRole("option", { name: LABEL, exact: true })
  // Plotted marks: dots, and vendor logos drawn as masked rects.
  const marks = frame.locator(
    '[data-slot="chart-plot"] .ts-chart__marks :is(circle, rect[class*="chart-logo"])',
  )
  const tooltip = page.locator(".ts-chart-tooltip")
  // A source change morphs the old points out, so count once the mark count holds still.
  const settled = async () => {
    await marks.first().waitFor()
    let last = -1
    for (let count = await marks.count(); count !== last; count = await marks.count()) {
      last = count
      await page.waitForTimeout(750)
    }
    return last
  }
  const link = `/?x=cost&y=score&ySource=${SOURCE}`

  const menu = await step("y-axis source menu lists the benchmark", async () => {
    await page.goto("/?x=cost&y=score")
    await loaded()
    await page.getByRole("combobox", { name: "Y-axis data source" }).click()
    await option.waitFor()
    return { options: await page.getByRole("option").allTextContents() }
  })
  check(
    menu.options.some((name) => name.trim() === LABEL),
    `${LABEL} is a Y-axis source`,
  )

  const chosen = await step("choose it and draw cost against score", async () => {
    await option.click()
    await page.waitForURL(new RegExp(`ySource=${SOURCE}\\b`))
    await loaded()
    const count = await settled()
    const via = await page.getByText(LABEL, { exact: true }).count()
    return { url: page.url(), marks: count, via }
  })
  check(chosen.marks > 0, "the chart draws points")
  // X (task cost) follows the score benchmark, so both axes name it.
  check(chosen.via >= 2, `both axes read "via ${LABEL}", found ${chosen.via}`)

  const tip = await step("hover a point for its tooltip", async () => {
    const box = await marks.first().boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await tooltip.filter({ hasText: LABEL }).waitFor({ timeout: 5_000 })
    return { text: (await tooltip.first().textContent()).trim().slice(0, 400) }
  })
  check(tip.text.includes(LABEL), `the tooltip credits ${LABEL}`)

  const reopened = await step("reopen the link in a new page load", async () => {
    await page.goto(link)
    await loaded()
    return { url: page.url(), marks: await settled() }
  })
  check(reopened.url.includes(`ySource=${SOURCE}`), "the link keeps the benchmark")
  check(reopened.marks === chosen.marks, `same ${chosen.marks} points from the link`)

  const phone = await step("phone layout", async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(link)
    await loaded()
    return {
      marks: await settled(),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    }
  })
  check(phone.marks > 0, "the phone chart draws points")
  check(phone.overflow <= 0, `no horizontal overflow on a phone, got ${phone.overflow}px`)
}
