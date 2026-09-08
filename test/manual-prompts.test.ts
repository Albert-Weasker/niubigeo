import test from "node:test";
import assert from "node:assert/strict";
import { PromptGenerator } from "../src/prompts/prompt-generator.js";
import { BrandQuestionScopeError } from "../src/prompts/brand-question.js";
import { entityFromInput } from "../src/utils/domain.js";
import { BRAND_QUESTION_INTENTS, type AnswerProvider, type AnswerResult, type ProviderDefinition, type ProviderRunInput } from "../src/core/types.js";

class ManualPromptProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "test",
    label: "Test",
    sourceType: "api",
    envKeys: [],
    defaultModels: ["test-model"],
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };
  calls = 0;

  constructor(private readonly payload: unknown) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.calls += 1;
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: Test API",
      resultCaveat: "test",
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify(this.payload),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

class StructuredManualPromptProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "structured-test",
    label: "Structured Test",
    sourceType: "api",
    envKeys: [],
    defaultModels: ["test-model"],
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "test",
  };
  calls: string[] = [];

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const schemaName = input.responseJsonSchema?.name || "unstructured";
    this.calls.push(schemaName);
    const intentDecisions = {
      product_understanding: false,
      brand_evaluation: false,
      recommendation: false,
      comparison: false,
      alternative: false,
      pricing: false,
      product_fit: true,
      product_usage: false,
      purchase_decision: false,
      risk_evaluation: false,
      adoption: false,
      source_analysis: false,
    };
    let payload: unknown = {
      questions: [{ domainMatched: true, targetBrand: "Acme", intents: ["product_fit"], intentDecisions }],
    };
    const adjudicatedIntent = BRAND_QUESTION_INTENTS.find((intent) => schemaName === `brand_intent_${intent}`);
    if (adjudicatedIntent) {
      payload = {
        questions: [{
          intentDecisions: {
            [adjudicatedIntent]: adjudicatedIntent === "brand_evaluation" || adjudicatedIntent === "product_fit",
          },
        }],
      };
    }
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: "Source: Structured Test API",
      resultCaveat: "test",
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify(payload),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

const target = entityFromInput({
  type: "target",
  domain: "acme.example",
  name: "Acme",
  aliases: ["Acme Cloud"],
});

test("accepts the minimal brand-question classification contract", async () => {
  const provider = new ManualPromptProvider({
    questions: [
      { domainMatched: true, targetBrand: "Acme", intents: ["product_understanding", "brand_evaluation"] },
      { domainMatched: true, targetBrand: "Acme", intents: ["comparison"] },
    ],
  });
  const prompts = await new PromptGenerator().classifyManual({
    target,
    language: "en",
    prompts: ["What does Acme provide, and is it suitable for teams?", "How does Acme compare with another platform?"],
    provider,
    model: "test-model",
    apiKey: "test-key",
  });

  assert.equal(provider.calls, 1);
  assert.equal(prompts.length, 2);
  assert.equal(prompts[0]?.type, "brand");
  assert.equal(prompts[0]?.topic, "brand-question");
  assert.equal(prompts[0]?.auditCategory, "brand_awareness");
  assert.equal(prompts[0]?.targetIncluded, true);
  assert.deepEqual(prompts[0]?.brandQuestion?.intents, ["product_understanding", "brand_evaluation"]);
  assert.equal(prompts[0]?.brandQuestion?.reason, undefined);
});

test("rejects a question without a target identity before any provider call", async () => {
  const provider = new ManualPromptProvider({ questions: [] });
  await assert.rejects(
    new PromptGenerator().classifyManual({
      target,
      language: "en",
      prompts: ["How should a team deploy an unrelated service?"],
      provider,
      model: "test-model",
      apiKey: "test-key",
    }),
    BrandQuestionScopeError,
  );
  assert.equal(provider.calls, 0);
});

test("accepts an exact domain or known alias as the target identity anchor", async () => {
  const provider = new ManualPromptProvider({
    questions: [
      { domainMatched: true, targetBrand: "Acme", intents: ["source_analysis"], reason: "The question asks about the target source." },
      { domainMatched: true, targetBrand: "Acme", intents: ["product_fit"] },
    ],
  });
  const prompts = await new PromptGenerator().classifyManual({
    target,
    language: "en",
    prompts: ["Which claims are supported by acme.example?", "Is Acme Cloud suitable for this team?"],
    provider,
    model: "test-model",
    apiKey: "test-key",
  });
  assert.equal(provider.calls, 1);
  assert.equal(prompts.length, 2);
});

test("rejects a branded question when provider semantic classification finds no product relationship", async () => {
  const provider = new ManualPromptProvider({
    questions: [
      { domainMatched: false, targetBrand: "Acme", intents: ["product_understanding"], reason: "The name is present but the question is not about the product." },
    ],
  });
  await assert.rejects(
    new PromptGenerator().classifyManual({
      target,
      language: "en",
      prompts: ["Write a poem that contains the word Acme."],
      provider,
      model: "test-model",
      apiKey: "test-key",
    }),
    BrandQuestionScopeError,
  );
  assert.equal(provider.calls, 1);
});

test("missing legacy classification fields never terminate a valid brand question", async () => {
  const provider = new ManualPromptProvider({
    questions: [{ domainMatched: true, targetBrand: "Acme", intents: ["pricing"] }],
  });
  const prompts = await new PromptGenerator().classifyManual({
    target,
    language: "en",
    prompts: ["How is Acme priced?"],
    provider,
    model: "test-model",
    apiKey: "test-key",
  });
  assert.equal(prompts[0]?.brandQuestion?.status, "complete");
});

test("AI intent decisions augment the compact intent list without text rules", async () => {
  const provider = new ManualPromptProvider({
    questions: [{
      domainMatched: true,
      targetBrand: "Acme",
      intents: ["product_fit"],
      intentDecisions: {
        product_fit: true,
        brand_evaluation: true,
        pricing: false,
      },
    }],
  });
  const prompts = await new PromptGenerator().classifyManual({
    target,
    language: "en",
    prompts: ["Is Acme suitable for a small team?"],
    provider,
    model: "test-model",
    apiKey: "test-key",
  });
  assert.deepEqual(prompts[0]?.brandQuestion?.intents, ["product_fit", "brand_evaluation"]);
  assert.equal(prompts[0]?.brandQuestion?.intentChecks?.length, 3);
});

test("focused AI adjudicators augment overlapping intents without text classification", async () => {
  const provider = new StructuredManualPromptProvider();
  const prompts = await new PromptGenerator().classifyManual({
    target,
    language: "en",
    prompts: ["Is Acme suitable for a small team?"],
    provider,
    model: "test-model",
    apiKey: "test-key",
  });

  assert.deepEqual(provider.calls, [
    "brand_question_classification",
    ...BRAND_QUESTION_INTENTS.map((intent) => `brand_intent_${intent}`),
  ]);
  assert.deepEqual(prompts[0]?.brandQuestion?.intents, ["brand_evaluation", "product_fit"]);
  assert.equal(prompts[0]?.brandQuestion?.intentChecks?.length, 12);
});
