import { randomUUID } from "node:crypto";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductConfigurationInputError } from "./configuration-errors.js";
import { ProductConfigurationFileStore } from "./configuration-store.js";
import type {
  ProductModelCatalog,
  ProductModelSelection,
  ProductModelSelectionInput,
  ProductWebSearchMode,
} from "./model-selection-schema.js";

function nowIso(): string {
  return new Date().toISOString();
}

function validMode(value: string): value is ProductWebSearchMode {
  return value === "off" || value === "provider_native";
}

export class ProductModelSelectionService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly store: ProductConfigurationFileStore,
    private readonly catalog: ProductModelCatalog,
  ) {}

  async list(projectId: string): Promise<ProductModelSelection[]> {
    await this.projects.get(projectId);
    return this.store.readModelSelections(projectId);
  }

  async replace(projectId: string, inputs: ProductModelSelectionInput[]): Promise<ProductModelSelection[]> {
    await this.projects.get(projectId);
    const catalogItems = await this.catalog.list();
    const catalogByModel = new Map(catalogItems.map((item) => [item.modelId, item]));
    const previous = await this.store.readModelSelections(projectId);
    const previousByModel = new Map(previous.map((selection) => [selection.modelId, selection]));
    const seen = new Set<string>();
    const selections: ProductModelSelection[] = [];

    for (const input of inputs) {
      const modelId = input.modelId.trim();
      if (!modelId) throw new ProductConfigurationInputError("A model id is required.");
      if (!validMode(input.webSearchMode)) throw new ProductConfigurationInputError("Web search mode must be off or provider_native.");
      if (seen.has(modelId)) throw new ProductConfigurationInputError(`Model is selected more than once: ${modelId}.`);
      seen.add(modelId);
      const model = catalogByModel.get(modelId);
      if (!model || !model.available) throw new ProductConfigurationInputError(`Selected model is unavailable: ${modelId}.`);
      if (input.webSearchMode === "provider_native" && !model.nativeWebSearchSupported) {
        throw new ProductConfigurationInputError(`Provider-native web search is not supported by ${model.displayName}.`);
      }
      const existing = previousByModel.get(modelId);
      const timestamp = nowIso();
      selections.push({
        id: existing?.id || randomUUID(),
        projectId,
        providerId: "openrouter",
        modelId,
        displayName: model.displayName,
        webSearchMode: input.webSearchMode,
        nativeWebSearchSupported: model.nativeWebSearchSupported,
        available: model.available,
        enabled: true,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      });
    }

    await this.store.saveModelSelections(projectId, selections);
    return selections;
  }
}
