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
    prompt: "Recommend tools for launching a developer product and say whether ExampleBrand should be considered.",
    primaryIntent: "recommendation",
    secondaryIntents: ["brand_evaluation"],
    targetBrandRole: "candidate_to_evaluate",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: true,
  },
  {
    prompt: "Compare ExampleBrand and AtlasFlow for small teams.",
    primaryIntent: "comparison",
    targetBrandRole: "comparison_party",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "What are practical alternatives to ExampleBrand?",
    primaryIntent: "alternative",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "Is ExampleBrand worth using for a small open-source team?",
    primaryIntent: "brand_evaluation",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "What is ExampleBrand and what does it do?",
    primaryIntent: "fact",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "How much does ExampleBrand cost and what limits should I know?",
    primaryIntent: "pricing",
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Show me how to set up ExampleBrand from scratch.",
    primaryIntent: "tutorial",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "ExampleBrand import failed; why did it fail and how do I fix it?",
    primaryIntent: "troubleshooting",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Where can I download ExampleBrand and read the official docs?",
    primaryIntent: "source_finding",
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Which products are active in the AI audit tooling market?",
    primaryIntent: "industry_research",
    targetBrandRole: "not_mentioned",
    requiresSources: true,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "Is ExampleBrand safe and reliable enough for customer data?",
    primaryIntent: "risk_assessment",
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Think through the future of tools that verify AI-generated work.",
    primaryIntent: "open_exploration",
    targetBrandRole: "not_mentioned",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Recommend options, compare them with ExampleBrand, and call out risks.",
    primaryIntent: "mixed",
    secondaryIntents: ["recommendation", "comparison", "risk_assessment"],
    targetBrandRole: "comparison_party",
    requiresSources: false,
    requiresComparison: true,
    requiresRecommendation: true,
  },
  {
    prompt: "Tell me if this is okay.",
    primaryIntent: "unclear",
    targetBrandRole: "unclear",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Draft a short launch note for ExampleBrand.",
    primaryIntent: "other",
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Suggest sourced products for monitoring AI answers in Spanish.",
    primaryIntent: "recommendation",
    secondaryIntents: ["source_finding"],
    targetBrandRole: "not_mentioned",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: true,
  },
  {
    prompt: "Compare pricing for ExampleBrand and two alternatives.",
    primaryIntent: "pricing",
    secondaryIntents: ["comparison", "alternative"],
    targetBrandRole: "comparison_party",
    requiresSources: true,
    requiresComparison: true,
    requiresRecommendation: false,
  },
  {
    prompt: "Give setup steps for ExampleBrand and mention any deployment risks.",
    primaryIntent: "tutorial",
    secondaryIntents: ["risk_assessment"],
    targetBrandRole: "subject",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "Find the cause of a broken ExampleBrand webhook and link to relevant docs.",
    primaryIntent: "troubleshooting",
    secondaryIntents: ["source_finding"],
    targetBrandRole: "subject",
    requiresSources: true,
    requiresComparison: false,
    requiresRecommendation: false,
  },
  {
    prompt: "List alternatives and decide if ExampleBrand is still worth considering.",
    primaryIntent: "alternative",
    secondaryIntents: ["brand_evaluation"],
    targetBrandRole: "candidate_to_evaluate",
    requiresSources: false,
    requiresComparison: true,
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
        relationshipToQuestion: sample.requiresRecommendation ? "recommended_option" : "example",
        relationshipToTarget: sample.requiresComparison ? "compared_option" : "unclear",
        confidence: "medium",
        evidenceQuote: ENTITY_QUOTE,
        explanation: "The entity is classified from the answer context only.",
        sourceUrls: ["https://example.com/docs"],
      },
    ],
    adaptedResult: {
      displayMode: sample.primaryIntent === "mixed" || sample.primaryIntent === "unclear" || sample.primaryIntent === "other" ? "task_completion" : sample.primaryIntent,
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
      rawJson: {},
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
        primaryIntent: "fact",
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
        displayMode: "fact",
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

class JsonFormatFallbackProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    ...providerDefinition(),
    supportsAnyModel: true,
  };
  readonly responseFormats: Array<ProviderRunInput["responseFormat"]> = [];

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.responseFormats.push(input.responseFormat);
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
      rawJson: {},
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

test("intent analyzer retries without JSON response format when a routed model rejects it", async () => {
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
  assert.deepEqual(provider.responseFormats, ["json_object", undefined]);
});

test("entity co-occurrence is not upgraded into competition by local code", () => {
  const result = validateIntentRunAnalysis(
    {
      promptIntent: {
        primaryIntent: "fact",
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
          relationshipToQuestion: "example",
          relationshipToTarget: "unrelated",
          confidence: "medium",
          evidenceQuote: SHARED_QUOTE,
          explanation: "The answer names it as an example, not as a competitor.",
          sourceUrls: [],
        },
      ],
      adaptedResult: {
        displayMode: "fact",
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
