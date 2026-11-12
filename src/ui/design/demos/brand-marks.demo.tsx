import { EyebrowMark, TokenWordmark } from "#/ui/components/brand-marks"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "Brand marks",
  components: [],
  custom: { file: "src/ui/components/brand-marks.tsx", exports: "TokenWordmark · EyebrowMark" },
}

export default function BrandMarksDemo() {
  return (
    <Rows>
      <Row label="wordmark">
        <TokenWordmark />
      </Row>
      <Row label="larger">
        <TokenWordmark className="text-[24px]" />
      </Row>
      <Row label="eyebrow">
        <EyebrowMark />
        <EyebrowMark className="text-primary size-10" />
      </Row>
    </Rows>
  )
}
