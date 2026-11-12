import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "#/ui/components/ui/avatar"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Avatar", components: ["avatar"] }

export default function AvatarDemo() {
  return (
    <Rows>
      <Row label="size">
        <Avatar size="sm">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </Row>
      <Row label="badge">
        <Avatar>
          <AvatarFallback>OA</AvatarFallback>
          <AvatarBadge />
        </Avatar>
      </Row>
      <Row label="group">
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>OA</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>GO</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+6</AvatarGroupCount>
        </AvatarGroup>
      </Row>
    </Rows>
  )
}
