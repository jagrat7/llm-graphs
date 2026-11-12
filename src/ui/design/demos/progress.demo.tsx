import { Progress, ProgressLabel, ProgressValue } from "#/ui/components/ui/progress"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Progress", components: ["progress"] }

export default function ProgressDemo() {
  return (
    <Rows>
      <Row label="bare" className="block">
        <Progress value={40} className="max-w-72" />
      </Row>
      <Row label="labelled" className="block">
        <Progress value={72} className="max-w-72">
          <ProgressLabel>Loading sources</ProgressLabel>
          <ProgressValue />
        </Progress>
      </Row>
    </Rows>
  )
}
