import { createProductServer } from "../../src/product/product-server.js";
import type { AnswerResult } from "../../src/core/types.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../../src/product/configuration/model-selection-schema.js";
import type { RecognitionAnswerExecutor } from "../../src/product/recognition/recognition-service.js";
import { ProviderRequestError } from "../../src/providers/provider-error.js";

const checkedAt = "2026-09-07T00:00:00.000Z";

const models: ProviderModelCatalogItem[] = [
  { providerId: "openrouter", modelId: "fixture/model-a", displayName: "Fixture Model A", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt, source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "fixture/model-b", displayName: "Fixture Model B", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt, source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "fixture/model-c", displayName: "Fixture Model C", available: true, unavailableReason: null, nativeWebSearchSupported: true, checkedAt, source: "local_capability_registry" },
  { providerId: "openrouter", modelId: "fixture/model-d", displayName: "Fixture Model D", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt, source: "local_capability_registry" },
];

class FixtureCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    return models.map((model) => ({ ...model }));
  }
}

function outputFor(modelId: string): string {
  if (modelId === "fixture/model-b") {
    return JSON.stringify({
      analysisStatus: "unknown",
      domainRecognition: "unknown",
      recognizedBrand: { value: null, citationUrls: [] },
      businessDescription: { value: null, citationUrls: [] },
      productCategory: { value: null, citationUrls: [] },
      competitors: [],
      brandKeywords: [],
      unknowns: ["本次无法确认 target.example。"],
    });
  }
  if (modelId === "fixture/model-c") {
    return JSON.stringify({
      analysisStatus: "recognized",
      domainRecognition: "recognized",
      recognizedBrand: { value: "TargetDocs", citationUrls: ["https://source.example/forge"] },
      businessDescription: { value: "团队知识库工具", citationUrls: ["https://source.example/forge"] },
      productCategory: { value: "协作工具", citationUrls: [] },
      competitors: [
        { name: "Forge", domain: "forge.example", businessDescription: "文档协作平台", productCategory: "协作工具", keywords: [{ keyword: "API 文档", citationUrls: ["https://source.example/forge"] }, { keyword: "搜索", citationUrls: [] }], citationUrls: ["https://source.example/forge"] },
        { name: "Forge", domain: "forge-alt.example", businessDescription: "团队协作产品", productCategory: "协作工具", keywords: [{ keyword: "团队协作", citationUrls: [] }], citationUrls: [] },
      ],
      brandKeywords: [{ keyword: "API 文档", citationUrls: ["https://source.example/forge"] }, { keyword: "站内搜索", citationUrls: [] }],
      unknowns: [],
    });
  }
  return JSON.stringify({
    analysisStatus: "recognized",
    domainRecognition: "recognized",
    recognizedBrand: { value: "TargetDocs", citationUrls: [] },
    businessDescription: { value: "开发者文档工具", citationUrls: [] },
    productCategory: { value: "开发者工具", citationUrls: [] },
    competitors: [
      { name: "Forge", domain: "forge.example", businessDescription: "文档管理产品", productCategory: "开发者工具", keywords: [{ keyword: "API 文档", citationUrls: [] }, { keyword: "版本管理", citationUrls: [] }], citationUrls: [] },
      { name: "Beacon", domain: "beacon.example", businessDescription: "团队知识库", productCategory: "知识管理", keywords: [{ keyword: "知识库", citationUrls: [] }], citationUrls: [] },
    ],
    brandKeywords: [{ keyword: "API 文档", citationUrls: [] }, { keyword: "开源文档", citationUrls: [] }],
    unknowns: [],
  });
}

class FixtureExecutor implements RecognitionAnswerExecutor {
  async execute(input: Parameters<RecognitionAnswerExecutor["execute"]>[0]): Promise<AnswerResult> {
    const modelId = input.modelSnapshot.modelId;
    if (modelId === "fixture/model-d") throw new ProviderRequestError({ code: "upstream_unavailable", message: "Fixture provider timeout" });
    const native = input.modelSnapshot.webSearchMode === "provider_native";
    const text = outputFor(modelId);
    return {
      providerId: "openrouter",
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: phase 4 fixture adapter",
      resultCaveat: "Test fixture only",
      model: modelId,
      modelVersion: modelId,
      text,
      structuredOutput: { transport: native ? "function_tool" : "response_json_schema", value: text },
      rawProviderResponse: native ? { choices: [{ message: { annotations: [{ url: "https://source.example/forge", title: "Forge source" }] } }] } : { choices: [{ message: { content: text } }] },
      citations: native
        ? [
            { id: "fixture-citation", url: "https://source.example/forge", domain: "source.example", title: "Forge source", citationIndex: 0, source: "provider_annotation", citationType: "unknown", providerPayloadPath: "choices[0].message.annotations[0].url" },
            { id: "fixture-answer-url", url: "https://source.example/forge", domain: "source.example", citationIndex: 1, source: "answer_text_url", citationType: "unknown" },
          ]
        : [{ id: "fixture-answer-url", url: "https://ordinary.example/targetdocs", domain: "ordinary.example", citationIndex: 0, source: "answer_text_url", citationType: "unknown" }],
      webQueries: native ? ["target.example"] : [],
      search: { requested: native, requestMode: native ? "provider_native" : "auto", used: native, usedMode: native ? "provider_native" : "none", endpointKind: "official_api", endpointProtocol: "chat_completions", endpointUrl: "https://fixture.invalid", toolName: native ? "fixture-native" : undefined, webQueries: native ? ["target.example"] : [], citationCount: native ? 1 : 0, executionMode: native ? "native" : "unverified" },
      tokenUsage: { input: 10, output: 20, total: 30 },
      costUsd: native ? 0.001 : 0.0005,
      latencyMs: 1,
      createdAt: checkedAt,
    };
  }
}

const port = Number(process.env.PORT || 8787);
createProductServer({ modelCatalog: new FixtureCatalog(), recognitionExecutor: new FixtureExecutor() }).listen(port);
