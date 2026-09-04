import type { AnswerProvider, Entity, MonitoringPrompt, PromptGenerationEvidence, PromptType } from "../core/types.js";
import { FileStore } from "../store/file-store.js";
import { withAuditCategory } from "./audit-category.js";

interface GeneratedPromptRow {
  type: PromptType;
  topic: string;
  prompt: string;
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1]);
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("Prompt generator did not return a JSON array.");
}

function parseGeneratedPrompts(text: string, target: Entity, language: string, limit: number): MonitoringPrompt[] {
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Prompt generator output is not an array.");
  const prompts: MonitoringPrompt[] = [];
  const seen = new Set<string>();

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<GeneratedPromptRow>;
    if (typeof row.prompt !== "string" || !row.prompt.trim()) continue;
    const type = row.type || "category";
    if (!["brand", "category", "recommendation", "comparison", "alternative", "scenario"].includes(type)) continue;
    const normalized = row.prompt.trim();
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push(
      withAuditCategory({
        id: `${type}-${target.id}-${prompts.length + 1}`,
        type,
        topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : type,
        language,
        text: normalized,
        enabled: true,
        targetIncluded: promptContainsTarget(normalized, target),
      }),
    );
    if (prompts.length >= limit) break;
  }

  if (prompts.length === 0) {
    throw new Error("Prompt generator returned no usable prompts.");
  }
  return prompts;
}

export function promptsFromManual(input: { target: Entity; language: string; prompts: string[] }): MonitoringPrompt[] {
  const seen = new Set<string>();
  return input.prompts
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .filter((prompt) => {
      const key = prompt.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((prompt, index) =>
      withAuditCategory({
        id: `manual-${input.target.id}-${index + 1}`,
        type: inferPromptType(prompt),
        topic: "manual",
        language: input.language,
        text: prompt,
        enabled: true,
        targetIncluded: promptContainsTarget(prompt, input.target),
      }),
    );
}

export function promptContainsTarget(prompt: string, target: Entity): boolean {
  const lower = prompt.toLowerCase();
  return [target.name, target.domain, ...target.aliases].some((term) => {
    const normalized = term.trim().toLowerCase();
    return normalized.length > 0 && lower.includes(normalized);
  });
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function inferPromptType(prompt: string): PromptType {
  const lower = prompt.toLowerCase();
  if (hasAny(lower, ["alternative", "alternatives", "替代", "替代品", "替代方案", "类似产品", "类似工具"])) return "alternative";
  if (
    hasAny(lower, [
      " vs ",
      " versus ",
      "compare",
      "comparison",
      "difference",
      "differences",
      "对比",
      "比较",
      "区别",
      "差异",
      "相比",
      "竞品对比",
    ])
  ) {
    return "comparison";
  }
  if (
    hasAny(lower, [
      "recommend",
      "recommendation",
      "best",
      "top",
      "推荐",
      "最好",
      "最佳",
      "值得考虑",
      "值得关注",
      "应该选择",
      "哪款",
      "哪家",
    ])
  ) {
    return "recommendation";
  }
  if (hasAny(lower, ["what is", "what does", "是什么", "是做什么", "提供什么", "解决什么问题", "适合哪些用户"])) {
    return "brand";
  }
  if (hasAny(lower, ["how ", "how can", "how should", "如何", "怎么", "怎样", "该怎么", "应该如何"])) return "scenario";
  return "category";
}

export class PromptGenerator {
  buildGenerationPrompt(input: { target: Entity; competitors: Entity[]; language: string; count: number }): string {
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
      "",
      "Return only a valid JSON array. Each item must have:",
      "- type: one of brand, category, recommendation, comparison, alternative, scenario",
      "- topic: short topic label",
      "- prompt: the exact user question to send to AI providers",
      "",
      "The prompts must test whether an AI assistant naturally mentions, recommends, cites, or compares the target. Include brand, category, recommendation, comparison, alternative, and scenario coverage when possible. Do not include explanations outside JSON.",
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
  }): Promise<{ prompts: MonitoringPrompt[]; evidence: PromptGenerationEvidence }> {
    const prompt = this.buildGenerationPrompt(input);
    const result = await input.provider.run({
      prompt,
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 1200,
      temperature: 0.1,
      webSearchEnabled: false,
    });
    const prompts = parseGeneratedPrompts(result.text, input.target, input.language, input.count);
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
}
