import { RiAddLine, RiSubtractLine } from "@remixicon/react"

import { Button } from "#/ui/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "#/ui/components/ui/button-group"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Button group", components: ["button-group"] }

export default function ButtonGroupDemo() {
  return (
    <Rows>
      <Row label="horizontal">
        <ButtonGroup>
          <Button variant="outline">Scatter</Button>
          <Button variant="outline">Bars</Button>
          <Button variant="outline">3D</Button>
        </ButtonGroup>
      </Row>
      <Row label="text">
        <ButtonGroup>
          <ButtonGroupText>Effort</ButtonGroupText>
          <Button variant="outline" size="icon" aria-label="Lower">
            <RiSubtractLine />
          </Button>
          <Button variant="outline" size="icon" aria-label="Higher">
            <RiAddLine />
          </Button>
        </ButtonGroup>
      </Row>
      <Row label="separator">
        <ButtonGroup>
          <Button variant="secondary">Copy link</Button>
          <ButtonGroupSeparator />
          <Button variant="secondary">Copy image</Button>
        </ButtonGroup>
      </Row>
      <Row label="vertical">
        <ButtonGroup orientation="vertical">
          <Button variant="outline" size="icon" aria-label="Zoom in">
            <RiAddLine />
          </Button>
          <Button variant="outline" size="icon" aria-label="Zoom out">
            <RiSubtractLine />
          </Button>
        </ButtonGroup>
      </Row>
    </Rows>
  )
}
