/**
 * A point active on the chart lights its model's entry in the picker key, as hovering that
 * entry would. Hovers a 2D point, moves off it, then focuses a point in the 3D cube. Set
 * EXPECT=none to record the state without asserting it (e.g. on a revision without the feature).
 */
const EXPECT = process.env.EXPECT ?? "lit"

export default async function chartPointPill({ page, step, check, dir }) {
  const frame = page.locator('[data-chart-frame="loaded"]')
  const marks = frame.locator(
    '[data-slot="chart-plot"] .ts-chart__marks :is(circle, rect[class*="chart-logo"])',
  )
  const tooltip = page.locator(".ts-chart-tooltip")
  const key = page.getByRole("list", { name: "Selected models" })
  const pills = () =>
    page.$$eval("[data-slot=model-picker-entry]", (entries) =>
      entries.map((entry) => ({
        name: entry.getAttribute("title"),
        active: entry.hasAttribute("data-active"),
        background: getComputedStyle(entry).backgroundColor,
        logoFilter: getComputedStyle(entry.querySelector("*")).filter,
      })),
    )
  const lit = (state) => state.filter((pill) => pill.active)
  const shot = (name) =>
    key.screenshot({ path: `${dir}/${name}.png` }).catch(() => undefined)

  const rest = await step("2d chart at rest", async () => {
    await page.goto("/?x=cost&y=score")
    await frame.waitFor({ timeout: 60_000 })
    await marks.first().waitFor()
    await page.waitForTimeout(1_000)
    await shot("key-rest")
    return { pills: await pills() }
  })
  check(lit(rest.pills).length === 0, "no pill is lit at rest")

  const hovered = await step("hover a 2d point", async () => {
    const box = await marks.nth(Math.floor((await marks.count()) / 2)).boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await tooltip.first().waitFor({ timeout: 5_000 })
    await page.waitForTimeout(400)
    await shot("key-hover-2d")
    return { tooltip: (await tooltip.first().textContent()).trim(), pills: await pills() }
  })

  if (EXPECT === "lit") {
    const on = lit(hovered.pills)
    check(on.length === 1, `exactly one pill lit on hover, got ${on.length}`)
    check(hovered.tooltip.includes(on[0].name), `lit pill ${on[0]?.name} is the tooltip's model`)
    check(
      ["none", "grayscale(0)"].includes(on[0].logoFilter),
      `lit pill's logo is in colour, got ${on[0].logoFilter}`,
    )
  }

  const left = await step("move off the chart", async () => {
    await page.mouse.move(5, 5)
    await page.waitForTimeout(400)
    return { pills: await pills() }
  })
  if (EXPECT === "lit") check(lit(left.pills).length === 0, "the pill lets go off the chart")

  const cube = await step("focus a 3d point", async () => {
    await page.goto("/?x=cost&y=score&z=speed")
    await frame.waitFor({ timeout: 60_000 })
    const point = page.locator("[data-plot-3d-point]").first()
    await point.waitFor({ state: "attached", timeout: 30_000 })
    await page.locator("canvas").first().waitFor({ timeout: 30_000 })
    // The cube's lazy chunk can remount its point buttons, so retry until the chart says
    // a point is selected.
    const selected = page.getByText(/ selected$/)
    for (let attempt = 0; attempt < 10 && (await selected.count()) === 0; attempt++) {
      await point.focus()
      await page.waitForTimeout(500)
    }
    await page.waitForTimeout(400)
    await shot("key-focus-3d")
    return { label: await point.getAttribute("aria-label"), pills: await pills() }
  })
  if (EXPECT === "lit") {
    const on = lit(cube.pills)
    check(on.length === 1, `exactly one pill lit on 3d focus, got ${on.length}`)
    check(cube.label?.includes(on[0].name), `lit pill ${on[0]?.name} is the focused point's model`)
  }
}
