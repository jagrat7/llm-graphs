import type { ProviderModel, ProviderModelDataByProvider, ProviderName } from "./provider.types"

export interface ProviderService {
  fetchModels<TProvider extends ProviderName>(
    provider: TProvider,
  ): Promise<Array<ProviderModelDataByProvider[TProvider]>>
  listModels(provider: ProviderName): Promise<Array<ProviderModel>>
  getModel<TProvider extends ProviderName>(
    provider: TProvider,
    model: string,
    effort?: string,
  ): Promise<ProviderModelDataByProvider[TProvider] | null>
}

export interface ProviderModelReader<TProvider extends ProviderName> {
  getModel(
    provider: TProvider,
    model: string,
    effort?: string,
  ): Promise<ProviderModelDataByProvider[TProvider] | null>
}
