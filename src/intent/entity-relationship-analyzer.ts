import { ENTITY_RELATIONSHIPS, ENTITY_TYPES, UNCERTAINTY_LEVELS } from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function entityRelationshipAnalyzerInstructions(): string {
  return [
    "Entity Relationship Analyzer",
    "Identify important named entities in the answer and classify their relationship from context.",
    "An entity is not a competitor just because it appears near the target brand.",
    "Only mark competitor-like relationships when the answer clearly compares, substitutes, or positions the entity against the target.",
    "For every entity, evidenceQuote must be an exact substring from the actual AI answer when available.",
    "",
    "Return entities with:",
    "name: entity name",
    `entityType: ${list(ENTITY_TYPES)}`,
    `relationshipToQuestion: ${list(ENTITY_RELATIONSHIPS)}`,
    `relationshipToTarget: ${list(ENTITY_RELATIONSHIPS)}`,
    `confidence: ${list(UNCERTAINTY_LEVELS)}`,
    "explanation: one plain-language sentence",
    "sourceUrls: URLs from provider citations only",
  ].join("\n");
}
