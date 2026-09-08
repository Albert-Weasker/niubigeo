import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AnswerProvider,
  AnswerResult,
  Citation,
  Entity,
  ProviderDefinition,
  ProviderRunInput,
} from "../src/core/types.js";
import { IntentResultPipeline } from "../src/intent/intent-result-pipeline.js";
import { validateIntentRunAnalysis, type IntentName, type TargetBrandRole } from "../src/intent/intent-schema.js";

interface IntentSample {
  prompt: string;
  primaryIntent: IntentName;
  secondaryIntents?: IntentName[] | undefined;
  targetBrandRole: TargetBrandRole;
  requiresSources: boolean;
  requiresComparison: boolean;
  requiresRecommendation: boolean;
}

interface CapturedAnalysisCall {
  prompt: string;
  webSearchEnabled: boolean;
  model: string;
}

const TARGET: Entity = {
  id: "target-examplebrand-example.com",
  type: "target",
  name: "ExampleBrand",
  domain: "example.com",
  aliases: ["Example Brand"],
};

const CITATIONS: Citation[] = [
  {
    id: "citation-1",
    url: "https://example.com/docs",
    domain: "example.com",
    title: "ExampleBrand documentation",
    citationIndex: 1,
    source: "provider_annotation",
    citationType: "target_official",
  },
];

const SHARED_QUOTE = "The answer provides verifiable evidence for this requirement.";
const ENTITY_QUOTE = "AcmeList is presented as an option in the answer.";

const SAMPLES: IntentSample[] = [
  {
    prompt: "What does ExampleBrand provide, and is it suitable for a small team?",
    primaryIntent: "product_understanding",
    secondaryIntents: ["brand_evaluation"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Compare ExampleBrand and AtlasFlow for a production team.",
    primaryIntent: "comparison",
    secondaryIntents: ["purchase_decision"],
    targetBrandRole: "comparison_party",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "Is AtlasFlow a practical alternative to ExampleBrand, and should I switch?",
    primaryIntent: "alternative",
    secondaryIntents: ["brand_evaluation"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "How much does ExampleBrand cost, and what should a growing team check before adopting it?",
    primaryIntent: "pricing",
    secondaryIntents: ["adoption"],
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Which team is ExampleBrand designed for, and what adoption risks should it assess?",
    primaryIntent: "product_fit",
    secondaryIntents: ["risk_evaluation"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "How should a team use ExampleBrand for its documented workflow?",
    primaryIntent: "product_usage",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Which official and third-party sources support claims about ExampleBrand?",
    primaryIntent: "source_analysis",
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Recommend products for this use case and explain whether ExampleBrand belongs on the shortlist.",
    primaryIntent: "recommendation",
    secondaryIntents: ["brand_evaluation"],
    targetBrandRole: "candidate_to_evaluate",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: true,
  },
  {
    prompt: "Should I choose ExampleBrand or AtlasFlow for this purchase?",
    primaryIntent: "purchase_decision",
    secondaryIntents: ["comparison"],
    targetBrandRole: "comparison_party",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: true,
  },
  {
    prompt: "What security and platform-dependency risks should I evaluate before using ExampleBrand?",
    primaryIntent: "risk_evaluation",
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "What should a team prepare before adopting ExampleBrand?",
    primaryIntent: "adoption",
    secondaryIntents: ["product_fit"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "What do the cited pages establish about ExampleBrand's product?",
    primaryIntent: "source_analysis",
    secondaryIntents: ["product_understanding"],
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "What is ExampleBrand and what problem does it solve?",
    primaryIntent: "product_understanding",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Is ExampleBrand worth its stated price for a small team?",
    primaryIntent: "brand_evaluation",
    secondaryIntents: ["pricing"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Recommend alternatives to ExampleBrand and explain when ExampleBrand should still be considered.",
    primaryIntent: "recommendation",
    secondaryIntents: ["alternative", "brand_evaluation"],
    targetBrandRole: "candidate_to_evaluate",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: true,
  },
  {
    prompt: "Compare ExampleBrand with AtlasFlow and identify the main adoption risk of each.",
    primaryIntent: "comparison",
    secondaryIntents: ["risk_evaluation"],
    targetBrandRole: "comparison_party",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "How is ExampleBrand used, and which source confirms that workflow?",
    primaryIntent: "product_usage",
    secondaryIntents: ["source_analysis"],
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Which ExampleBrand plan fits this budget, and should the team buy it?",
    primaryIntent: "pricing",
    secondaryIntents: ["purchase_decision"],
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: true,
  },
  {
    prompt: "Is ExampleBrand a good fit for an enterprise migration, and what adoption work is required?",
    primaryIntent: "product_fit",
    secondaryIntents: ["adoption"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Review ExampleBrand.",
    primaryIntent: "unclear",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
];

function providerDefinition(): ProviderDefinition {
  return {
    id: "test-provider",
    label: "Test Provider",
    sourceType: "api",
    envKeys: ["TEST_PROVIDER_KEY"],
    defaultModels: ["test-model"],
    supportsNativeCitations: true,
    supportsWebSearch: false,
    resultCaveat: "Test provider result.",
  };
}

function analysisPayload(sample: IntentSample, index: number): unknown {
  return {
    promptIntent: {
      primaryIntent: sample.primaryIntent,
      secondaryIntents: sample.secondaryIntents || [],
      requestedOutputs: [`Requirement set ${index + 1}`],
      targetBrandRole: sample.targetBrandRole,
      requiresSources: sample.requiresSources,
      requiresComparison: sample.requiresComparison,
      requiresRecommendation: sample.requiresRecommendation,
      uncertainty: "low",
    },
    tasks: [
      {
        id: "task_1",
        requirement: `Check the main request for sample ${index + 1}`,
        expectedAnswerType: sample.requiresRecommendation ? "list_of_options" : "other",
      },
      {
        id: "task_2",
        requirement: `Check whether the answer gives evidence for sample ${index + 1}`,
        expectedAnswerType: sample.requiresSources ? "source_list" : "other",
      },
    ],
    answerAssessment: {
      taskResults: [
        {
          taskId: "task_1",
          status: "completed",
          evidenceQuote: SHARED_QUOTE,
          explanation: "The answer satisfies the main requested output.",
          sourceUrls: ["https://example.com/docs", "https://not-provider.example/source"],
        },
        {
          taskId: "task_2",
          status: sample.requiresSources ? "partial" : "completed",
          evidenceQuote: SHARED_QUOTE,
          explanation: "The answer includes assessable support.",
          sourceUrls: ["https://example.com/docs"],
        },
      ],
      overallAnswerQuality: sample.primaryIntent === "unclear" ? "uncertain" : "partial",
      missingRequirements: sample.primaryIntent === "unclear" ? ["The user request is too vague to fully assess."] : [],
    },
    entities: [
      {
        name: "AcmeList",
        entityType: "platform",
        identityStatus: "unresolved",
        entityRole: "product_or_brand",
        relationshipToQuestion: sample.requiresRecommendation ? "recommended_option" : "example",
        relationshipToTarget: sample.requiresComparison ? "compared_option" : "unclear",
        confidence: "medium",
        evidenceQuote: ENTITY_QUOTE,
        explanation: "The entity is classified from the answer context only.",
        sourceUrls: ["https://example.com/docs"],
      },
    ],
    adaptedResult: {
      displayMode: sample.primaryIntent === "unclear" ? "task_completion" : "brand_question",
      oneSentence: `The answer is assessed through the ${sample.primaryIntent} intent.`,
      userQuestion: sample.prompt,
      answered: ["The answer covers at least one requested output."],
      missing: sample.primaryIntent === "unclear" ? ["The target of the question is not clear."] : [],
      uncertain: sample.primaryIntent === "unclear" ? ["The intended decision cannot be determined."] : [],
      entityInsights: ["AcmeList is kept as a contextual entity, not automatically promoted to a competitor."],
    },
  };
}

class ScriptedProvider implements AnswerProvider {
  readonly definition = providerDefinition();
  readonly calls: CapturedAnalysisCall[] = [];
  private cursor = 0;

  constructor(private readonly samples: IntentSample[]) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const sample = this.samples[this.cursor];
    assert.ok(sample);
    const index = this.cursor;
    this.cursor += 1;
    this.calls.push({
      prompt: input.prompt,
      webSearchEnabled: input.webSearchEnabled,
      model: input.model,
    });
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text: `Intro text\n${JSON.stringify(analysisPayload(sample, index))}\nDone`,
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

function answerText(): string {
  return [
    "The answer evaluates the user's request.",
    SHARED_QUOTE,
    ENTITY_QUOTE,
  ].join(" ");
}

test("intent result pipeline supports twenty distinct question shapes through AI-returned JSON", async () => {
  const provider = new ScriptedProvider(SAMPLES);
  const pipeline = new IntentResultPipeline();

  for (let index = 0; index < SAMPLES.length; index += 1) {
    const sample = SAMPLES[index];
    assert.ok(sample);
    const result = await pipeline.analyze({
      userQuestion: sample.prompt,
      target: TARGET,
      answerText: answerText(),
      citations: CITATIONS,
      provider,
      model: "test-model",
      apiKey: "test-key",
      language: "en",
    });

    assert.equal(result.status, "completed");
    assert.equal(result.promptIntent.primaryIntent, sample.primaryIntent);
    assert.equal(result.promptIntent.targetBrandRole, sample.targetBrandRole);
    assert.equal(result.promptIntent.requiresSources, sample.requiresSources);
    assert.equal(result.promptIntent.requiresComparison, sample.requiresComparison);
    assert.equal(result.promptIntent.requiresRecommendation, sample.requiresRecommendation);
    assert.equal(result.tasks.length, 2);
    assert.equal(result.taskResults.every((item) => item.evidenceQuote === SHARED_QUOTE), true);
    assert.deepEqual(result.taskResults[0]?.sourceUrls, ["https://example.com/docs"]);
    assert.equal(result.entities[0]?.name, "AcmeList");
  }

  assert.equal(provider.calls.length, 20);
  assert.equal(provider.calls.every((call) => call.webSearchEnabled === false), true);
});

test("invalid task evidence is downgraded instead of accepted", () => {
  const result = validateIntentRunAnalysis(
    {
      promptIntent: {
        primaryIntent: "product_understanding",
        secondaryIntents: [],
        requestedOutputs: ["Explain what the product is"],
        targetBrandRole: "subject",
        requiresSources: false,
        requiresComparison: false,
        requiresRecommendation: false,
        uncertainty: "low",
      },
      tasks: [{ id: "task_1", requirement: "Explain the product", expectedAnswerType: "factual_summary" }],
      answerAssessment: {
        taskResults: [
          {
            taskId: "task_1",
            status: "completed",
            evidenceQuote: "This quote is not in the answer.",
            explanation: "The answer explains the product.",
            sourceUrls: ["https://example.com/docs"],
          },
        ],
        overallAnswerQuality: "complete",
        missingRequirements: [],
      },
      entities: [],
      adaptedResult: {
        displayMode: "brand_question",
        oneSentence: "The answer explains the product.",
        userQuestion: "What is ExampleBrand?",
        answered: ["It explains the product."],
        missing: [],
        uncertain: [],
        entityInsights: [],
      },
    },
    {
      userQuestion: "What is ExampleBrand?",
      answerText: "The provider answer is short.",
      citationUrls: ["https://example.com/docs"],
      analyzer: {
        providerId: "test-provider",
        model: "test-model",
        sourceLabel: "Source: Test Provider API",
      },
    },
  );

  assert.equal(result.taskResults[0]?.status, "unknown");
  assert.equal(result.taskResults[0]?.evidenceQuote, undefined);
});

test("validation language follows explicit configuration instead of inspecting question characters", () => {
  const payload = {
    promptIntent: {
      primaryIntent: "product_understanding",
      secondaryIntents: [],
      requestedOutputs: [],
      targetBrandRole: "unclear",
      requiresSources: false,
      requiresComparison: false,
      requiresRecommendation: false,
      uncertainty: "high",
    },
    tasks: [{ id: "task_1", requirement: "Check the answer", expectedAnswerType: "other" }],
    answerAssessment: {
      taskResults: [{ taskId: "task_1", status: "completed", evidenceQuote: "not present", explanation: "ignored", sourceUrls: [] }],
      overallAnswerQuality: "uncertain",
      missingRequirements: [],
    },
    entities: [],
    adaptedResult: { displayMode: "brand_question", oneSentence: "Review needed", userQuestion: "", answered: [], missing: [], uncertain: [], entityInsights: [] },
  };
  const english = validateIntentRunAnalysis(payload, {
    userQuestion: "请说明这个产品。",
    language: "en",
    answerText: "An answer.",
    citationUrls: [],
    analyzer: { providerId: "test", model: "test", sourceLabel: "Test" },
  });
  const chinese = validateIntentRunAnalysis(payload, {
    userQuestion: "Explain this product.",
    language: "zh-CN",
    answerText: "An answer.",
    citationUrls: [],
    analyzer: { providerId: "test", model: "test", sourceLabel: "Test" },
  });
  assert.equal(english.taskResults[0]?.explanation, "The provided evidence quote could not be verified in the original answer.");
  assert.equal(chinese.taskResults[0]?.explanation, "分析给出的证据片段无法在原始回答中核验。");
});

class JsonFormatFallbackProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    ...providerDefinition(),
    supportsAnyModel: true,
  };
  readonly responseFormats: Array<ProviderRunInput["responseFormat"]> = [];
  readonly schemaNames: Array<string | undefined> = [];

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.responseFormats.push(input.responseFormat);
    this.schemaNames.push(input.responseJsonSchema?.name);
    if (this.responseFormats.length === 1) throw new Error("Provider returned error");
    const sample = SAMPLES[0];
    assert.ok(sample);
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text: JSON.stringify(analysisPayload(sample, 0)),
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

test("intent analyzer keeps the strict response schema during one structured repair", async () => {
  const provider = new JsonFormatFallbackProvider();
  const pipeline = new IntentResultPipeline();
  const result = await pipeline.analyze({
    userQuestion: SAMPLES[0]?.prompt || "",
    target: TARGET,
    answerText: answerText(),
    citations: CITATIONS,
    provider,
    model: "routed-model",
    apiKey: "test-key",
    language: "en",
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(provider.responseFormats, [undefined, undefined]);
  assert.deepEqual(provider.schemaNames, ["intent_run_analysis", "intent_run_analysis"]);
});

test("entity co-occurrence is not upgraded into competition by local code", () => {
  const result = validateIntentRunAnalysis(
    {
      promptIntent: {
        primaryIntent: "product_understanding",
        secondaryIntents: [],
        requestedOutputs: ["Explain the product"],
        targetBrandRole: "subject",
        requiresSources: false,
        requiresComparison: false,
        requiresRecommendation: false,
        uncertainty: "low",
      },
      tasks: [{ id: "task_1", requirement: "Explain the product", expectedAnswerType: "factual_summary" }],
      answerAssessment: {
        taskResults: [
          {
            taskId: "task_1",
            status: "completed",
            evidenceQuote: SHARED_QUOTE,
            explanation: "The answer explains the product.",
            sourceUrls: [],
          },
        ],
        overallAnswerQuality: "complete",
        missingRequirements: [],
      },
      entities: [
        {
          name: "NearbyName",
          entityType: "product",
          identityStatus: "unresolved",
          entityRole: "example",
          relationshipToQuestion: "example",
          relationshipToTarget: "unrelated",
          confidence: "medium",
          evidenceQuote: SHARED_QUOTE,
          explanation: "The answer names it as an example, not as a competitor.",
          sourceUrls: [],
        },
      ],
      adaptedResult: {
        displayMode: "brand_question",
        oneSentence: "The answer explains the product.",
        userQuestion: "What is ExampleBrand?",
        answered: ["It explains the product."],
        missing: [],
        uncertain: [],
        entityInsights: ["NearbyName is just an example."],
      },
    },
    {
      userQuestion: "What is ExampleBrand?",
      answerText: SHARED_QUOTE,
      citationUrls: [],
      analyzer: {
        providerId: "test-provider",
        model: "test-model",
        sourceLabel: "Source: Test Provider API",
      },
    },
  );

  assert.equal(result.entities[0]?.relationshipToTarget, "unrelated");
});

function intentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...intentFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

test("intent implementation contains no local pattern classifier or target-specific branch", () => {
  const forbidden = ["new RegExp", ".match(", ".matchAll(", ".replace(", ".replaceAll(", ".search(", "NiubiStar", "Product Hunt"];
  for (const file of intentFiles("src/intent")) {
    const source = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      assert.equal(source.includes(marker), false, `${file} contains forbidden marker ${marker}`);
    }
  }
});
