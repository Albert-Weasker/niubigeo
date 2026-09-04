import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, MonitoringPrompt, ProviderDefinition } from "../src/core/types.js";
import { AuditPlanner } from "../src/runner/audit-planner.js";
import { AuditRunner } from "../src/runner/audit-runner.js";
import { entityFromInput } from "../src/utils/domain.js";

function definition(id: string): ProviderDefinition {
  return {
    id,
    label: id,
    sourceType: "api",
    envKeys: [`${id.toUpperCase()}_API_KEY`],
    defaultModels: ["test-model"],
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };
}

function result(providerId: string): AnswerResult {
  return {
    providerId,
    providerName: providerId,
    sourceType: "api",
    sourceLabel: `Source: ${providerId} API`,
    resultCaveat: "test",
    model: "test-model",
    modelVersion: "test-model",
    text: "A test answer.",
    rawJson: null,
    citations: [],
    webQueries: [],
    latencyMs: 1,
    createdAt: new Date().toISOString(),
  };
}

function fakeProvider(id: string): AnswerProvider {
  return {
    definition: definition(id),
    async run() {
      return result(id);
    },
  };
}

test("planner accepts manual prompts when none of the selected providers has a key", async () => {
  const target = entityFromInput({ type: "target", domain: "example.com", name: "Example" });
  const plan = await new AuditPlanner().plan({
    target,
    competitors: [],
    providerTargets: [
      { providerId: "openai", model: "gpt-4o-mini" },
      { providerId: "gemini", model: "gemini-1.5-flash" },
    ],
    language: "en",
    promptCount: 1,
    manualPrompts: ["What should I use for this need?"],
    autoDiscover: false,
  });

  assert.equal(plan.prompts.length, 1);
  assert.equal(plan.estimate.providerRunCount, 2);
});

test("a missing key fails only that provider run", async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;

  try {
    const runner = new AuditRunner();
    const internal = runner as unknown as {
      catalog: { get: (id: string) => AnswerProvider; validate: (id: string, model: string) => void };
      executeProviderRun: (input: {
        task: { prompt: MonitoringPrompt; providerTarget: { providerId: string; model: string } };
        target: ReturnType<typeof entityFromInput>;
        competitors: ReturnType<typeof entityFromInput>[];
        maxTokens: number;
        temperature: number;
      }) => Promise<{ status: string; providerId: string; error?: string }>;
    };
    internal.catalog.get = (id: string) => fakeProvider(id);
    internal.catalog.validate = () => undefined;
    const target = entityFromInput({ type: "target", domain: "example.com", name: "Example" });
    const prompt: MonitoringPrompt = {
      id: "manual-example-1",
      type: "category",
      topic: "manual",
      language: "en",
      text: "What should I use for this need?",
      enabled: true,
    };

    const [available, missing] = await Promise.all([
      internal.executeProviderRun({
        task: { prompt, providerTarget: { providerId: "openai", model: "test-model" } },
        target,
        competitors: [],
        maxTokens: 100,
        temperature: 0,
      }),
      internal.executeProviderRun({
        task: { prompt, providerTarget: { providerId: "gemini", model: "test-model" } },
        target,
        competitors: [],
        maxTokens: 100,
        temperature: 0,
      }),
    ]);

    assert.equal(available.status, "completed");
    assert.equal(missing.status, "failed");
    assert.match(missing.error || "", /Missing API key for provider "gemini"/);
  } finally {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
  }
});
