import type { AnswerResult } from "../../src/core/types.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../../src/product/configuration/model-selection-schema.js";
import type { RecognitionAnswerExecutor } from "../../src/product/recognition/recognition-service.js";
import { ProviderRequestError } from "../../src/providers/provider-error.js";

export const phase5FixtureModels: ProviderModelCatalogItem[] = [
  { providerId: "openrouter", modelId: "phase5/off", displayName: "Phase 5 Offline", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/native", displayName: "Phase 5 Native", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/failing", displayName: "Phase 5 Failing", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/unsupported", displayName: "Phase 5 Unsupported", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/added", displayName: "Phase 5 Added", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/weights", displayName: "Phase 5 Weights", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/comparison", displayName: "Phase 5 Comparison", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "phase5/text-url", displayName: "Phase 5 Text URL", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-07T00:00:00.000Z", source: "local_capability_registry" },
];

export class Phase5FixtureCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> { return phase5FixtureModels.map((item) => ({ ...item })); }
}

function domainOutput(keywords = ["workflow", "automation"]): string {
  return JSON.stringify({
    analysisStatus: "recognized", domainRecognition: "recognized",
    recognizedBrand: { value: "Target Product", citationUrls: [] },
    businessDescription: { value: "A workflow product", citationUrls: [] },
    productCategory: { value: "Business software", citationUrls: [] },
    competitors: [{ name: "Rival Product", domain: "rival.example", businessDescription: "A related workflow product", productCategory: "Business software", keywords: keywords.map((keyword) => ({ keyword, citationUrls: [] })), citationUrls: [] }],
    brandKeywords: keywords.map((keyword) => ({ keyword, citationUrls: [] })),
    unknowns: [],
  });
}

function discoveryOutput(): string {
  return JSON.stringify({
    analysisStatus: "completed",
    mentions: [
      { name: "Other Product", domain: "other.example", recommendation: "positive", mentionQuote: "Other Product", recommendationQuote: "recommended", firstMentionOffset: 0, firstRecommendationOffset: 14, firstMentionState: "unique", firstRecommendationState: "unique" },
      { name: "Target Product", domain: "target.example", recommendation: "negative", mentionQuote: "Target Product", recommendationQuote: "not recommended", firstMentionOffset: 29, firstRecommendationOffset: 44, firstMentionState: "none", firstRecommendationState: "none" },
      { name: "Rival Product", domain: "rival.example", recommendation: "positive", mentionQuote: "Rival Product", recommendationQuote: "recommended", firstMentionOffset: 60, firstRecommendationOffset: 74, firstMentionState: "none", firstRecommendationState: "none" },
    ],
    unknowns: [],
  });
}

function comparisonDiscoveryOutput(sample: number): { text: string; structured: string } {
  if (sample === 1) {
    const text = "Target Product is recommended. Rival Product is also recommended.";
    return { text, structured: JSON.stringify({ analysisStatus: "completed", mentions: [
      { name: "Target Product", domain: "target.example", recommendation: "positive", mentionQuote: "Target Product", recommendationQuote: "recommended", firstMentionOffset: text.indexOf("Target Product"), firstRecommendationOffset: text.indexOf("recommended"), firstMentionState: "unique", firstRecommendationState: "unique" },
      { name: "Rival Product", domain: "rival.example", recommendation: "positive", mentionQuote: "Rival Product", recommendationQuote: "also recommended", firstMentionOffset: text.indexOf("Rival Product"), firstRecommendationOffset: text.indexOf("also recommended"), firstMentionState: "none", firstRecommendationState: "none" },
    ], unknowns: [] }) };
  }
  if (sample === 2) {
    const text = "Rival Product is recommended. Target Product is mentioned.";
    return { text, structured: JSON.stringify({ analysisStatus: "completed", mentions: [
      { name: "Rival Product", domain: "rival.example", recommendation: "positive", mentionQuote: "Rival Product", recommendationQuote: "recommended", firstMentionOffset: text.indexOf("Rival Product"), firstRecommendationOffset: text.indexOf("recommended"), firstMentionState: "unique", firstRecommendationState: "unique" },
      { name: "Target Product", domain: "target.example", recommendation: "negative", mentionQuote: "Target Product", recommendationQuote: "not selected", firstMentionOffset: text.indexOf("Target Product"), firstRecommendationOffset: null, firstMentionState: "none", firstRecommendationState: "none" },
    ], unknowns: [] }) };
  }
  if (sample === 3) {
    const text = "Rival Product is recommended.";
    return { text, structured: JSON.stringify({ analysisStatus: "completed", mentions: [
      { name: "Rival Product", domain: "rival.example", recommendation: "positive", mentionQuote: "Rival Product", recommendationQuote: "recommended", firstMentionOffset: text.indexOf("Rival Product"), firstRecommendationOffset: text.indexOf("recommended"), firstMentionState: "unique", firstRecommendationState: "unique" },
    ], unknowns: [] }) };
  }
  return { text: "No product can be determined.", structured: JSON.stringify({ analysisStatus: "unknown", mentions: [], unknowns: ["undetermined"] }) };
}

export class Phase5FixtureExecutor implements RecognitionAnswerExecutor {
  readonly calls: Array<{ modelId: string; prompt: string; schemaName: string | null; webSearchMode: string }> = [];
  private failures = new Map<string, number>();
  private domainSamples = new Map<string, number>();
  private keywordSamples = new Map<string, number>();

  async execute(input: Parameters<RecognitionAnswerExecutor["execute"]>[0]): Promise<AnswerResult> {
    const modelId = input.modelSnapshot.modelId;
    const schemaName = input.structuredOutput?.name || null;
    this.calls.push({ modelId, prompt: input.prompt, schemaName, webSearchMode: input.modelSnapshot.webSearchMode });
    if (modelId === "phase5/unsupported") throw new ProviderRequestError({ code: "unsupported_capability", message: "Fixture native search is unsupported." });
    if (modelId === "phase5/failing") {
      const count = (this.failures.get(modelId) || 0) + 1;
      this.failures.set(modelId, count);
      if (count === 1) throw new ProviderRequestError({ code: "upstream_unavailable", message: "Fixture provider timeout." });
    }
    const native = input.modelSnapshot.webSearchMode === "provider_native";
    const isKeyword = schemaName === "keyword_discovery_result";
    const domainKind = input.prompt.includes("rival.example") ? "rival" : "target";
    const domainKey = modelId + "|" + domainKind;
    const keywordCount = (this.keywordSamples.get(modelId) || 0) + 1;
    if (isKeyword) this.keywordSamples.set(modelId, keywordCount);
    const domainCount = (this.domainSamples.get(domainKey) || 0) + 1;
    if (!isKeyword) this.domainSamples.set(domainKey, domainCount);
    const weighted = modelId === "phase5/weights";
    const weightKeywords = domainKind === "target"
      ? domainCount === 1 ? ["API documentation", "Knowledge base"] : ["API documentation"]
      : domainCount === 1 ? ["API documentation", "Knowledge base"] : ["Knowledge base"];
    const comparison = modelId === "phase5/comparison" && isKeyword ? comparisonDiscoveryOutput(keywordCount) : null;
    const text = comparison ? comparison.text : isKeyword
      ? modelId === "phase5/text-url" ? "Target Product is listed at https://target.example/reference" : "Other Product recommended. Target Product is not recommended. Rival Product is recommended. https://ordinary.example/reference"
      : "Target Product is a workflow product associated with workflow and automation.";
    const structured = comparison ? comparison.structured : isKeyword ? discoveryOutput() : domainOutput(weighted ? weightKeywords : undefined);
    return {
      providerId: "openrouter", providerName: "OpenRouter", sourceType: "api", sourceLabel: "Source: phase 5 fixture", resultCaveat: "Test fixture only",
      model: modelId, modelVersion: modelId, text, structuredOutput: { transport: native ? "function_tool" : "response_json_schema", value: structured },
      rawProviderResponse: native ? { output: [{ type: "web_search_call", results: [{ url: "https://target.example/reference", title: "Target reference" }] }] } : { choices: [{ message: { content: structured } }] },
      citations: native
        ? [
            { id: "provider-citation", url: "https://target.example/reference", domain: "target.example", title: "Target reference", citationIndex: 0, source: "provider_annotation", citationType: "unknown", providerPayloadPath: "output[0].results[0].url" },
            { id: "ordinary-url", url: "https://ordinary.example/reference", domain: "ordinary.example", citationIndex: 1, source: "answer_text_url", citationType: "unknown" },
          ]
        : [{ id: "ordinary-url", url: modelId === "phase5/text-url" ? "https://target.example/reference" : "https://ordinary.example/reference", domain: modelId === "phase5/text-url" ? "target.example" : "ordinary.example", citationIndex: 0, source: "answer_text_url", citationType: "unknown" }],
      webQueries: native ? ["workflow"] : [],
      search: { requested: native, requestMode: native ? "provider_native" : "auto", used: native, usedMode: native ? "provider_native" : "none", endpointKind: "official_api", endpointProtocol: "responses", endpointUrl: "https://fixture.invalid", toolName: native ? "web_search" : undefined, webQueries: native ? ["workflow"] : [], citationCount: native ? 1 : 0, executionMode: native ? "native" : "unverified" },
      tokenUsage: { input: 10, output: 20, total: 30 }, costUsd: native ? 0.001 : 0.0005, latencyMs: 1, createdAt: "2026-09-07T00:00:00.000Z",
    };
  }
}
