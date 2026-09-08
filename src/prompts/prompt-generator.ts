import type {
  AnswerProvider,
  DomainProfile,
  Entity,
  KeywordCandidate,
  KeywordIntent,
  MonitoringPrompt,
  PromptGenerationEvidence,
  PromptAuditCategory,
  PromptType,
} from "../core/types.js";
import { FileStore } from "../store/file-store.js";
import { runProviderWithRetry } from "../providers/provider-retry.js";
import { withAuditCategory } from "./audit-category.js";
import { compactWhitespace, jsonContainer } from "../utils/text.js";
import { BrandQuestionClassifier } from "./brand-question-classifier.js";

interface GeneratedPromptRow {
  sourceId?: string;
  type: PromptType;
  topic: string;
  prompt: string;
  targetIncluded?: boolean;
  auditCategory?: PromptAuditCategory;
  keywordIds?: string[];
  keywordIntent?: KeywordIntent;
}

const PROMPT_TYPES: PromptType[] = [
  "brand",
  "category",
  "recommendation",
  "comparison",
  "alternative",
  "scenario",
  "keyword_category",
  "keyword_recommendation",
  "keyword_comparison",
  "keyword_alternative",
  "keyword_scenario",
  "keyword_source",
];

const KEYWORD_INTENTS: KeywordIntent[] = ["category", "recommendation", "comparison", "alternative", "scenario", "source"];
const AUDIT_CATEGORIES: PromptAuditCategory[] = ["brand_awareness", "organic_discovery", "comparison", "other"];

function extractJsonArray(text: string): unknown {
  return JSON.parse(jsonContainer(text, "[", "]"));
}

function promptType(value: unknown): PromptType | null {
  return typeof value === "string" && PROMPT_TYPES.includes(value as PromptType) ? (value as PromptType) : null;
}

function keywordIntent(value: unknown): KeywordIntent | undefined {
  return typeof value === "string" && KEYWORD_INTENTS.includes(value as KeywordIntent) ? (value as KeywordIntent) : undefined;
}

function auditCategory(value: unknown): PromptAuditCategory | null {
  return typeof value === "string" && AUDIT_CATEGORIES.includes(value as PromptAuditCategory) ? (value as PromptAuditCategory) : null;
}

function knownKeywordIds(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((id) => allowed.has(id)))];
}

export function parseGeneratedPrompts(
  text: string,
  target: Entity,
  language: string,
  limit: number,
  keywords: KeywordCandidate[] = [],
): MonitoringPrompt[] {
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Prompt generator output is not an array.");
  const prompts: MonitoringPrompt[] = [];
  const seen = new Set<string>();
  const allowedKeywordIds = new Set(keywords.map((keyword) => keyword.id));

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<GeneratedPromptRow>;
    if (typeof row.prompt !== "string" || !row.prompt.trim()) continue;
    const type = promptType(row.type);
    const category = auditCategory(row.auditCategory);
    if (!type || !category || typeof row.targetIncluded !== "boolean") continue;
    const normalized = compactWhitespace(row.prompt);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const keywordIds = knownKeywordIds(row.keywordIds, allowedKeywordIds);
    const prompt = withAuditCategory({
        id: `${type}-${target.id}-${prompts.length + 1}`,
        type,
        topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : type,
        language,
        text: normalized,
        enabled: true,
        auditCategory: category,
        targetIncluded: row.targetIncluded,
        keywordIds,
        keywordClusterId: keywordIds.length === 1 ? `cluster-${keywordIds[0]}` : undefined,
        keywordIntent: keywordIntent(row.keywordIntent),
        seedSource: keywordIds.length > 0 ? "provider_generated" : undefined,
      });
    prompts.push(prompt);
    if (prompts.length >= limit) break;
  }

  if (prompts.length === 0) {
    throw new Error("Prompt generator returned no usable prompts.");
  }
  return prompts;
}

export class PromptGenerator {
  private readonly brandQuestionClassifier = new BrandQuestionClassifier();

  buildGenerationPrompt(input: {
    target: Entity;
    competitors: Entity[];
    language: string;
    count: number;
    keywords?: KeywordCandidate[] | undefined;
  }): string {
    const competitors = input.competitors.length
      ? input.competitors.map((item) => `${item.name} (${item.domain})`).join(", ")
      : "unknown competitors";
    return [
      `Generate ${input.count} monitoring prompts for an AI visibility audit.`,
      "",
      `Target brand: ${input.target.name}`,
      `Target domain: ${input.target.domain}`,
      `Known aliases: ${input.target.aliases.length ? input.target.aliases.join(", ") : "none"}`,
      `GitHub repository: ${input.target.githubRepo || "none"}`,
      `Known competitors: ${competitors}`,
      `Language: ${input.language}`,
      `Keyword context: ${JSON.stringify((input.keywords || []).map((keyword) => ({ id: keyword.id, phrase: keyword.phrase })))}`,
      "",
      "Return only a valid JSON array. Each item must have:",
      "- type: one of brand, category, recommendation, comparison, alternative, scenario",
      "- topic: short topic label",
      "- prompt: the exact user question to send to AI providers",
      "- targetIncluded: whether the question itself identifies the target",
      "- auditCategory: brand_awareness, organic_discovery, comparison, or other",
      "- keywordIds: IDs from Keyword context that the question tests",
      "- keywordIntent: category, recommendation, comparison, alternative, scenario, or source when keywordIds is not empty",
      "",
      "Create a balanced set that tests direct brand understanding and natural user needs without naming the target. Derive every question from the supplied target, competitors, and keyword context. Do not use a canned industry template. Do not include explanations outside JSON.",
    ].join("\n");
  }

  async generate(input: {
    auditId: string;
    target: Entity;
    competitors: Entity[];
    language: string;
    count: number;
    provider: AnswerProvider;
    model: string;
    apiKey: string;
    store: FileStore;
    keywords?: KeywordCandidate[] | undefined;
  }): Promise<{ prompts: MonitoringPrompt[]; evidence: PromptGenerationEvidence }> {
    const prompt = this.buildGenerationPrompt(input);
    const result = await runProviderWithRetry(input.provider, {
      prompt,
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 1200,
      temperature: 0.1,
      webSearchEnabled: false,
    });
    const prompts = parseGeneratedPrompts(result.text, input.target, input.language, input.count, input.keywords || []);
    return {
      prompts,
      evidence: {
        providerId: input.provider.definition.id,
        model: input.model,
        sourceLabel: result.sourceLabel,
        prompt,
        text: result.text,
      },
    };
  }

  async classifyManual(input: {
    target: Entity;
    domainProfile?: DomainProfile | undefined;
    language: string;
    prompts: string[];
    provider: AnswerProvider;
    model: string;
    apiKey: string;
  }): Promise<MonitoringPrompt[]> {
    const questions = input.prompts.map((text, index) => ({ sourceId: `manual-${index + 1}`, text: compactWhitespace(text) })).filter((row) => row.text);
    if (questions.length === 0) return [];
    const classifications = await this.brandQuestionClassifier.classify({
      target: input.target,
      domainProfile: input.domainProfile,
      language: input.language,
      questions: questions.map((question) => question.text),
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
    });
    return questions.map((question, index) => {
      const brandQuestion = classifications[index];
      if (!brandQuestion) throw new Error(`Brand question classifier did not return question ${index + 1}.`);
      return withAuditCategory({
        id: `manual-${input.target.id}-${index + 1}`,
        type: "brand",
        topic: "brand-question",
        language: input.language,
        text: question.text,
        enabled: true,
        auditCategory: "brand_awareness",
        targetIncluded: true,
        brandQuestion,
      });
    });
  }
}
