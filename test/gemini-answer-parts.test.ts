import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
const definition: ProviderDefinition = { id: "fixture", label: "Fixture", sourceType: "api", envKeys: ["FIXTURE_API_KEY"], defaultModels: ["fixture-model"], supportsNativeCitations: true, supportsWebSearch: true, resultCaveat: "Fixture only" };
const input: ProviderRunInput = { apiKey: "fixture-key", model: "fixture-model", prompt: "fixture prompt", maxTokens: 8000, temperature: 0, webSearchEnabled: false };
const result: AnswerResult = { providerId: definition.id, providerName: definition.label, sourceType: "api", sourceLabel: "Source: Fixture API", resultCaveat: "Fixture only", model: input.model, modelVersion: input.model, text: "answer", citations: [], webQueries: [], latencyMs: 0, createdAt: new Date().toISOString() };
import { GeminiProvider } from "../src/providers/gemini.js";
test("Gemini thought summaries do not become answer or citation evidence", async () => {
 const original=globalThis.fetch;
 globalThis.fetch=async () => Response.json({ candidates:[{content:{parts:[{thought:true,text:"Consider https://internal.example/thought"},{text:"Actual answer"}]}}] });
 try { const answer=await new GeminiProvider(definition).run(input); assert.equal(answer.text,"Actual answer"); assert.deepEqual(answer.citations,[]); }
 finally { globalThis.fetch=original; }
});
