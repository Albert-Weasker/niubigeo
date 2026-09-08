import type { Citation, Entity, Mention, MentionType, PromptRunAnalysis, Sentiment } from "../core/types.js";
import { attachCitationTypes } from "./citation-intelligence.js";
import { normalizeDomain } from "../utils/domain.js";
import { linkifyit } from "linkify-it";
import { occurrences } from "../utils/text.js";
import type { EntityRelationshipType, IntentRunAnalysis } from "../intent/intent-schema.js";

const linkify = linkifyit();

function entityTerms(entity: Entity): string[] {
  const domain = normalizeDomain(entity.domain);
  const root = domain.split(".")[0] || "";
  const repoName = entity.githubRepo?.split("/").pop();
  const terms = [entity.name, domain, root.length >= 3 ? root : "", repoName, ...entity.aliases];
  return [...new Set(terms.map((term) => term?.trim()).filter((term): term is string => Boolean(term)))];
}

function findMatches(text: string, entity: Entity): Array<{ text: string; index: number }> {
  const maskedCharacters = [...text];
  for (const match of linkify.match(text) || []) {
    for (let index = match.index; index < match.lastIndex; index += 1) maskedCharacters[index] = " ";
  }
  const masked = maskedCharacters.join("");
  const lower = masked.toLocaleLowerCase();
  const matches: Array<{ text: string; index: number }> = [];
  const seen = new Set<string>();
  for (const term of entityTerms(entity)) {
    const needle = term.toLocaleLowerCase();
    for (const index of occurrences(lower, needle)) {
      const key = `${index}:${needle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ text: text.slice(index, index + term.length), index });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function paragraphAt(text: string, index: number | null): string | null {
  if (index === null) return null;
  const paragraphs = text.split("\n\n");
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
  const boundaries = new Set([".", "!", "?", "\n", "。", "！", "？"]);
  let start = index;
  while (start > 0 && !boundaries.has(text[start - 1] || "")) start -= 1;
  let end = index;
  while (end < text.length && !boundaries.has(text[end] || "")) end += 1;
  if (end < text.length) end += 1;
  return text.slice(start, end).split("\n").join(" ").split("\t").join(" ").trim();
}

function classifyMention(context: string | null, hasCitationOnly: boolean): MentionType {
  if (!context) return hasCitationOnly ? "citation_source" : "not_mentioned";
  return "ordinary";
}

function sentimentFor(context: string | null): Sentiment {
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

const RECOMMENDATION_RELATIONSHIPS = new Set<EntityRelationshipType>(["recommended_option"]);
const COMPARISON_RELATIONSHIPS = new Set<EntityRelationshipType>([
  "compared_option",
  "direct_alternative",
  "indirect_alternative",
  "competitor",
]);

export function applyIntentSemantics(analysis: PromptRunAnalysis, intent: IntentRunAnalysis): PromptRunAnalysis {
  if (intent.status !== "completed") return analysis;
  const targetRelationships = intent.entities.filter((entity) => entity.relationshipToTarget === "target");
  return {
    ...analysis,
    mentions: analysis.mentions.map((mention) => {
      if (!mention.isMentioned) return mention;
      const name = mention.entityName.trim().toLocaleLowerCase();
      const relationships = intent.entities.filter((entity) => {
        if (mention.entityType === "target" && targetRelationships.includes(entity)) return true;
        return entity.name.trim().toLocaleLowerCase() === name;
      });
      const relationshipValues = relationships.flatMap((entity) => [entity.relationshipToQuestion, entity.relationshipToTarget]);
      if (relationshipValues.some((relationship) => RECOMMENDATION_RELATIONSHIPS.has(relationship))) {
        return { ...mention, mentionType: "recommendation", isRecommendation: true };
      }
      if (relationshipValues.some((relationship) => COMPARISON_RELATIONSHIPS.has(relationship))) {
        return { ...mention, mentionType: "comparison", isRecommendation: false };
      }
      return mention;
    }),
  };
}
