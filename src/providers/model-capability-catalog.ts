import type { ProviderDefinition } from "../core/types.js";

export interface ProviderModelCapability {
  providerId: string;
  model: string;
  name: string;
  vendor?: string | undefined;
  releasedAt?: string | null | undefined;
  nativeWebSearchSupported: boolean;
  source: "provider_catalog" | "provider_definition";
}

export interface ProviderModelCapabilitySource {
  providerId: string;
  list(): Promise<ProviderModelCapability[]>;
}

export interface ProviderModelCapabilityGroup {
  providerId: string;
  providerLabel: string;
  catalogStatus: "available" | "unavailable";
  models: ProviderModelCapability[];
  error?: string | undefined;
}

function declaredModels(provider: ProviderDefinition): ProviderModelCapability[] {
  const declarations = new Map(
    (provider.defaultModelCapabilities || []).map((capability) => [capability.model, capability.nativeWebSearchSupported]),
  );
  return provider.defaultModels.map((model) => ({
    providerId: provider.id,
    model,
    name: model,
    nativeWebSearchSupported: declarations.get(model) === true,
    source: "provider_definition",
  }));
}

export class ProviderModelCapabilityCatalog {
  private readonly sources: Map<string, ProviderModelCapabilitySource>;

  constructor(
    private readonly providers: ProviderDefinition[],
    sources: ProviderModelCapabilitySource[],
  ) {
    this.sources = new Map(sources.map((source) => [source.providerId, source]));
  }

  async list(): Promise<ProviderModelCapabilityGroup[]> {
    return Promise.all(this.providers.map(async (provider) => {
      const source = this.sources.get(provider.id);
      if (!source) {
        return {
          providerId: provider.id,
          providerLabel: provider.label,
          catalogStatus: "available" as const,
          models: declaredModels(provider),
        };
      }
      try {
        return {
          providerId: provider.id,
          providerLabel: provider.label,
          catalogStatus: "available" as const,
          models: await source.list(),
        };
      } catch (error) {
        return {
          providerId: provider.id,
          providerLabel: provider.label,
          catalogStatus: "unavailable" as const,
          models: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));
  }
}
