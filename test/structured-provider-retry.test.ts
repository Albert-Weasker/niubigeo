import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { Entity, MonitoringPrompt, PromptRun, ProviderDefinition } from "../src/core/types.js";
import { CompetitorDiscovery } from "../src/analyzer/competitor-discovery.js";
import { MonitoringPromptIntentClassifier } from "../src/prompts/monitoring-prompt-intent-classifier.js";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";

const definition: ProviderDefinition = {
  id: "structured-retry-test",
  label: "Structured Retry Test",
  sourceType: "api",
  envKeys: [],
  defaultModels: ["test-model"],
  supportsJsonSchema: true,
  supportsNativeCitations: false,
  supportsWebSearch: false,
  resultCaveat: "Test",
};

const target: Entity = { id: "example", type: "target", name: "Example", domain: "example.com", aliases: [] };
const prompt: MonitoringPrompt = {
  id: "question-a",
  type: "brand",
  topic: "brand question",
  language: "en",
  text: "What does Example provide?",
  enabled: true,
  auditCategory: "brand_awareness",
  targetIncluded: true,
};

function retryFixture(t: TestContext, output: unknown): {
  provider: OpenAICompatibleProvider;
  budgets: number[];
  responseFormats: string[];
} {
  const overrides = {
    PROVIDER_RETRY_BASE_MS: "1",
    PROVIDER_RUN_ATTEMPTS: "2",
    PROVIDER_EMPTY_ANSWER_MAX_TOKENS: "4000",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const budgets: number[] = [];
  const responseFormats: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    budgets.push(body.max_tokens);
    responseFormats.push(body.response_format?.type);
    const truncated = budgets.length === 1;
    return new Response(JSON.stringify({
      choices: [{
        finish_reason: truncated ? "length" : "stop",
        message: { content: truncated ? null : JSON.stringify(output) },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return {
    provider: new OpenAICompatibleProvider({ definition, endpoint: "https://provider.example/chat/completions" }),
    budgets,
    responseFormats,
  };
}

test("monitoring intent classification retries an empty token-limited JSON-schema response", async (t) => {
  const fixture = retryFixture(t, {
    questions: [{
      questionId: prompt.id,
      intents: ["product_understanding"],
      candidateApplicable: false,
      recommendationApplicable: false,
      reason: "The question requests an explanation.",
    }],
  });
  const result = await new MonitoringPromptIntentClassifier().classify({
    target,
    language: "en",
    prompts: [prompt],
    provider: fixture.provider,
    model: "test-model",
    apiKey: "fixture-key",
  });

  assert.deepEqual(fixture.budgets, [2400, 4000]);
  assert.deepEqual(fixture.responseFormats, ["json_schema", "json_schema"]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.intentProfile?.status, "completed");
  assert.deepEqual(result[0]?.intentProfile?.intents, ["product_understanding"]);
});

test("competitor discovery retries an empty token-limited JSON-schema response", async (t) => {
  const competitor = {
    name: "Other",
    domain: "other.example",
    reason: "An alternative for the same users.",
    relationship: "direct_competitor",
    confidence: 0.9,
  };
  const fixture = retryFixture(t, { competitors: [competitor] });
  const completedRun: PromptRun = {
    id: "run-a",
    prompt,
    target,
    competitors: [],
    providerId: definition.id,
    model: "test-model",
    webSearchEnabled: false,
    sourceType: "api",
    sourceLabel: "Source: Structured Retry Test API",
    status: "completed",
    startedAt: "2026-09-08T00:00:00.000Z",
    finishedAt: "2026-09-08T00:00:01.000Z",
    result: {
      providerId: definition.id,
      providerName: definition.label,
      sourceType: "api",
      sourceLabel: "Source: Structured Retry Test API",
      resultCaveat: "Test",
      model: "test-model",
      modelVersion: "test-model",
      text: "Other at other.example is an alternative to Example.",
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: "2026-09-08T00:00:01.000Z",
    },
  };
  const result = await new CompetitorDiscovery().discover({
    target,
    existingCompetitors: [],
    runs: [completedRun],
    language: "en",
    provider: fixture.provider,
    model: "test-model",
    apiKey: "fixture-key",
  });

  assert.deepEqual(fixture.budgets, [900, 1800]);
  assert.deepEqual(fixture.responseFormats, ["json_schema", "json_schema"]);
  assert.deepEqual(result, [competitor]);
});
