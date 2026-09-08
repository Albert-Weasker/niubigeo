import { sha256 } from "../../utils/hash.js";
import type { AnswerEvidenceLocation } from "../recognition/recognition-schema.js";
import { KEYWORD_PROTOCOL_ID } from "./measurement-schema.js";

type Schema = Record<string, unknown>;

export const KEYWORD_DISCOVERY_SCHEMA_NAME = "keyword_discovery_result";
export const KEYWORD_DISCOVERY_TOOL_DESCRIPTION = "Record the neutral keyword-discovery observation with the required schema.";

const nullableString: Schema = { type: ["string", "null"] };
const nullableInteger: Schema = { type: ["integer", "null"], minimum: 0 };
const mention: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "domain", "recommendation", "mentionQuote", "recommendationQuote", "firstMentionOffset", "firstRecommendationOffset", "firstMentionState", "firstRecommendationState"],
  properties: {
    name: { type: "string" },
    domain: nullableString,
    recommendation: { type: "string", enum: ["positive", "negative", "mentioned", "uncertain"] },
    mentionQuote: nullableString,
    recommendationQuote: nullableString,
    firstMentionOffset: nullableInteger,
    firstRecommendationOffset: nullableInteger,
    firstMentionState: { type: "string", enum: ["unique", "tied", "none", "unresolved"] },
    firstRecommendationState: { type: "string", enum: ["unique", "tied", "none", "unresolved"] },
  },
};

export const keywordDiscoveryResponseSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisStatus", "mentions", "unknowns"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unknown"] },
    mentions: { type: "array", items: mention },
    unknowns: { type: "array", items: { type: "string" } },
  },
};

export const KEYWORD_DISCOVERY_SCHEMA_HASH = sha256(JSON.stringify(keywordDiscoveryResponseSchema));
const PROMPT_TEMPLATE = [
  "Answer a neutral product-selection request using only the supplied keyword.",
  "Do not infer hidden monitored brands, competitors, desired answers, or historical results.",
  "List every identifiable product or organization appearing in your answer, including ones that are not recommendations.",
  "For each item, state whether this response positively recommends it, rejects it, merely mentions it, or leaves the relationship uncertain.",
  "Use evidence quotes taken from this response. Record a unique first position only when the response gives an unambiguous order; otherwise record tied, none, or unresolved.",
  "Return only the requested JSON schema.",
].join("\n");

export const KEYWORD_DISCOVERY_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

function languageInstruction(language: "zh" | "en"): string {
  return language === "zh" ? "所有字符串值使用简体中文。" : "Use English for all string values.";
}

export function keywordDiscoveryPrompt(input: { keyword: string; language: "zh" | "en" }): string {
  return [
    PROMPT_TEMPLATE,
    `Keyword: ${input.keyword}`,
    `Protocol: ${KEYWORD_PROTOCOL_ID}`,
    languageInstruction(input.language),
  ].join("\n");
}

export interface StructuredKeywordMention {
  name: string;
  domain: string | null;
  recommendation: "positive" | "negative" | "mentioned" | "uncertain";
  mentionQuote: string | null;
  recommendationQuote: string | null;
  firstMentionOffset: number | null;
  firstRecommendationOffset: number | null;
  firstMentionState: "unique" | "tied" | "none" | "unresolved";
  firstRecommendationState: "unique" | "tied" | "none" | "unresolved";
}

export interface StructuredKeywordDiscoveryOutput {
  analysisStatus: "completed" | "unknown";
  mentions: StructuredKeywordMention[];
  unknowns: string[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, field: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string${nullable ? " or null" : ""}.`);
  const trimmed = value.trim();
  if (!trimmed && !nullable) throw new Error(`${field} must not be empty.`);
  return trimmed || null;
}

function list(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${field} must be an array of strings.`);
  return value.map((item) => item.trim()).filter(Boolean);
}

function offset(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  throw new Error(`${field} must be a non-negative integer or null.`);
}

function codeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstBreak = trimmed.indexOf("\n");
  const lastFence = trimmed.lastIndexOf("```");
  if (firstBreak < 0 || lastFence <= firstBreak || lastFence + 3 !== trimmed.length) throw new Error("Structured output code fence is incomplete.");
  const header = trimmed.slice(3, firstBreak).trim().toLocaleLowerCase();
  if (header && header !== "json") throw new Error("Structured output code fence must contain JSON only.");
  return trimmed.slice(firstBreak + 1, lastFence).trim();
}

export function parseKeywordDiscoveryOutput(value: unknown): StructuredKeywordDiscoveryOutput {
  const parsed = typeof value === "string" ? JSON.parse(codeFence(value)) : value;
  const root = asObject(parsed);
  if (!root) throw new Error("Structured keyword discovery output must be an object.");
  if (root.analysisStatus !== "completed" && root.analysisStatus !== "unknown") throw new Error("analysisStatus is invalid.");
  if (!Array.isArray(root.mentions)) throw new Error("mentions must be an array.");
  const mentions: StructuredKeywordMention[] = root.mentions.map((value, index) => {
    const row = asObject(value);
    if (!row) throw new Error(`mentions[${index}] must be an object.`);
    const recommendation = row.recommendation;
    const firstMentionState = row.firstMentionState;
    const firstRecommendationState = row.firstRecommendationState;
    if (recommendation !== "positive" && recommendation !== "negative" && recommendation !== "mentioned" && recommendation !== "uncertain") throw new Error(`mentions[${index}].recommendation is invalid.`);
    if (firstMentionState !== "unique" && firstMentionState !== "tied" && firstMentionState !== "none" && firstMentionState !== "unresolved") throw new Error(`mentions[${index}].firstMentionState is invalid.`);
    if (firstRecommendationState !== "unique" && firstRecommendationState !== "tied" && firstRecommendationState !== "none" && firstRecommendationState !== "unresolved") throw new Error(`mentions[${index}].firstRecommendationState is invalid.`);
    return {
      name: text(row.name, `mentions[${index}].name`) as string,
      domain: text(row.domain, `mentions[${index}].domain`, true),
      recommendation,
      mentionQuote: text(row.mentionQuote, `mentions[${index}].mentionQuote`, true),
      recommendationQuote: text(row.recommendationQuote, `mentions[${index}].recommendationQuote`, true),
      firstMentionOffset: offset(row.firstMentionOffset, `mentions[${index}].firstMentionOffset`),
      firstRecommendationOffset: offset(row.firstRecommendationOffset, `mentions[${index}].firstRecommendationOffset`),
      firstMentionState,
      firstRecommendationState,
    };
  });
  return { analysisStatus: root.analysisStatus, mentions, unknowns: list(root.unknowns, "unknowns") };
}

export function evidenceLocation(answer: string, quote: string | null, suggestedOffset: number | null): AnswerEvidenceLocation | null {
  if (!quote) return null;
  const offset = suggestedOffset !== null && answer.slice(suggestedOffset, suggestedOffset + quote.length) === quote ? suggestedOffset : answer.indexOf(quote);
  if (offset < 0) return null;
  return { quote, start: offset, end: offset + quote.length, encoding: "utf16_code_unit" };
}
