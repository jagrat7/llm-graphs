import type { CSSProperties } from "react"

import type { ProviderName } from "#/ui/lib/orpc-client"

import { cn } from "#/ui/lib/utils"

type LogoBrandStyle = CSSProperties & { "--logo-brand": string }

function logoBrandStyle(brand: string | undefined): LogoBrandStyle | undefined {
  return brand ? { "--logo-brand": brand } : undefined
}

/** Activates `--logo-brand` when a `group/mark` ancestor is hovered, focused, or selected. */
const LOGO_BRAND_ACCENT_CLASS =
  "transition-colors duration-150 ease-out group-hover/mark:text-(--logo-brand) group-focus-within/mark:text-(--logo-brand) group-data-[highlighted]/mark:text-(--logo-brand) group-data-[selected]/mark:text-(--logo-brand) group-has-[:checked]/mark:text-(--logo-brand) in-[[data-slot=select-trigger]]:text-(--logo-brand)"

function logoAccentClass(brand: string | undefined, accent: boolean) {
  if (!brand) return undefined
  return accent ? "text-(--logo-brand)" : LOGO_BRAND_ACCENT_CLASS
}

type SourceMark = { viewBox: string; paths: ReadonlyArray<string>; brand?: string }

/**
 * Data-source marks, flattened to `currentColor` so a source never
 * competes with the chart's own colour encoding at rest. Brand colour surfaces on hover/select;
 * native black/white marks use light-dark() with the site's exact off-black / off-white.
 * Sources: artificialanalysis.ai, datacurve.ai (DeepSWE). Trademarks of their owners.
 */
const SOURCE_MARKS: Partial<Record<ProviderName, SourceMark>> = {
  artificialAnalysis: {
    viewBox: "0 0 53 53",
    brand: "#7F4BF3",
    paths: [
      "M46.2194 52.8201H52.8194V39.6101H46.2194H39.6094V52.8201H46.2194Z",
      "M26.41 0L13.2 13.2H0V26.41H19.81L33.01 13.2H39.61V0H26.41Z",
      "M26.41 26.4099L13.2 39.6099H0V52.8199H19.81L33.01 39.6099H39.61V26.4099H26.41Z",
      "M52.8194 26.41V13.2H46.2194H39.6094V26.41H46.2194H52.8194Z",
    ],
  },
  deepswe: {
    viewBox: "0 0 51 51",
    // datacurve.ai: #0A0A0A (light) / off-white (dark)
    brand: "light-dark(#0A0A0A, #FAFAFA)",
    paths: [
      "M44.359 50.3612H15.1535C14.6037 50.3612 14.063 50.222 13.5815 49.9566C10.9198 48.4894 11.5362 44.4142 14.4133 43.4346C22.7273 40.604 26.0971 36.4192 28.0568 28.1627C31.274 17.99 35.5491 13.1346 43.5398 10.6088C47.0462 9.50039 50.3618 12.4055 50.3618 16.0829V44.3584C50.3618 47.6737 47.6743 50.3612 44.359 50.3612Z",
      "M6.0012 0H35.2067C35.7565 0 36.2973 0.13918 36.7787 0.404568C39.4404 1.87183 38.824 5.94707 35.9469 6.92662C27.6329 9.75718 24.2632 13.9421 22.3034 22.1985C19.0862 32.3712 14.8111 37.2266 6.82042 39.7525C3.31397 40.8608 -0.00158691 37.9557 -0.00158691 34.2782V6.00279C-0.00158691 2.68753 2.68595 0 6.0012 0Z",
    ],
  },
}

export function SourceLogo({
  source,
  className,
  accent = false,
}: {
  source: ProviderName
  className?: string
  /** Force brand colour when the mark has one (selected source, etc.). */
  accent?: boolean
}) {
  const mark = SOURCE_MARKS[source]

  if (!mark)
    return (
      <span
        aria-hidden="true"
        className={cn("text-muted-foreground shrink-0 text-[9px] font-semibold", className)}
      >
        {source === "metr" ? "M" : source === "arena" ? "A" : source.slice(0, 1).toUpperCase()}
      </span>
    )

  return (
    <svg
      aria-hidden="true"
      viewBox={mark.viewBox}
      fill="currentColor"
      style={logoBrandStyle(mark.brand)}
      className={cn("size-3.5 shrink-0", logoAccentClass(mark.brand, accent), className)}
    >
      {mark.paths.map((path) => (
        <path key={path.slice(0, 24)} d={path} />
      ))}
    </svg>
  )
}
