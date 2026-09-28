import type { ProductWebSearchMode } from "./model-selection-schema.js";
import type { RecognitionProtocolSnapshot } from "./recognition-protocol.js";

export interface ProductModelSnapshot {
  selectionId: string;
  providerId: "openrouter" | "openai-compatible";
  baseUrl?: string | undefined;
  upstreamModelId?: string | undefined;
  modelId: string;
  displayName: string;
  webSearchMode: ProductWebSearchMode;
  nativeWebSearchSupported: boolean;
  capabilityCheckedAt: string;
}

export interface ProductBaseline {
  id: string;
  projectId: string;
  version: number;
  normalizedDomain: string;
  recognitionProtocol: RecognitionProtocolSnapshot;
  modelSnapshots: ProductModelSnapshot[];
  language: "zh" | "en" | "pt-BR";
  analysisVersion: string;
  configHash: string;
  createdAt: string;
}
