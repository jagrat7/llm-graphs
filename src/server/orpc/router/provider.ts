import { os } from "@orpc/server"
import { z } from "zod"

import { ProviderDataService } from "../../services/provider"
import { PROVIDERS, type ProviderName } from "../../services/provider/provider.types"

const providerService = new ProviderDataService()
const providerInput = z.object({
  provider: z.string().refine((value): value is ProviderName => Object.hasOwn(PROVIDERS, value)),
})

export const listProviderModelsProcedure = os
  .input(providerInput)
  .handler(({ input }) => providerService.listModels(input.provider))
