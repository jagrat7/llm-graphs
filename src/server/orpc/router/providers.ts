import { os } from "@orpc/server"

import { ProvidersService } from "../../services/providers"

/** Display names, which sources offer each metric, and axis notes. Static, so fetched once. */
export const providersInfoProcedure = os.handler(() => ProvidersService.info())
