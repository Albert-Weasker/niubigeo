import type { Citation, Entity, Mention, MentionType, PromptRunAnalysis, Sentiment } from "../core/types.js";
import { attachCitationTypes } from "./citation-intelligence.js";
import { normalizeDomain } from "../utils/domain.js";

const POSITIVE_TERMS = [
  "recommend",
  "recommended",
  "best",
  "top",
  "strong",
  "excellent",
  "great",
  "leading",
  "popular",
  "trusted",
  "reliable",
  "solid",
  "standout",
  "good choice",
  "consider",
];

const NEGATIVE_TERMS = [
  "avoid",
  "not recommend",
  "do not recommend",
  "don't recommend",
  "weak",
  "poor",
  "bad",
  "risk",
  "risky",
  "concern",
  "limited",
  "expensive",
  "worse",
  "discouraged",
  "problem with",
  "problems with",
  "issue with",
  "issues with",
  "drawback",
  "drawbacks",
  "limitation",
  "limitations",
];

const COMPARISON_TERMS = [" vs ", " versus ", " compared", " compare", "alternative", "competitor", "instead of"];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskUrls(text: string): string {
  return text.replace(/\bhttps?:\/\/[^\s<>)\]}"]+/gi, (match) => " ".repeat(match.length));
}

function compileTermPattern(term: string): RegExp {
  const trimmed = term.trim();
  const left = /^\w/.test(trimmed) ? "(?<!\\w)" : "";
  const right = /\w$/.test(trimmed) ? "(?!\\w)" : "";
  return new RegExp(`${left}${escapeRegex(trimmed)}${right}`, "gi");
}

function entityTerms(entity: Entity): string[] {
  const domain = normalizeDomain(entity.domain);
  const root = domain.split(".")[0] || "";
  const repoName = entity.githubRepo?.split("/").pop();
  const terms = [entity.name, domain, root.length >= 3 ? root : "", repoName, ...entity.aliases];
  return [...new Set(terms.map((term) => term?.trim()).filter((term): term is string => Boolean(term)))];
}

function findMatches(text: string, entity: Entity): Array<{ text: string; index: number }> {
  const masked = maskUrls(text);
  const matches: Array<{ text: string; index: number }> = [];
  const seen = new Set<string>();
  for (const term of entityTerms(entity)) {
    const pattern = compileTermPattern(term);
    for (const match of masked.matchAll(pattern)) {
      if (typeof match.index !== "number") continue;
      const key = `${match.index}:${match[0].toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ text: text.slice(match.index, match.index + match[0].length), index: match.index });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function paragraphAt(text: string, index: number | null): string | null {
  if (index === null) return null;
  const paragraphs = text.split(/\n{2,}/);
  let cursor = 0;
  for (const paragraph of paragraphs) {
    const start = cursor;
    const end = cursor + paragraph.length;
    if (index >= start && index <= end) return paragraph.trim().slice(0, 1200);
    cursor = end + 2;
  }
  return contextAt(text, index);
}

function contextAt(text: string, index: number | null): string | null {
  if (index === null) return null;
  return text.slice(Math.max(0, index - 240), Math.min(text.length, index + 520)).trim();
}

function sentenceAt(text: string, index: number | null): string | null {
  if (index === null) return null;
  const left = text.slice(0, index).search(/[^.!?\n。！？]*$/);
  const start = left >= 0 ? left : Math.max(0, index - 180);
  const tail = text.slice(index);
  const right = tail.search(/[.!?\n。！？]/);
  const end = right >= 0 ? index + right + 1 : Math.min(text.length, index + 320);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => compileTermPattern(term).test(text));
}

function isListContext(context: string): boolean {
  return /(^|\n)\s*(?:[-*]|\d+[.)])\s+/m.test(context);
}

function classifyMention(context: string | null, hasCitationOnly: boolean): MentionType {
  if (!context) return hasCitationOnly ? "citation_source" : "not_mentioned";
  const lower = context.toLowerCase();
  if (lower.includes("not recommend") || lower.includes("do not recommend") || lower.includes("don't recommend")) {
    return "rejection";
  }
  if (includesAny(lower, NEGATIVE_TERMS)) return "negative";
  if (includesAny(lower, COMPARISON_TERMS)) return "comparison";
  if (includesAny(lower, POSITIVE_TERMS)) return "recommendation";
  if (isListContext(context)) return "list_appearance";
  return "ordinary";
}

function sentimentFor(context: string | null): Sentiment {
  if (!context) return "neutral";
  const lower = context.toLowerCase();
  if (includesAny(lower, NEGATIVE_TERMS)) return "negative";
  if (includesAny(lower, POSITIVE_TERMS)) return "positive";
  return "neutral";
}

function entityHasCitation(entity: Entity, citations: Citation[]): boolean {
  return citations.some((citation) => citation.entityId === entity.id);
}

export class ResponseAnalyzer {
  analyze(input: { text: string; citations: Citation[]; target: Entity; competitors: Entity[] }): PromptRunAnalysis {
    const entities = [input.target, ...input.competitors];
    const citations = attachCitationTypes(input.citations, input.target, input.competitors);
    const firstPositions = new Map<string, number>();

    for (const entity of entities) {
      const first = findMatches(input.text, entity)[0]?.index;
      if (typeof first === "number") firstPositions.set(entity.id, first);
    }

    const rankedEntityIds = [...firstPositions.entries()].sort((a, b) => a[1] - b[1]).map(([entityId]) => entityId);
    const mentions: Mention[] = [];

    for (const entity of entities) {
      const matches = findMatches(input.text, entity);
      const firstPosition = matches[0]?.index ?? null;
      const context = contextAt(input.text, firstPosition);
      const paragraph = paragraphAt(input.text, firstPosition);
      const classificationContext = sentenceAt(input.text, firstPosition) || context;
      const hasCitation = entityHasCitation(entity, citations);
      const mentionType = matches.length > 0 ? classifyMention(classificationContext, false) : classifyMention(null, hasCitation);
      const rankIndex = rankedEntityIds.indexOf(entity.id);
      const isRecommendation = mentionType === "recommendation" || mentionType === "list_appearance";

      mentions.push({
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        count: matches.length,
        firstPosition,
        rankPosition: rankIndex >= 0 ? rankIndex + 1 : null,
        mentionType,
        sentiment: sentimentFor(classificationContext),
        isMentioned: matches.length > 0,
        isRecommendation,
        isFirstPosition: rankIndex === 0,
        hasCitation,
        hasOfficialLink: hasCitation && entity.type === "target",
        context,
        paragraph,
      });
    }

    return { mentions, citations };
  }
}
