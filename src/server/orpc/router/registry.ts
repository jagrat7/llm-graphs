import { os } from "@orpc/server"

import { RegistryService } from "../../services/registry"

const registryService = new RegistryService()

export const registrySnapshotProcedure = os.handler(() => registryService.getSnapshot())
