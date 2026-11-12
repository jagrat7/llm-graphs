/**
 * The bar view: a metric fixed per model (token price) against one that varies by effort
 * (output speed) opens as one group of bars per model. Hovers a bar for its tooltip, flips
 * the theme, goes to the scatter and back, then loads the same link on a phone, where the
 * bars scroll sideways instead of squeezing. Override the pair with X and Y metric keys:
 * `X=price Y=score llmg browse bar-view.mjs`.
 */
const X = process.env.X ?? "price"
const Y = process.env.Y ?? "speed"

export default async function barView({ page, step, check, saveDownload }) {
  const frame = page.locator('[data-chart-frame="loaded"]')
  const bars = frame.locator(
    '.ts-chart__marks :is(path, rect)[data-ts-key^="effort-bars-0:"]:not([data-ts-key$=":logo"])',
  )
  const view = page.getByRole("group", { name: "Chart view" })
  const tooltip = page.locator(".ts-chart-tooltip")
  const scroll = frame.locator('[data-slot="chart-scroll"]')

  const settle = async () => {
    let last = -1
    for (let count = await bars.count(); count !== last; count = await bars.count()) {
      last = count
      await page.waitForTimeout(750)
    }
    return last
  }

  const opened = await step("open the bar view", async () => {
    await page.goto(`/?x=${X}&y=${Y}`)
    await frame.waitFor({ timeout: 60_000 })
    await bars.first().waitFor({ timeout: 30_000 })
    return {
      url: page.url(),
      bars: await settle(),
      pressed: await view.getByRole("button", { name: "Bars" }).getAttribute("aria-pressed"),
      label: await frame.locator("svg.ts-chart").getAttribute("aria-label"),
      title: await frame.getByText(/^Models, sorted by/).textContent(),
    }
  })
  check(opened.bars > 0, "the chart draws bars")
  check(opened.pressed === "true", "the bar view is the default for a fixed metric")
  check(opened.label?.startsWith("Bar chart of"), "the chart announces itself as a bar chart")

  const hovered = await step("hover a bar", async () => {
    const bar = bars.nth(Math.floor(opened.bars / 2))
    const box = await bar.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3)
    await tooltip.first().waitFor({ timeout: 5_000 })
    await page.waitForTimeout(400)
    return {
      tooltip: (await tooltip.first().textContent()).trim().slice(0, 120),
      outline: await bar.getAttribute("stroke-width"),
      outlinedLogos: await frame.locator('[data-ts-key$=":logo"][stroke]').count(),
    }
  })
  check(hovered.tooltip.length > 0, "a hovered bar shows its tooltip")
  check(hovered.outline === "1.5", "the hovered bar takes an outline")
  check(hovered.outlinedLogos === 0, "the outline never reaches a logo")

  await step("dark theme", async () => {
    await page.mouse.move(0, 0)
    const toggle = page.getByRole("button", { name: "Switch to dark theme" })
    if (await toggle.count()) await toggle.click()
    await page.waitForTimeout(800)
    return { dark: await page.evaluate(() => document.documentElement.classList.contains("dark")) }
  })

  const scattered = await step("switch to the scatter", async () => {
    await view.getByRole("button", { name: "Scatter" }).click()
    await page.waitForTimeout(800)
    return { bars: await bars.count() }
  })
  check(scattered.bars === 0, "the scatter draws no bars")

  const back = await step("back to the bars", async () => {
    await view.getByRole("button", { name: "Bars" }).click()
    return { bars: await settle() }
  })
  check(back.bars === opened.bars, "the bars come back")

  const image = await step("download the image", async () => {
    await page.getByRole("button", { name: "Share" }).click()
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("menuitem", { name: /Download image/ }).click(),
    ])
    return { file: await saveDownload(download) }
  })
  check(Boolean(image.file), "the share menu saves an image of the bars")

  const phone = await step("phone", async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/?x=${X}&y=${Y}`)
    await frame.waitFor({ timeout: 60_000 })
    await bars.first().waitFor({ timeout: 30_000 })
    await settle()
    await frame.scrollIntoViewIfNeeded()
    return scroll.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }))
  })
  check(phone.scrollWidth > phone.clientWidth, "the bars scroll sideways inside the chart")
  check(phone.pageOverflow === false, "the page itself never scrolls sideways")

  return { opened, hovered, phone }
}
