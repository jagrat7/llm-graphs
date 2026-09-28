import type { RouterClient } from "@orpc/server"

import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createRouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import router from "#/server/orpc/router"

export { PROVIDERS } from "#/server/services/provider/provider.types"
export type { ProviderName } from "#/server/services/provider/provider.types"
export type { MetricKey, ReasoningMode } from "#/server/services/registry"

type AppClient = RouterClient<typeof router>

export type RegistrySnapshot = Awaited<ReturnType<AppClient["registry"]["snapshot"]>>

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      context: () => ({
        headers: getRequestHeaders(),
      }),
    }),
  )
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
    })
    return createORPCClient(link)
  })

export const client: RouterClient<typeof router> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
