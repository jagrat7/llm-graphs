import { ModelLogo } from "#/ui/components/model-logo"
import { vendorColor } from "#/ui/lib/model-view"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "Model logo",
  components: [],
  custom: { file: "src/ui/components/model-logo.tsx", exports: "ModelLogo" },
}

/** A stand-in one-colour mark, as the vendors' logos are: the logo is a mask over its colour. */
const MARK = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2 22 12 12 22 2 12Z"/></svg>',
)}`

export default function ModelLogoDemo() {
  return (
    <Rows>
      <Row label="logo">
        {[25, 145, 262, 320].map((hue) => (
          <ModelLogo key={hue} logoUrl={MARK} color={vendorColor({ hue })} />
        ))}
        <ModelLogo logoUrl={MARK} color={vendorColor({ hue: 262, shade: 0 })} />
      </Row>
      <Row label="no logo">
        {[25, 145, 262].map((hue) => (
          <ModelLogo key={hue} logoUrl={null} color={vendorColor({ hue })} />
        ))}
        <ModelLogo logoUrl={null} color={vendorColor({ hue: null })} />
      </Row>
    </Rows>
  )
}
