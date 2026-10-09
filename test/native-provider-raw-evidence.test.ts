import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
const definition: ProviderDefinition = { id: "fixture", label: "Fixture", sourceType: "api", envKeys: ["FIXTURE_API_KEY"], defaultModels: ["fixture-model"], supportsNativeCitations: true, supportsWebSearch: true, resultCaveat: "Fixture only" };
const input: ProviderRunInput = { apiKey: "fixture-key", model: "fixture-model", prompt: "fixture prompt", maxTokens: 8000, temperature: 0, webSearchEnabled: false };
const result: AnswerResult = { providerId: definition.id, providerName: definition.label, sourceType: "api", sourceLabel: "Source: Fixture API", resultCaveat: "Fixture only", model: input.model, modelVersion: input.model, text: "answer", citations: [], webQueries: [], latencyMs: 0, createdAt: new Date().toISOString() };
import { GeminiProvider } from "../src/providers/gemini.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
test("native provider answers retain their original response and citation paths",async()=>{
 const original=globalThis.fetch;
 const cases:[AnswerProvider,unknown][]=[
  [new GeminiProvider(definition),{candidates:[{content:{parts:[{text:"answer"}]},groundingMetadata:{groundingChunks:[{web:{uri:"https://example.com/evidence",title:"Evidence"}}]}}]}],
  [new AnthropicProvider(definition),{content:[{type:"text",text:"answer",citations:[{url:"https://example.com/evidence",title:"Evidence"}]}]}],
 ];
 try{for(const [provider,payload] of cases){globalThis.fetch=async()=>Response.json(payload);const answer=await provider.run(input);assert.deepEqual(answer.rawProviderResponse,payload);assert.equal(answer.citations.length,1);assert.ok(answer.citations[0]?.providerPayloadPath);assert.equal(answer.sourceLabel,"Source: Fixture API");}}
 finally{globalThis.fetch=original;}
});

import { withRequestProviderKeys } from "../src/config/env.js";
test("native response evidence retains request-scoped credential redaction",async()=>{
 const original=globalThis.fetch;
 try {
  for(const provider of [new GeminiProvider(definition),new AnthropicProvider(definition)]) {
   globalThis.fetch=async()=>Response.json({api_key:input.apiKey,debug:"echo "+input.apiKey,candidates:[{content:{parts:[{text:"answer"}]}}],content:[{type:"text",text:"answer"}]});
   const answer=await withRequestProviderKeys({fixture:input.apiKey},()=>provider.run(input));
   const raw=answer.rawProviderResponse as {api_key:string;debug:string};
   assert.equal(raw.api_key,"[REDACTED]");assert.equal(raw.debug,"echo [REDACTED]");
  }
 } finally {globalThis.fetch=original;}
});
