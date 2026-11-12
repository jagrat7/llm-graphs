import { SourceLogo } from "#/ui/components/source-logo"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "Source logo",
  components: [],
  custom: { file: "src/ui/components/source-logo.tsx", exports: "SourceLogo" },
}

export default function SourceLogoDemo() {
  return (
    <Rows>
      <Row label="drawn">
        <SourceLogo source="artificialAnalysis" />
        <SourceLogo source="arena" />
        <SourceLogo source="deepswe" />
        <SourceLogo source="cursorBench" />
        <SourceLogo source="frontierCode" />
      </Row>
      <Row label="image">
        <SourceLogo source="metr" />
        <SourceLogo source="sweBench" />
        <SourceLogo source="modelsDevListing" />
      </Row>
      <Row label="inherit">
        <span className="text-muted-foreground flex gap-2">
          <SourceLogo source="artificialAnalysis" monochromeColor="inherit" />
          <SourceLogo source="arena" monochromeColor="inherit" />
        </span>
      </Row>
      <Row label="larger">
        <SourceLogo source="artificialAnalysis" className="size-6" />
      </Row>
    </Rows>
  )
}
