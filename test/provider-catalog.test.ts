import test from "node:test";
import assert from "node:assert/strict";
import { ProviderCatalog, PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";
import { providerEnvKeys } from "../src/config/env.js";

test("core provider catalog has no fake provider and keeps key routing provider-specific", () => {
  assert.equal(PROVIDER_DEFINITIONS.some((provider) => provider.id.toLowerCase().includes("mock")), false);
  assert.deepEqual(providerEnvKeys("openai"), ["OPENAI_API_KEY"]);
  assert.deepEqual(providerEnvKeys("gemini"), ["GEMINI_API_KEY"]);
  assert.deepEqual(providerEnvKeys("openrouter"), ["OPENROUTER_API_KEY", "OPENROUTER_KEY"]);
});

test("catalog validates direct models and lets OpenRouter carry routed model ids", () => {
  const catalog = new ProviderCatalog();
  assert.doesNotThrow(() => catalog.validate("openrouter", "anthropic/claude-3.5-haiku"));
  assert.throws(() => catalog.validate("openai", "google/gemini-flash-1.5"));
});
