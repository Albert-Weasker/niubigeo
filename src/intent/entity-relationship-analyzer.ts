import {
  ENTITY_IDENTITY_STATUSES,
  ENTITY_RELATIONSHIPS,
  ENTITY_ROLES,
  ENTITY_TYPES,
  UNCERTAINTY_LEVELS,
} from "./intent-schema.js";

function list(values: readonly string[]): string {
  return values.join(" | ");
}

export function entityRelationshipAnalyzerInstructions(): string {
  return [
    "Entity Relationship Analyzer",
    "Identify important named entities in the answer and classify their relationship from context.",
    "An entity is not a competitor just because it appears near the target brand.",
    "Only mark competitor-like relationships when the answer clearly compares, substitutes, or positions the entity against the target.",
    "Resolve identity separately from relationship. A shared name does not prove that two pages describe the same product.",
    "Use identityStatus=confirmed only when a provider citation identifies the named entity and the answer contains a supporting description.",
    "canonicalUrl must be copied exactly from the supplied provider citations. Omit it when identity is ambiguous or unresolved.",
    "For every entity, evidenceQuote must be an exact substring from the actual AI answer when available.",
    "",
    "Return entities with:",
    "name: entity name",
    "canonicalName: confirmed canonical name when available",
    "canonicalUrl: confirming provider citation URL when available",
    `entityType: ${list(ENTITY_TYPES)}`,
    `identityStatus: ${list(ENTITY_IDENTITY_STATUSES)}`,
    `entityRole: ${list(ENTITY_ROLES)}`,
    `relationshipToQuestion: ${list(ENTITY_RELATIONSHIPS)}`,
    `relationshipToTarget: ${list(ENTITY_RELATIONSHIPS)}`,
    `confidence: ${list(UNCERTAINTY_LEVELS)}`,
    "explanation: one plain-language sentence",
    "sourceUrls: URLs from provider citations only",
  ].join("\n");
}
