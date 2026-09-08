import {
  BRAND_QUESTION_INTENTS,
  PROMPT_INTENT_SCHEMA_VERSION,
  type AnswerProvider,
  type BrandQuestionIntent,
  type DomainProfile,
  type Entity,
  type MonitoringPrompt,
  type PromptIntentProfile,
} from "../core/types.js";
import { runProviderWithRetry } from "../providers/provider-retry.js";
import { jsonContainer } from "../utils/text.js";

interface ProviderIntentRow {
  questionId: string;
  intents: BrandQuestionIntent[];
  candidateApplicable: boolean;
  recommendationApplicable: boolean;
  reason: string;
}

function responseSchema(questionCount: number): Record<string, unknown> {
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
          required: ["questionId", "intents", "candidateApplicable", "recommendationApplicable", "reason"],
          properties: {
            questionId: { type: "string" },
            intents: {
              type: "array",
              minItems: 1,
              uniqueItems: true,
              items: { type: "string", enum: [...BRAND_QUESTION_INTENTS] },
            },
            candidateApplicable: { type: "boolean" },
            recommendationApplicable: { type: "boolean" },
            reason: { type: "string" },
          },
        },
      },
    },
  };
}

function classificationPrompt(input: {
  target: Entity;
  domainProfile?: DomainProfile | undefined;
  language: string;
  prompts: MonitoringPrompt[];
}): string {
  return [
    "Classify the stable intent and metric applicability of each AI visibility monitoring question.",
    "Judge only the question. Do not use or anticipate any future AI answer.",
    "Return one valid JSON object and preserve every questionId exactly.",
    "A question can have multiple intents. Use only the supplied intent enum.",
    "candidateApplicable is true when the question asks for options, comparison, alternatives, evaluation, fit, pricing, risk, or adoption where the target can enter or miss a considered set.",
    "recommendationApplicable is true only when the question asks whether to recommend, consider, choose, adopt, or regard the target as suitable.",
    "A factual, source-only, price-only, risk-only, or comparison-only question is not recommendationApplicable unless it also requests a choice or recommendation.",
    "Do not infer intent from brand, industry, language, or identifier-specific shortcuts.",
    `Allowed intents: ${BRAND_QUESTION_INTENTS.join(", ")}`,
    `Target context: ${JSON.stringify({
      name: input.target.name,
      domain: input.target.domain,
      aliases: input.target.aliases,
      category: input.domainProfile?.category || null,
      description: input.domainProfile?.description || null,
    })}`,
    `Language context: ${input.language}`,
    `Questions: ${JSON.stringify(input.prompts.map((prompt) => ({ questionId: prompt.id, text: prompt.text })))}`,
    "Required fields per question: questionId, intents, candidateApplicable, recommendationApplicable, reason.",
  ].join("\n");
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function parseRows(text: string, prompts: MonitoringPrompt[]): ProviderIntentRow[] {
  const root = objectValue(JSON.parse(jsonContainer(text, "{", "}")));
  const questions = Array.isArray(root?.questions) ? root.questions : [];
  if (questions.length !== prompts.length) throw new Error("Prompt intent classifier did not cover every question.");
  const allowed = new Set<string>(BRAND_QUESTION_INTENTS);
  const byId = new Map<string, ProviderIntentRow>();
  for (const value of questions) {
    const row = objectValue(value);
    const questionId = typeof row?.questionId === "string" ? row.questionId : "";
    const rawIntents = Array.isArray(row?.intents) ? row.intents : [];
    const intents = [...new Set(rawIntents.filter((intent): intent is BrandQuestionIntent => typeof intent === "string" && allowed.has(intent)))];
    if (!questionId || intents.length === 0) throw new Error("Prompt intent classifier returned an incomplete question result.");
    if (typeof row?.candidateApplicable !== "boolean" || typeof row.recommendationApplicable !== "boolean") {
      throw new Error("Prompt intent classifier omitted metric applicability.");
    }
    if (byId.has(questionId)) throw new Error("Prompt intent classifier returned a duplicate question id.");
    byId.set(questionId, {
      questionId,
      intents,
      candidateApplicable: row.candidateApplicable,
      recommendationApplicable: row.recommendationApplicable,
      reason: typeof row.reason === "string" ? row.reason.trim() : "",
    });
  }
  return prompts.map((prompt) => {
    const row = byId.get(prompt.id);
    if (!row) throw new Error(`Prompt intent classifier omitted question ${prompt.id}.`);
    return row;
  });
}

export class MonitoringPromptIntentClassifier {
  async classify(input: {
    target: Entity;
    domainProfile?: DomainProfile | undefined;
    language: string;
    prompts: MonitoringPrompt[];
    provider: AnswerProvider;
    model: string;
    apiKey: string;
  }): Promise<MonitoringPrompt[]> {
    if (input.prompts.length === 0) return [];
    const prompt = classificationPrompt(input);
    const run = async (structured: boolean) => runProviderWithRetry(input.provider, {
      prompt,
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 2400,
      temperature: 0,
      webSearchEnabled: false,
      responseFormat: structured && !input.provider.definition.supportsJsonSchema ? "json_object" : undefined,
      responseJsonSchema: structured && input.provider.definition.supportsJsonSchema
        ? { name: "monitoring_prompt_intents", schema: responseSchema(input.prompts.length) }
        : undefined,
    });
    let result;
    try {
      result = await run(true);
    } catch {
      result = await run(false);
    }
    const rows = parseRows(result.text, input.prompts);
    return input.prompts.map((monitoringPrompt, index) => {
      const row = rows[index];
      if (!row) throw new Error(`Prompt intent classifier omitted question ${monitoringPrompt.id}.`);
      const intentProfile: PromptIntentProfile = {
        schemaVersion: PROMPT_INTENT_SCHEMA_VERSION,
        intents: row.intents,
        candidateApplicable: row.candidateApplicable,
        recommendationApplicable: row.recommendationApplicable,
        reason: row.reason,
        analyzer: {
          providerId: input.provider.definition.id,
          model: input.model,
          sourceLabel: result.sourceLabel,
        },
        status: "completed",
      };
      return { ...monitoringPrompt, intentProfile };
    });
  }
}
