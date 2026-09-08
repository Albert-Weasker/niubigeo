import type { EntityIdentityStatus, EntityRelationshipType, EntityRole, IntentEntityType, UncertaintyLevel } from "../intent/intent-schema.js";

export type EntityRegistryGroup =
  | "confirmed_competitors"
  | "suspected_brands"
  | "alternative_methods"
  | "promotion_channels"
  | "sources"
  | "other"
  | "unresolved";

export interface ResolvedEntityEvidence {
  observationId: string;
  promptId: string;
  providerId: string;
  model: string;
  quote: string;
  sourceUrls: string[];
  targetMentioned: boolean;
}

export interface ResolvedEntity {
  key: string;
  name: string;
  canonicalName?: string | undefined;
  canonicalUrl?: string | undefined;
  entityType: IntentEntityType;
  identityStatus: EntityIdentityStatus;
  entityRole: EntityRole;
  group: EntityRegistryGroup;
  relationshipsToTarget: EntityRelationshipType[];
  confidence: UncertaintyLevel;
  evidence: ResolvedEntityEvidence[];
  observationCount: number;
  targetAbsentObservationCount: number;
  providerModels: string[];
}

export interface EntityRegistry {
  confirmedCompetitors: ResolvedEntity[];
  suspectedBrands: ResolvedEntity[];
  alternativeMethods: ResolvedEntity[];
  promotionChannels: ResolvedEntity[];
  sources: ResolvedEntity[];
  other: ResolvedEntity[];
  unresolved: ResolvedEntity[];
}
