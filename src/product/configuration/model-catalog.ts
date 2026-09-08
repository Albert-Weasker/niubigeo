import type { ProviderModelCapabilityCatalog } from "../../providers/model-capability-catalog.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

export class OpenRouterProductModelCatalog implements ProductModelCatalog {
  constructor(private readonly capabilities: ProviderModelCapabilityCatalog) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    const groups = await this.capabilities.list();
    const group = groups.find((item) => item.providerId === "openrouter");
    if (!group || group.catalogStatus !== "available") {
      throw new ProductModelCatalogUnavailableError(group?.error || "OpenRouter model catalog is unavailable.");
    }
    const checkedAt = new Date().toISOString();
    return group.models.map((model) => ({
      providerId: "openrouter",
      modelId: model.model,
      displayName: model.name,
      vendor: model.vendor,
      releasedAt: model.releasedAt,
      available: true,
      unavailableReason: null,
      nativeWebSearchSupported: model.nativeWebSearchSupported,
      checkedAt,
      source: "openrouter_catalog",
    }));
  }
}
