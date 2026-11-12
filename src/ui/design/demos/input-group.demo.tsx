import { RiCloseLine, RiSearchLine } from "@remixicon/react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "#/ui/components/ui/input-group"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Input group", components: ["input-group"] }

export default function InputGroupDemo() {
  return (
    <Rows>
      <Row label="icon">
        <InputGroup className="max-w-72">
          <InputGroupInput placeholder="Search models" />
          <InputGroupAddon>
            <RiSearchLine />
          </InputGroupAddon>
        </InputGroup>
      </Row>
      <Row label="button">
        <InputGroup className="max-w-72">
          <InputGroupInput defaultValue="gemini" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear">
              <RiCloseLine />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Row>
      <Row label="text">
        <InputGroup className="max-w-72">
          <InputGroupAddon>
            <InputGroupText>$</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput defaultValue="1.25" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>per 1M tokens</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Row>
      <Row label="kbd">
        <InputGroup className="max-w-72">
          <InputGroupInput placeholder="Search" />
          <InputGroupAddon align="inline-end">
            <kbd data-slot="kbd">/</kbd>
          </InputGroupAddon>
        </InputGroup>
      </Row>
      <Row label="textarea">
        <InputGroup className="max-w-72">
          <InputGroupTextarea placeholder="Paste a chart link" />
        </InputGroup>
      </Row>
    </Rows>
  )
}
