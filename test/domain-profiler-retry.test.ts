import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
import { DomainProfiler } from "../src/profile/domain-profiler.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";
import { FileStore } from "../src/store/file-store.js";

const originalFetch = globalThis.fetch;

class EmptyThenProfileProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "profile-test",
    label: "Profile Test",
    sourceType: "api",
    envKeys: [],
    defaultModels: ["model"],
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };
  readonly maxTokenAttempts: number[] = [];

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.maxTokenAttempts.push(input.maxTokens);
    if (this.maxTokenAttempts.length < 3) {
      throw new ProviderRequestError({ code: "empty_answer", message: "Provider returned an empty answer." });
    }
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: Profile Test API",
      resultCaveat: "test",
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify({
        domain: "example.test",
        brandName: "Example",
        aliases: [],
        category: "software service",
        description: "A test software service.",
        competitors: [],
        promptSuggestions: [{
          type: "brand",
          topic: "identity",
          prompt: "What does Example provide?",
          auditCategory: "brand_awareness",
          targetIncluded: true,
        }],
      }),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("domain profiling uses the unified empty-answer retry policy", async () => {
  const previousBase = process.env.PROVIDER_RETRY_BASE_MS;
  const previousAttempts = process.env.PROVIDER_RUN_ATTEMPTS;
  process.env.PROVIDER_RETRY_BASE_MS = "1";
  process.env.PROVIDER_RUN_ATTEMPTS = "4";
  globalThis.fetch = async () => new Response(
    "<!doctype html><html><head><title>Example</title></head><body><h1>Example service</h1></body></html>",
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
  try {
    const provider = new EmptyThenProfileProvider();
    const result = await new DomainProfiler().discover({
      auditId: "profile-retry",
      domain: "example.test",
      language: "en",
      desiredPrompts: 1,
      provider,
      model: "model",
      apiKey: "key",
      store: new FileStore("/tmp/niubigeo-profile-retry"),
    });

    assert.equal(result.profile.brandName, "Example");
    assert.deepEqual(provider.maxTokenAttempts, [1600, 3200, 4000]);
  } finally {
    if (previousBase === undefined) delete process.env.PROVIDER_RETRY_BASE_MS;
    else process.env.PROVIDER_RETRY_BASE_MS = previousBase;
    if (previousAttempts === undefined) delete process.env.PROVIDER_RUN_ATTEMPTS;
    else process.env.PROVIDER_RUN_ATTEMPTS = previousAttempts;
  }
});
