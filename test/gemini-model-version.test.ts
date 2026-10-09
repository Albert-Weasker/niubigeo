import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
const definition: ProviderDefinition = { id: "fixture", label: "Fixture", sourceType: "api", envKeys: ["FIXTURE_API_KEY"], defaultModels: ["fixture-model"], supportsNativeCitations: true, supportsWebSearch: true, resultCaveat: "Fixture only" };
const input: ProviderRunInput = { apiKey: "fixture-key", model: "fixture-model", prompt: "fixture prompt", maxTokens: 8000, temperature: 0, webSearchEnabled: false };
const result: AnswerResult = { providerId: definition.id, providerName: definition.label, sourceType: "api", sourceLabel: "Source: Fixture API", resultCaveat: "Fixture only", model: input.model, modelVersion: input.model, text: "answer", citations: [], webQueries: [], latencyMs: 0, createdAt: new Date().toISOString() };
import { GeminiProvider } from "../src/providers/gemini.js";
test("Gemini retains resolved model version without changing requested alias", async () => {
 const original=globalThis.fetch;
 globalThis.fetch=async () => Response.json({modelVersion:"gemini-fixture-001",candidates:[{content:{parts:[{text:"answer"}]}}]});
 try { const answer=await new GeminiProvider(definition).run(input); assert.equal(answer.modelVersion,"gemini-fixture-001"); assert.equal(answer.model,input.model); }
 finally { globalThis.fetch=original; }
});
test("Gemini version fallback remains the request alias", async () => {
 const original=globalThis.fetch; globalThis.fetch=async () => Response.json({modelVersion:" ",candidates:[{content:{parts:[{text:"answer"}]}}]});
 try { assert.equal((await new GeminiProvider(definition).run(input)).modelVersion,input.model); } finally {globalThis.fetch=original;}
});
