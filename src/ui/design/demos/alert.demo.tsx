import { RiErrorWarningLine, RiInformationLine } from "@remixicon/react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/ui/components/ui/alert"
import { Button } from "#/ui/components/ui/button"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Alert", components: ["alert"] }

export default function AlertDemo() {
  return (
    <Rows>
      <Row label="default" className="block">
        <Alert>
          <RiInformationLine />
          <AlertTitle>Scores update daily</AlertTitle>
          <AlertDescription>Each source is fetched again once a day.</AlertDescription>
        </Alert>
      </Row>
      <Row label="destructive" className="block">
        <Alert variant="destructive">
          <RiErrorWarningLine />
          <AlertTitle>Could not load the models</AlertTitle>
          <AlertDescription>The snapshot did not answer. Try again in a minute.</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline">
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </Row>
    </Rows>
  )
}
