// The design page with this project's sources. The route loads this file lazily, and only in
// development, so a build has none of it.

import DesignPage from "./page"
import { sources } from "./sources"

export default function Design() {
  return <DesignPage sources={sources} />
}
