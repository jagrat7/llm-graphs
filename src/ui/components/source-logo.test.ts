import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ProvidersService } from "#/server/services/providers"
import { SourceLogo } from "./source-logo"

const sources = [...new Set(Object.values(ProvidersService.info().metricProviders).flat())]

describe("source logo surface colors", () => {
  it("lets every monochrome provider inherit the surface text color", () => {
    let monochromeCount = 0

    for (const source of sources) {
      const brand = renderToStaticMarkup(createElement(SourceLogo, { source }))
      if (!brand.includes("light-dark(")) continue
      monochromeCount += 1

      const inherited = renderToStaticMarkup(
        createElement(SourceLogo, { source, monochromeColor: "inherit" }),
      )
      expect(inherited, source).toContain('style="color:inherit"')
      expect(inherited, source).not.toContain("light-dark(")
    }

    expect(monochromeCount).toBeGreaterThan(0)
  })

  it("preserves every colored brand and image when surface inheritance is requested", () => {
    for (const source of sources) {
      const brand = renderToStaticMarkup(createElement(SourceLogo, { source }))
      if (brand.includes("light-dark(")) continue

      expect(
        renderToStaticMarkup(createElement(SourceLogo, { source, monochromeColor: "inherit" })),
        source,
      ).toBe(brand)
    }
  })
})
