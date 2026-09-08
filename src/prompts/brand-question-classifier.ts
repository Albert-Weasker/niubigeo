import {
  BRAND_QUESTION_INTENTS,
  type AnswerProvider,
  type BrandQuestionClassification,
  type BrandQuestionIntent,
  type DomainProfile,
  type Entity,
} from "../core/types.js";
import { runProviderWithRetry } from "../providers/provider-retry.js";
import { jsonContainer } from "../utils/text.js";
import {
  assertQuestionsContainTargetIdentity,
  BrandQuestionScopeError,
  parseBrandQuestionClassifications,
} from "./brand-question.js";

interface IntentDefinition {
  intent: BrandQuestionIntent;
  definition: string;
  boundary: string;
}

const INTENT_DEFINITIONS: IntentDefinition[] = [
  { intent: "product_understanding", definition: "what the target product or service is, does, or how it works", boundary: "describes the product; it does not by itself ask for a judgment, audience fit, or choice" },
  { intent: "brand_evaluation", definition: "an evaluative verdict on whether the target is suitable, worthwhile, appropriate, or worth considering for a stated need", boundary: "asks whether the target is a good fit or deserves consideration; merely describing who it serves is product_fit, while asking what to choose or adopt is also purchase_decision" },
  { intent: "recommendation", definition: "one or more recommended choices involving the target", boundary: "requires the answer to propose options; merely evaluating one named target is not automatically a recommendation request" },
  { intent: "comparison", definition: "differences or tradeoffs between the target and one or more alternatives", boundary: "requires comparative dimensions or tradeoffs; naming another entity without requesting a comparison is insufficient" },
  { intent: "alternative", definition: "whether the target substitutes for another product or which products can replace it", boundary: "requires a replacement relationship; a comparison alone does not establish substitutability" },
  { intent: "pricing", definition: "price, plans, billing, quotas, or cost limits", boundary: "covers monetary and plan facts; operational limits belong to adoption unless they affect price or plan entitlement" },
  { intent: "product_fit", definition: "which users, teams, needs, or use cases the target fits, and under which conditions", boundary: "maps the target to an audience or use case; it may coexist with brand_evaluation when the question also asks for a suitability verdict, but it does not by itself ask the user to choose" },
  { intent: "product_usage", definition: "how the target is used or what information should be checked while using it", boundary: "asks about use, workflow, or inspection; it is distinct from deciding whether to adopt the target" },
  { intent: "purchase_decision", definition: "whether or which option to choose, buy, migrate to, or adopt, including criteria needed to make that decision", boundary: "requires a selection or adoption decision; describing suitable users is product_fit and judging worth without asking for a choice is brand_evaluation" },
  { intent: "risk_evaluation", definition: "security, compliance, dependency, migration, limitation, or other downside risks", boundary: "requires identifying or weighing downside exposure; neutral product constraints are not risks unless the question asks how they affect the decision" },
  { intent: "adoption", definition: "operational prerequisites, usage limits, migration effects, or implementation implications before or during adoption", boundary: "covers implementation consequences; deciding whether to choose is purchase_decision and evaluating downside exposure is risk_evaluation" },
  { intent: "source_analysis", definition: "which sources support claims about the target", boundary: "requires source provenance or evidence; a normal factual question does not imply source analysis" },
];

const INTENT_ADJUDICATIONS: BrandQuestionIntent[][] = BRAND_QUESTION_INTENTS.map((intent) => [intent]);

function definitionLines(intents: BrandQuestionIntent[]): string[] {
  return INTENT_DEFINITIONS
    .filter((item) => intents.includes(item.intent))
    .map((item) => `- ${item.intent}: ${item.definition}. Boundary: ${item.boundary}.`);
}

function decisionSchema(intents: BrandQuestionIntent[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [...intents],
    properties: Object.fromEntries(intents.map((intent) => [intent, { type: "boolean" }])),
  };
}

function primaryResponseSchema(questionCount: number): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: questionCount,
        maxItems: questionCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["domainMatched", "targetBrand", "intents", "intentDecisions"],
          properties: {
            domainMatched: { type: "boolean" },
            targetBrand: { type: "string" },
            intents: {
              type: "array",
              minItems: 1,
              uniqueItems: true,
              items: { type: "string", enum: [...BRAND_QUESTION_INTENTS] },
            },
            intentDecisions: decisionSchema([...BRAND_QUESTION_INTENTS]),
            reason: { type: "string" },
          },
        },
      },
    },
  };
}

function adjudicationResponseSchema(questionCount: number, intents: BrandQuestionIntent[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: questionCount,
        maxItems: questionCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["intentDecisions"],
          properties: {
            intentDecisions: decisionSchema(intents),
          },
        },
      },
    },
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseJson(text: string): unknown {
  return JSON.parse(jsonContainer(text, "{", "}")) as unknown;
}

function questionRows(value: unknown, questionCount: number): Record<string, unknown>[] {
  const root = asObject(value);
  const questions = Array.isArray(root?.questions) ? root.questions : [];
  if (questions.length !== questionCount) throw new Error("Intent adjudicator did not cover every question.");
  return questions.map((question) => asObject(question) || {});
}

function parseAdjudication(value: unknown, questionCount: number, intents: BrandQuestionIntent[]): Map<BrandQuestionIntent, boolean>[] {
  return questionRows(value, questionCount).map((question) => {
    const decisions = asObject(question.intentDecisions);
    const output = new Map<BrandQuestionIntent, boolean>();
    for (const intent of intents) {
      const decision = decisions?.[intent];
      if (typeof decision !== "boolean") throw new Error(`Intent adjudicator omitted ${intent}.`);
      output.set(intent, decision);
    }
    return output;
  });
}

function productContext(target: Entity, domainProfile?: DomainProfile): string {
  return JSON.stringify({
    name: target.name,
    domain: target.domain,
    aliases: target.aliases,
    category: domainProfile?.category || null,
    description: domainProfile?.description || null,
  });
}

function primaryPrompt(input: {
  target: Entity;
  domainProfile?: DomainProfile | undefined;
  language: string;
  questions: string[];
}): string {
  const exampleDecisions = Object.fromEntries(BRAND_QUESTION_INTENTS.map((intent) => [intent, intent === "product_understanding"]));
  return [
    "Classify whether each question is directly about the target brand's product or service.",
    "Return only one valid JSON object and preserve input order.",
    "The questions already passed an exact target-identity presence check.",
    "Set domainMatched=true only when a question is semantically about the target product, service, adoption, sources, or a decision involving it.",
    "A shared word or name without a clear product relationship is not enough.",
    "Evaluate every intent independently. Overlap is expected. Do not use keyword matching and do not stop after one label.",
    "intentDecisions must contain one true or false value for every intent. intents must contain every true decision.",
    "Intent definitions:",
    ...definitionLines([...BRAND_QUESTION_INTENTS]),
    `Target and product context: ${productContext(input.target, input.domainProfile)}`,
    `Language context: ${input.language}`,
    `Questions: ${JSON.stringify(input.questions)}`,
    `Required shape: ${JSON.stringify({ questions: [{ domainMatched: true, targetBrand: "Brand", intents: ["product_understanding"], intentDecisions: exampleDecisions, reason: "semantic reason" }] })}`,
  ].join("\n");
}

function adjudicationPrompt(input: {
  target: Entity;
  domainProfile?: DomainProfile | undefined;
  language: string;
  questions: string[];
  intents: BrandQuestionIntent[];
}): string {
  return [
    "Independently adjudicate one possible intent for each target-brand question.",
    "Return only one valid JSON object and preserve input order.",
    "Decide true when the complete question explicitly requests the outcome described by the intent definition and false otherwise.",
    "Judge only this intent dimension. Do not choose a best label and do not suppress it because a related intent may also apply.",
    "Do not use keyword matching and do not assume another classifier has selected any label.",
    "Intent definitions:",
    ...definitionLines(input.intents),
    `Target and product context: ${productContext(input.target, input.domainProfile)}`,
    `Language context: ${input.language}`,
    `Questions: ${JSON.stringify(input.questions)}`,
    `Required shape: ${JSON.stringify({ questions: [{ intentDecisions: Object.fromEntries(input.intents.map((intent) => [intent, false])) }] })}`,
  ].join("\n");
}

async function runStructured(input: {
  provider: AnswerProvider;
  model: string;
  apiKey: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  structured: boolean;
}): Promise<unknown> {
  const result = await runProviderWithRetry(input.provider, {
    prompt: input.prompt,
    model: input.model,
    apiKey: input.apiKey,
    maxTokens: 1600,
    temperature: 0,
    webSearchEnabled: false,
    responseFormat: input.structured && !input.provider.definition.supportsJsonSchema ? "json_object" : undefined,
    responseJsonSchema: input.structured && input.provider.definition.supportsJsonSchema
      ? { name: input.schemaName, schema: input.schema }
      : undefined,
  });
  return parseJson(result.text);
}

function mergeAdjudication(
  classifications: BrandQuestionClassification[],
  adjudications: Array<Map<BrandQuestionIntent, boolean>[]>,
): BrandQuestionClassification[] {
  return classifications.map((classification, questionIndex) => {
    const decisions = new Map((classification.intentChecks || []).map((check) => [check.intent, check.requested]));
    for (const adjudication of adjudications) {
      const questionDecisions = adjudication[questionIndex];
      if (!questionDecisions) continue;
      for (const [intent, requested] of questionDecisions) {
        decisions.set(intent, Boolean(decisions.get(intent)) || requested);
      }
    }
    const intents = BRAND_QUESTION_INTENTS.filter((intent) => decisions.get(intent) === true);
    return {
      ...classification,
      intents,
      intentChecks: BRAND_QUESTION_INTENTS.map((intent) => ({ intent, requested: decisions.get(intent) === true })),
    };
  });
}

export class BrandQuestionClassifier {
  async classify(input: {
    target: Entity;
    domainProfile?: DomainProfile | undefined;
    language: string;
    questions: string[];
    provider: AnswerProvider;
    model: string;
    apiKey: string;
  }): Promise<BrandQuestionClassification[]> {
    assertQuestionsContainTargetIdentity(input.questions, input.target, input.language);
    const structured = Boolean(input.provider.definition.supportsAnyModel);
    let parsed: unknown;
    try {
      parsed = await runStructured({
        ...input,
        prompt: primaryPrompt(input),
        schemaName: "brand_question_classification",
        schema: primaryResponseSchema(input.questions.length),
        structured,
      });
    } catch (error) {
      if (!structured || error instanceof BrandQuestionScopeError) throw error;
      parsed = await runStructured({
        ...input,
        prompt: primaryPrompt(input),
        schemaName: "brand_question_classification",
        schema: primaryResponseSchema(input.questions.length),
        structured: false,
      });
    }
    const classifications = parseBrandQuestionClassifications({
      value: parsed,
      questionCount: input.questions.length,
      target: input.target,
      language: input.language,
    });
    if (!input.provider.definition.supportsJsonSchema) return classifications;

    const settled = await Promise.all(INTENT_ADJUDICATIONS.map(async (intents) => {
      const intent = intents[0];
      if (!intent) return null;
      try {
        const value = await runStructured({
          ...input,
          prompt: adjudicationPrompt({ ...input, intents }),
          schemaName: `brand_intent_${intent}`,
          schema: adjudicationResponseSchema(input.questions.length, intents),
          structured: true,
        });
        return parseAdjudication(value, input.questions.length, intents);
      } catch {
        return null;
      }
    }));
    const adjudications = settled.filter((result): result is Map<BrandQuestionIntent, boolean>[] => result !== null);
    return mergeAdjudication(classifications, adjudications);
  }
}
