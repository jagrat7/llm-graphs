import type { RouterClient } from "@orpc/server"

import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createRouterClient, lazy } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import type router from "#/server/orpc/router"

type AppClient = RouterClient<typeof router>

export type ModelSnapshot = Awaited<ReturnType<AppClient["models"]["snapshot"]>>
export type ProvidersInfo = Awaited<ReturnType<AppClient["providers"]["info"]>>
export type ProviderName = keyof ProvidersInfo["displayNames"]
export type MetricKey = keyof ProvidersInfo["metricProviders"]
export type ReasoningMode = ModelSnapshot["variants"][ProviderName][number]["mode"]

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(
      lazy(() => import("#/server/orpc/router")),
      {
        context: () => ({
          headers: getRequestHeaders(),
        }),
      },
    ),
  )
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
    })
    return createORPCClient(link)
  })

export const client: RouterClient<typeof router> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
