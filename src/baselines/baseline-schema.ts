import type { KeywordMode, MonitoringPrompt, ProviderTarget } from "../core/types.js";

export type BaselineStatus = "draft" | "active" | "retired" | "legacy_snapshot";

export type BaselineSource = "audit_plan" | "audit_run" | "legacy_snapshot";

export interface MonitoringBaseline {
  id: string;
  projectId: string;
  name: string;
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  promptSetHash: string;
  promptSetVersion: string;
  analysisRulesVersion: string;
  runCountPerPrompt: number;
  entityScopeHash: string;
  comparableKey: string;
  trendEligible: boolean;
  status: BaselineStatus;
  source: BaselineSource;
  autoDiscover: boolean;
  keywordMode?: KeywordMode | undefined;
  sourcePlanId?: string | undefined;
  sourceAuditId?: string | undefined;
  sourceBaselineId?: string | undefined;
  nonComparableReason?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface BaselineComparison {
  comparable: boolean;
  reason: string;
  differingFields: string[];
}
