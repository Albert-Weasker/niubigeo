import type { BrandQuestionIntent, Entity, ProviderTarget } from "../core/types.js";

export interface ConfirmedQuestion {
  id?: string | undefined;
  text: string;
  enabled?: boolean | undefined;
  declaredIntents?: BrandQuestionIntent[] | null | undefined;
}

export interface ConfirmedAuditSpec {
  target: Entity;
  competitors: Entity[];
  questions: ConfirmedQuestion[];
  providerTargets: ProviderTarget[];
  language: string;
  runCountPerQuestion?: number | undefined;
  scopeConfirmed: true;
}

