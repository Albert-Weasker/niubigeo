export type ProductWebSearchMode = "off" | "provider_native";

export interface ProductModelSelection {
  id: string;
  projectId: string;
  providerId: "openrouter";
  modelId: string;
  displayName: string;
  webSearchMode: ProductWebSearchMode;
  nativeWebSearchSupported: boolean;
  available: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductModelSelectionInput {
  modelId: string;
  webSearchMode: ProductWebSearchMode;
}

export interface ProviderModelCatalogItem {
  providerId: "openrouter";
  modelId: string;
  displayName: string;
  vendor?: string | undefined;
  releasedAt?: string | null | undefined;
  available: boolean;
  unavailableReason: string | null;
  nativeWebSearchSupported: boolean;
  checkedAt: string;
  source: "openrouter_catalog" | "local_capability_registry";
}

export interface ProductModelCatalog {
  list(): Promise<ProviderModelCatalogItem[]>;
}
