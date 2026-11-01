import type { Point } from "./data"

import { MODELS } from "./data"
import { LogoGlyph } from "./marks"
import { useTheme } from "./theme-context"
import { FONT, lerp, vendorColor, vendorLabelColor } from "./theme"

const money = (value: number) => `$${value.toFixed(2)}`
const pct = (value: number) => `${value.toFixed(1)}%`

/**
 * The point readout (point-details.tsx), at video scale: the model on the field step, its
 * reasoning level, then one row per axis with the value and the benchmark it came from.
 * It floats over the plot, so it takes the app's floating-layer shadow and ink ring. It hangs
 * below its point, clear of the neighbouring levels' labels.
 */
export function Tooltip({ point, x, y, t }: { point: Point; x: number; y: number; t: number }) {
  const T = useTheme()
  const model = MODELS.get(point.model)!
  return (
    <div
      style={{
        position: "absolute",
        left: x + 30,
        top: y + 104,
        width: 520,
        boxSizing: "border-box",
        padding: "24px 28px 22px",
        background: T.sheet,
        borderRadius: T.dark ? 8 : 6,
        boxShadow: T.float,
        fontFamily: FONT.sans,
        color: T.ink,
        opacity: t,
        transformOrigin: "0 0",
        transform: `translateY(${lerp(8, 0, t)}px) scale(${lerp(0.97, 1, t)})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 600 }}>
        {model.logo && (
          <svg width={36} height={36} style={{ overflow: "visible", flexShrink: 0 }}>
            <LogoGlyph logo={model.logo} size={36} color={vendorColor(T, model)} x={18} y={18} />
          </svg>
        )}
        {model.name}
      </div>
      <div style={{ fontSize: 34, color: vendorLabelColor(T, model), marginTop: 2, paddingLeft: 50 }}>{point.level}</div>
      <Row axis="X" label="Task cost" value={`${money(point.cost)}/task`} />
      <Row axis="Y" label="Score" value={pct(point.score)} />
      <div style={{ fontSize: 34, color: T.graphite, marginTop: 18, whiteSpace: "nowrap" }}>
        via <span style={{ color: T.pen, fontWeight: 600 }}>DeepSWE</span>
      </div>
    </div>
  )
}

function Row({ axis, label, value }: { axis: string; label: string; value: string }) {
  const T = useTheme()
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 34, color: T.graphite }}>
        <span style={{ color: T.ink, fontWeight: 600 }}>{axis}</span> {label}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 36, fontWeight: 500, fontVariantNumeric: "tabular-nums", display: "flex", gap: 14, alignItems: "baseline" }}>
        {value}
        <span style={{ color: T.graphite, fontWeight: 400, fontSize: 30 }}>DSWE</span>
      </div>
    </div>
  )
}
