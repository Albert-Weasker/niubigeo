import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
const definition: ProviderDefinition = { id: "fixture", label: "Fixture", sourceType: "api", envKeys: ["FIXTURE_API_KEY"], defaultModels: ["fixture-model"], supportsNativeCitations: true, supportsWebSearch: true, resultCaveat: "Fixture only" };
const input: ProviderRunInput = { apiKey: "fixture-key", model: "fixture-model", prompt: "fixture prompt", maxTokens: 8000, temperature: 0, webSearchEnabled: false };
const result: AnswerResult = { providerId: definition.id, providerName: definition.label, sourceType: "api", sourceLabel: "Source: Fixture API", resultCaveat: "Fixture only", model: input.model, modelVersion: input.model, text: "answer", citations: [], webQueries: [], latencyMs: 0, createdAt: new Date().toISOString() };
import { ProviderRequestError } from "../src/providers/provider-error.js";
import { runProviderWithRetry } from "../src/providers/provider-retry.js";
test("a telemetry failure does not rerun a successful paid operation", async () => {
 const prior=process.env.PROVIDER_RUN_ATTEMPTS;process.env.PROVIDER_RUN_ATTEMPTS="2";let calls=0;let events=0;
 const error=new ProviderRequestError({code:"rate_limited",message:"telemetry unavailable"});
 const provider:AnswerProvider={definition,async run(){calls++;return result;}};
 try {await assert.rejects(runProviderWithRetry(provider,input,{context:{purpose:"audit_answer"},onAttempt(){events++;throw error;}}),e=>e===error);assert.equal(calls,1);assert.equal(events,1);}
 finally {if(prior===undefined)delete process.env.PROVIDER_RUN_ATTEMPTS;else process.env.PROVIDER_RUN_ATTEMPTS=prior;}
});
