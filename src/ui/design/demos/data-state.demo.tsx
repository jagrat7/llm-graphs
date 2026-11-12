import { Button } from "#/ui/components/ui/button"
import { DataError, DataState } from "#/ui/components/data-state"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "Data state",
  components: [],
  custom: { file: "src/ui/components/data-state.tsx", exports: "DataState · DataError" },
}

export default function DataStateDemo() {
  return (
    <Rows>
      <Row label="empty" className="block">
        <DataState title="No models on the chart yet" className="h-40">
          <Button size="sm" variant="outline">
            Pick models
          </Button>
        </DataState>
      </Row>
      <Row label="error" className="block">
        <DataError className="h-28">Could not load the models.</DataError>
      </Row>
    </Rows>
  )
}
