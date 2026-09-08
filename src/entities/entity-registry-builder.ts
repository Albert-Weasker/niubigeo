import { createHash } from "node:crypto";
import {
  ENTITY_IDENTITY_STATUSES,
  ENTITY_ROLES,
  ENTITY_TYPES,
  UNCERTAINTY_LEVELS,
  type EntityIdentityStatus,
  type EntityRelationship,
  type EntityRelationshipType,
  type EntityRole,
  type IntentEntityType,
  type UncertaintyLevel,
} from "../intent/intent-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import type { EntityRegistry, EntityRegistryGroup, ResolvedEntity, ResolvedEntityEvidence } from "./entity-schema.js";

const COMPETITOR_RELATIONSHIPS = new Set<EntityRelationshipType>(["competitor", "direct_alternative"]);
const BRAND_RELATIONSHIPS = new Set<EntityRelationshipType>(["competitor", "direct_alternative", "indirect_alternative", "compared_option"]);
const CONFIDENCE_ORDER: Record<UncertaintyLevel, number> = { low: 0, medium: 1, high: 2 };

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function member<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function identityStatus(entity: EntityRelationship): EntityIdentityStatus {
  return member(entity.identityStatus, ENTITY_IDENTITY_STATUSES, "unresolved");
}

function entityRole(entity: EntityRelationship): EntityRole {
  return member(entity.entityRole, ENTITY_ROLES, "unclear");
}

function entityType(entity: EntityRelationship): IntentEntityType {
  return member(entity.entityType, ENTITY_TYPES, "unknown");
}

function confidence(entity: EntityRelationship): UncertaintyLevel {
  return member(entity.confidence, UNCERTAINTY_LEVELS, "high");
}

function relationship(entity: EntityRelationship): EntityRelationshipType {
  return entity.relationshipToTarget !== "unclear" ? entity.relationshipToTarget : entity.relationshipToQuestion;
}

function groupFor(entity: EntityRelationship): EntityRegistryGroup {
  const relation = relationship(entity);
  if (
    identityStatus(entity) === "confirmed" &&
    entityRole(entity) === "product_or_brand" &&
    Boolean(entity.canonicalUrl) &&
    Boolean(entity.evidenceQuote) &&
    COMPETITOR_RELATIONSHIPS.has(relation)
  ) {
    return "confirmed_competitors";
  }
  if (entityRole(entity) === "product_or_brand" && BRAND_RELATIONSHIPS.has(relation)) return "suspected_brands";
  if (entityRole(entity) === "alternative_method") return "alternative_methods";
  if (entityRole(entity) === "promotion_channel") return "promotion_channels";
  if (entityRole(entity) === "source") return "sources";
  if (identityStatus(entity) === "unresolved" || entityRole(entity) === "unclear") return "unresolved";
  return "other";
}

function entityKey(entity: EntityRelationship): string {
  const identity = entity.canonicalUrl || entity.canonicalName || entity.name;
  return createHash("sha256").update(identity.trim().toLocaleLowerCase()).digest("hex").slice(0, 16);
}

function evidenceFrom(observation: Observation, entity: EntityRelationship): ResolvedEntityEvidence | null {
  if (!entity.evidenceQuote) return null;
  return {
    observationId: observation.id,
    promptId: observation.promptId,
    providerId: observation.providerId,
    model: observation.model,
    quote: entity.evidenceQuote,
    sourceUrls: [...entity.sourceUrls],
    targetMentioned: observation.evidence.targetMentioned,
  };
}

function strongest(a: UncertaintyLevel, b: UncertaintyLevel): UncertaintyLevel {
  return CONFIDENCE_ORDER[b] > CONFIDENCE_ORDER[a] ? b : a;
}

function buildRow(observation: Observation, entity: EntityRelationship): ResolvedEntity {
  const evidence = evidenceFrom(observation, entity);
  const row: ResolvedEntity = {
    key: entityKey(entity),
    name: entity.name,
    entityType: entityType(entity),
    identityStatus: identityStatus(entity),
    entityRole: entityRole(entity),
    group: groupFor(entity),
    relationshipsToTarget: [relationship(entity)],
    confidence: confidence(entity),
    evidence: evidence ? [evidence] : [],
    observationCount: evidence ? 1 : 0,
    targetAbsentObservationCount: evidence && !evidence.targetMentioned ? 1 : 0,
    providerModels: evidence ? [`${observation.providerId}/${observation.model}`] : [],
  };
  if (entity.canonicalName) row.canonicalName = entity.canonicalName;
  if (entity.canonicalUrl) row.canonicalUrl = entity.canonicalUrl;
  return row;
}

function merge(current: ResolvedEntity, observation: Observation, entity: EntityRelationship): ResolvedEntity {
  const evidence = evidenceFrom(observation, entity);
  const evidenceRows = evidence && !current.evidence.some((row) => row.observationId === evidence.observationId)
    ? [...current.evidence, evidence]
    : current.evidence;
  const nextGroup = groupFor(entity);
  const group = current.group === "confirmed_competitors" || nextGroup === "confirmed_competitors" ? "confirmed_competitors" : current.group;
  return {
    ...current,
    name: entity.canonicalName || current.canonicalName || current.name,
    canonicalName: entity.canonicalName || current.canonicalName,
    canonicalUrl: entity.canonicalUrl || current.canonicalUrl,
    identityStatus: identityStatus(entity) === "confirmed" ? "confirmed" : current.identityStatus,
    entityRole: entityRole(entity) !== "unclear" ? entityRole(entity) : current.entityRole,
    group,
    relationshipsToTarget: unique([...current.relationshipsToTarget, relationship(entity)]) as EntityRelationshipType[],
    confidence: strongest(current.confidence, confidence(entity)),
    evidence: evidenceRows,
    observationCount: new Set(evidenceRows.map((row) => row.observationId)).size,
    targetAbsentObservationCount: new Set(evidenceRows.filter((row) => !row.targetMentioned).map((row) => row.observationId)).size,
    providerModels: unique([...current.providerModels, ...(evidence ? [`${observation.providerId}/${observation.model}`] : [])]),
  };
}

function emptyRegistry(): EntityRegistry {
  return {
    confirmedCompetitors: [],
    suspectedBrands: [],
    alternativeMethods: [],
    promotionChannels: [],
    sources: [],
    other: [],
    unresolved: [],
  };
}

function append(registry: EntityRegistry, entity: ResolvedEntity): void {
  if (entity.group === "confirmed_competitors") registry.confirmedCompetitors.push(entity);
  else if (entity.group === "suspected_brands") registry.suspectedBrands.push(entity);
  else if (entity.group === "alternative_methods") registry.alternativeMethods.push(entity);
  else if (entity.group === "promotion_channels") registry.promotionChannels.push(entity);
  else if (entity.group === "sources") registry.sources.push(entity);
  else if (entity.group === "unresolved") registry.unresolved.push(entity);
  else registry.other.push(entity);
}

export class EntityRegistryBuilder {
  build(observations: Observation[]): EntityRegistry {
    const rows = new Map<string, ResolvedEntity>();
    for (const observation of observations) {
      if (observation.intentAnalysis?.status !== "completed") continue;
      for (const entity of observation.intentAnalysis.entities) {
        const key = entityKey(entity);
        const current = rows.get(key);
        rows.set(key, current ? merge(current, observation, entity) : buildRow(observation, entity));
      }
    }
    const registry = emptyRegistry();
    const sorted = [...rows.values()].sort((a, b) =>
      b.targetAbsentObservationCount - a.targetAbsentObservationCount ||
      b.observationCount - a.observationCount ||
      a.name.localeCompare(b.name),
    );
    for (const entity of sorted) append(registry, entity);
    return registry;
  }
}
