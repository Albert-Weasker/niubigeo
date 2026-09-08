import type { ProductModelSnapshot } from "../configuration/baseline-schema.js";
import type { AnswerEvidenceLocation, ProviderCitation, AnswerMentionedUrl } from "../recognition/recognition-schema.js";

export const DOMAIN_PROTOCOL_ID = "domain-recognition/v1";
export const KEYWORD_PROTOCOL_ID = "keyword-discovery/v1";
export const MATCHING_RULE_VERSION = "measurement-matching/v1";

export type MeasurementProtocolId = typeof DOMAIN_PROTOCOL_ID | typeof KEYWORD_PROTOCOL_ID;
export type WatchObjectRole = "target" | "competitor" | "pending_identity";
export type WatchSetStatus = "draft" | "active" | "retired";
export type MeasurementRunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "budget_blocked";
export type MeasurementModelRunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled" | "budget_blocked";
export type ProbeRunStatus = "queued" | "running" | "completed" | "failed" | "unsupported" | "cancelled" | "budget_blocked" | "unknown";
export type ProbeAttemptStatus = "queued" | "running" | "completed" | "provider_failed" | "unsupported" | "analysis_failed" | "unknown" | "budget_blocked" | "cancelled";
export type DiscoveryRecommendation = "positive" | "negative" | "mentioned" | "uncertain";
export type FirstPositionState = "unique" | "tied" | "none" | "unresolved";
export type ProbeKind = "target_domain" | "competitor_domain" | "keyword_discovery";
export type CostState = "estimated" | "reserved" | "known" | "unknown";

export interface WatchObject {
  id: string;
  projectId: string;
  role: WatchObjectRole;
  name: string;
  domain: string | null;
  aliases: string[];
  sourceRecordIds: string[];
  selectedAt: string;
  identityState: "confirmed" | "pending";
}

export interface WatchKeyword {
  id: string;
  projectId: string;
  keyword: string;
  normalizedKeyword: string;
  sourceRecordIds: string[];
  selectedAt: string;
  neutralEligible: boolean;
  neutralEligibilityReason: "eligible" | "contains_monitored_identity" | "identity_unresolved";
}

export interface MeasurementProtocolSnapshot {
  id: MeasurementProtocolId;
  version: string;
  language: "zh" | "en";
  scenario?: string | undefined;
  responseSchemaHash: string;
  promptTemplateHash: string;
}

export interface WatchSet {
  id: string;
  projectId: string;
  baselineId: string;
  version: number;
  status: WatchSetStatus;
  targetObjectId: string;
  objects: WatchObject[];
  keywords: WatchKeyword[];
  domainProtocol: MeasurementProtocolSnapshot;
  keywordProtocol: MeasurementProtocolSnapshot;
  repetitions: number;
  matchingRuleVersion: string;
  createdAt: string;
  confirmedAt?: string | undefined;
  retiredAt?: string | undefined;
}

export interface MeasurementBudget {
  requestLimit: number;
  dailyRequestLimit: number | null;
  tokenLimit: number | null;
  costLimitUsd: number | null;
}

export interface MeasurementRun {
  id: string;
  projectId: string;
  baselineId: string;
  baselineVersion: number;
  watchSetId: string;
  watchSetVersion: number;
  source: "manual" | "scheduled";
  modelScope: string[];
  plannedProbeCount: number;
  completedProbeCount: number;
  failedProbeCount: number;
  status: MeasurementRunStatus;
  budget: MeasurementBudget;
  idempotencyKey?: string | undefined;
  occurrenceId?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface MeasurementModelRun {
  id: string;
  projectId: string;
  runId: string;
  baselineId: string;
  modelSnapshot: ProductModelSnapshot;
  probeRunIds: string[];
  status: MeasurementModelRunStatus;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface ProbeFingerprint {
  value: string;
  modelId: string;
  webSearchMode: "off" | "provider_native";
  protocolId: MeasurementProtocolId;
  protocolVersion: string;
  language: "zh" | "en";
  subject: string;
  scenario: string | null;
  repetitions: number;
  matchingRuleVersion: string;
  keywordSetHash: string | null;
}

export interface ProbeRun {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  protocol: MeasurementProtocolSnapshot;
  kind: ProbeKind;
  subjectObjectId?: string | undefined;
  subjectDomain?: string | undefined;
  keywordId?: string | undefined;
  keyword?: string | undefined;
  sampleNumber: number;
  fingerprint: ProbeFingerprint;
  status: ProbeRunStatus;
  attemptIds: string[];
  firstAttemptId?: string | undefined;
  latestAttemptId?: string | undefined;
  plannedAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  exclusionReason?: string | undefined;
}

export interface ProbeRequestParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  requireProviderParameters: boolean;
  responseSchemaName: string;
  responseSchemaHash: string;
  structuredOutputTransport: "response_json_schema" | "function_tool";
  webSearchEnabled: boolean;
  webSearchMode: "off" | "provider_native";
}

export interface ProbeAttempt {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  probeRunId: string;
  attemptNumber: number;
  status: ProbeAttemptStatus;
  promptHash: string;
  requestParameters: ProbeRequestParameters;
  rawProviderResponse?: unknown;
  rawAnswer?: string | undefined;
  providerId: "openrouter";
  providerModel?: string | undefined;
  providerModelVersion?: string | undefined;
  providerSearch?: unknown;
  tokenUsage?: { input: number; output: number; total: number } | undefined;
  costUsd?: number | null | undefined;
  costState: CostState;
  latencyMs?: number | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface KeywordDiscoveryMention {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  probeRunId: string;
  attemptId: string;
  name: string;
  domain: string | null;
  matchedObjectId: string | null;
  matchingBasis: "exact_name_and_domain" | "exact_name" | "exact_domain" | "unresolved";
  recommendation: DiscoveryRecommendation;
  mentionEvidence: AnswerEvidenceLocation | null;
  recommendationEvidence: AnswerEvidenceLocation | null;
  firstMentionOffset: number | null;
  firstRecommendationOffset: number | null;
  firstMentionState: FirstPositionState;
  firstRecommendationState: FirstPositionState;
  createdAt: string;
}

export interface KeywordDiscoveryResult {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  probeRunId: string;
  attemptId: string;
  analysisStatus: "completed" | "unknown" | "analysis_failed";
  mentionJudgment: "adjudicable" | "unknown";
  recommendationJudgment: "adjudicable" | "unknown";
  firstMentionJudgment: "adjudicable" | "unknown";
  firstRecommendationJudgment: "adjudicable" | "unknown";
  unknowns: string[];
  createdAt: string;
}

export interface DomainProbeResult {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  probeRunId: string;
  attemptId: string;
  domainRecognition: "recognized" | "not_recognized" | "unknown" | null;
  analysisStatus: "recognized" | "partially_recognized" | "unknown" | "ambiguous" | "analysis_failed";
  recognizedBrand: string | null;
  businessDescription: string | null;
  productCategory: string | null;
  associatedKeywords: Array<{ keyword: string; evidence: AnswerEvidenceLocation | null }>;
  unknowns: string[];
  createdAt: string;
}

export interface ProbeEvidenceArchive {
  providerCitations: ProviderCitation[];
  answerMentionedUrls: AnswerMentionedUrl[];
}

export interface MeasurementProbeDetail {
  probe: ProbeRun;
  attempts: ProbeAttempt[];
  domainResult?: DomainProbeResult | undefined;
  keywordResult?: KeywordDiscoveryResult | undefined;
  mentions: KeywordDiscoveryMention[];
  evidence: ProbeEvidenceArchive;
}

export type MeasurementMetricId =
  | "domain_recognition"
  | "brand_name_mention"
  | "domain_body_mention"
  | "keyword_association_coverage"
  | "keyword_association_count"
  | "keyword_relative_weight"
  | "positive_recommendation"
  | "first_mention"
  | "first_recommendation"
  | "provider_citation"
  | "recommendation_gap";

export interface MetricPointSample {
  probeRunId: string;
  attemptId: string | null;
  included: boolean;
  numerator: boolean;
  exclusionReason: string | null;
}

export interface MeasurementMetricPoint {
  id: string;
  projectId: string;
  metric: MeasurementMetricId;
  objectId: string | null;
  comparisonObjectId: string | null;
  keywordId: string | null;
  modelId: string;
  modelDisplayName: string;
  webSearchMode: "off" | "provider_native";
  fingerprint: string;
  runId: string;
  observedAt: string;
  numerator: number;
  denominator: number;
  comparisonNumerator: number | null;
  comparisonDenominator: number | null;
  planned: number;
  failed: number;
  value: number | null;
  valueUnit: "percentage" | "count" | "percentage_points";
  complete: boolean;
  pointState: "complete" | "partial" | "no_data";
  sampleIds: string[];
  samples: MetricPointSample[];
}

export interface MeasurementStatsSnapshot {
  id: string;
  projectId: string;
  generatedAt: string;
  sourceRunIds: string[];
  points: MeasurementMetricPoint[];
}
