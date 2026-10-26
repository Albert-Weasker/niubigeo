import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
const definition: ProviderDefinition = { id: "fixture", label: "Fixture", sourceType: "api", envKeys: ["FIXTURE_API_KEY"], defaultModels: ["fixture-model"], supportsNativeCitations: true, supportsWebSearch: true, resultCaveat: "Fixture only" };
const input: ProviderRunInput = { apiKey: "fixture-key", model: "fixture-model", prompt: "fixture prompt", maxTokens: 8000, temperature: 0, webSearchEnabled: false };
const result: AnswerResult = { providerId: definition.id, providerName: definition.label, sourceType: "api", sourceLabel: "Source: Fixture API", resultCaveat: "Fixture only", model: input.model, modelVersion: input.model, text: "answer", citations: [], webQueries: [], latencyMs: 0, createdAt: new Date().toISOString() };
import { ProviderRequestError } from "../src/providers/provider-error.js";
import { runProviderWithRetry } from "../src/providers/provider-retry.js";
test("empty-answer recovery does not shrink an already larger token budget", async () => {
 const previous = process.env.PROVIDER_RUN_ATTEMPTS; process.env.PROVIDER_RUN_ATTEMPTS = "2";
 const seen: number[] = [];
 const provider: AnswerProvider = { definition, async run(value) { seen.push(value.maxTokens); if (seen.length === 1) throw new ProviderRequestError({code:"empty_answer", message:"empty"}); return result; } };
 try { await runProviderWithRetry(provider, input); assert.deepEqual(seen,[8000,8000]); }
 finally { if(previous === undefined) delete process.env.PROVIDER_RUN_ATTEMPTS; else process.env.PROVIDER_RUN_ATTEMPTS=previous; }
});
