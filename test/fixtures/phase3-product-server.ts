import { createProductServer } from "../../src/product/product-server.js";
import type { AnswerResult } from "../../src/core/types.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../../src/product/configuration/model-selection-schema.js";
import type { RecognitionAnswerExecutor } from "../../src/product/recognition/recognition-service.js";
import { ProviderRequestError } from "../../src/providers/provider-error.js";

const models: ProviderModelCatalogItem[] = [
  { providerId: "openrouter", modelId: "contract/recognized", displayName: "Recognized Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/native", displayName: "Native Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/failure", displayName: "Failure Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/partial", displayName: "Partial Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/unknown", displayName: "Unknown Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/ambiguous", displayName: "Ambiguous Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/malformed", displayName: "Malformed Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/compatibility", displayName: "Compatibility Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "contract/unsupported", displayName: "Unsupported Fixture", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-06T00:00:00.000Z", source: "local_capability_registry" },
];

class FixtureCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    return models.map((model) => ({ ...model }));
  }
}

function structured(model: string, analysisStatus: "recognized" | "partially_recognized" | "unknown" | "ambiguous" = "recognized"): string {
  if (analysisStatus === "unknown" || analysisStatus === "ambiguous") {
    return JSON.stringify({
      analysisStatus,
      domainRecognition: "unknown",
      recognizedBrand: { value: null, citationUrls: [] },
      businessDescription: { value: null, citationUrls: [] },
      productCategory: { value: null, citationUrls: [] },
      competitors: [],
      brandKeywords: [],
      unknowns: analysisStatus === "ambiguous" ? ["The domain could refer to multiple possible identities."] : ["The model could not identify this domain."],
    });
  }
  return JSON.stringify({
    analysisStatus,
    domainRecognition: "recognized",
    recognizedBrand: { value: "Fixture Brand", citationUrls: ["https://provider.example/citation"] },
    businessDescription: { value: "中文业务描述 😀", citationUrls: ["https://provider.example/citation"] },
    productCategory: { value: analysisStatus === "partially_recognized" ? null : "Fixture category", citationUrls: [] },
    competitors: [
      { name: "Fixture Rival One", domain: "rival-one.example", businessDescription: "Alternative one", productCategory: "Category one", keywords: [{ keyword: "rival one keyword", citationUrls: ["https://provider.example/citation"] }], citationUrls: ["https://provider.example/citation"] },
      { name: "Fixture Rival Two", domain: null, businessDescription: "Alternative two", productCategory: "Category two", keywords: [{ keyword: "rival two keyword", citationUrls: [] }], citationUrls: [] },
    ],
    brandKeywords: [{ keyword: "fixture keyword", citationUrls: ["https://provider.example/citation"] }, { keyword: "中文关键词", citationUrls: [] }],
    unknowns: ["No market fact asserted."],
    model,
  });
}

function compatibilityOutput(): string {
  return [
    "```json",
    JSON.stringify({
      domain: "compatibility.example",
      brand: "Compatibility Brand",
      business: "A compatibility business description",
      category: "A compatibility category",
      description: "A compatibility detailed description",
      keywords: ["one", "two", "three", "four", "five", "six", "seven", "eight"],
      competitors: [],
      citations: ["https://provider.example/citation"],
    }),
    "```",
  ].join("\n");
}

class FixtureExecutor implements RecognitionAnswerExecutor {
  private readonly calls = new Map<string, number>();

  async execute(input: Parameters<RecognitionAnswerExecutor["execute"]>[0]): Promise<AnswerResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, 140));
    const modelId = input.modelSnapshot.modelId;
    const currentCalls = (this.calls.get(modelId) || 0) + 1;
    this.calls.set(modelId, currentCalls);
    if (modelId === "contract/failure" && currentCalls === 1) throw new ProviderRequestError({ code: "upstream_unavailable", message: "Fixture timeout" });
    if (modelId === "contract/unsupported") throw new ProviderRequestError({ code: "unsupported_capability", message: "Fixture model does not support native web search" });
    if (modelId === "contract/compatibility") {
      const text = compatibilityOutput();
      return {
        ...await this.executeCompatibilityResponse(input, text),
        structuredOutput: undefined,
      };
    }
    const analysisStatus = modelId === "contract/partial" ? "partially_recognized" : modelId === "contract/unknown" ? "unknown" : modelId === "contract/ambiguous" ? "ambiguous" : "recognized";
    const text = structured(modelId, analysisStatus);
    const native = input.modelSnapshot.webSearchMode === "provider_native";
    return {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: fixture adapter",
      resultCaveat: "Test fixture only",
      model: input.modelSnapshot.modelId,
      modelVersion: input.modelSnapshot.modelId,
      text,
      structuredOutput: { transport: native ? "function_tool" : "response_json_schema", value: modelId === "contract/malformed" ? `An explanation before JSON is not valid structured output.\n${text}` : text },
      rawProviderResponse: { choices: [{ message: { annotations: [{ url: "https://provider.example/citation", title: "Provider fixture citation" }] } }] },
      citations: native
        ? [
            { id: "provider", url: "https://provider.example/citation", domain: "provider.example", title: "Provider fixture citation", citationIndex: 0, source: "provider_annotation", citationType: "unknown", providerPayloadPath: "choices[0].message.annotations[0].url" },
            { id: "same-answer", url: "https://provider.example/citation", domain: "provider.example", citationIndex: 1, source: "answer_text_url", citationType: "unknown" },
            { id: "ordinary", url: "https://ordinary.example/reference", domain: "ordinary.example", citationIndex: 2, source: "answer_text_url", citationType: "unknown" },
          ]
        : [{ id: "offline-url", url: "https://ordinary.example/reference", domain: "ordinary.example", citationIndex: 0, source: "answer_text_url", citationType: "unknown" }],
      webQueries: native ? ["fixture"] : [],
      search: { requested: native, requestMode: native ? "provider_native" : "auto", used: native, usedMode: native ? "provider_native" : "none", endpointKind: "official_api", endpointProtocol: "chat_completions", endpointUrl: "https://provider.example", toolName: native ? "fixture-native" : undefined, webQueries: native ? ["fixture"] : [], citationCount: native ? 1 : 0, executionMode: native ? "native" : "unverified" },
      tokenUsage: { input: 10, output: 20, total: 30 },
      latencyMs: 1,
      createdAt: "2026-09-06T00:00:00.000Z",
    };
  }

  private async executeCompatibilityResponse(input: Parameters<RecognitionAnswerExecutor["execute"]>[0], text: string): Promise<AnswerResult> {
    const native = input.modelSnapshot.webSearchMode === "provider_native";
    return {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: fixture adapter",
      resultCaveat: "Test fixture only",
      model: input.modelSnapshot.modelId,
      modelVersion: input.modelSnapshot.modelId,
      text,
      rawProviderResponse: { choices: [{ finish_reason: "stop", message: { annotations: [{ url: "https://provider.example/citation", title: "Provider fixture citation" }] } }] },
      citations: native ? [{ id: "provider", url: "https://provider.example/citation", domain: "provider.example", title: "Provider fixture citation", citationIndex: 0, source: "provider_annotation", citationType: "unknown", providerPayloadPath: "choices[0].message.annotations[0].url" }] : [],
      webQueries: [],
      search: { requested: native, requestMode: native ? "provider_native" : "auto", used: native, usedMode: native ? "provider_native" : "none", endpointKind: "official_api", endpointProtocol: "chat_completions", endpointUrl: "https://provider.example", webQueries: [], citationCount: native ? 1 : 0, executionMode: native ? "native" : "unverified" },
      tokenUsage: { input: 10, output: 20, total: 30 },
      latencyMs: 1,
      createdAt: "2026-09-06T00:00:00.000Z",
    };
  }
}

const port = Number(process.env.PORT || 8787);
createProductServer({ modelCatalog: new FixtureCatalog(), recognitionExecutor: new FixtureExecutor() }).listen(port);
