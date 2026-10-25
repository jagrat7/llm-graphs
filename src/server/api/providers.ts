import { createServerFn } from "@tanstack/react-start"

import { ProvidersService } from "../services/providers"

/** Display names, which sources offer each metric, and axis notes. Static, so fetched once. */
export const info = createServerFn({ method: "GET" }).handler(() => ProvidersService.info())
