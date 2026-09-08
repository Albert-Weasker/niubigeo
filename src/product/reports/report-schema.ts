import type { AnswerEvidenceLocation, ClaimCitationLink, RecognitionAnalysisStatus, RecognitionMode, RecognitionModelRunAttempt, RecognitionRunStatus } from "../recognition/recognition-schema.js";

export const REPORT_SCHEMA_VERSION = "recognition-report/v1";
export const REPORT_GROUPING_RULE_VERSION = "exact-name-host/v1";

export type ReportContentStatus = "ready" | "partial" | "no_usable_results";
export type ReportModelState = RecognitionAnalysisStatus | "not_recognized" | "provider_failed" | "unsupported" | "evidence_integrity_error";
export type ReportFieldState = "reported" | "not_reported" | "field_unavailable" | "analysis_failed" | "provider_failed" | "unsupported" | "entity_unresolved";

export interface ReportSourceRecordHash {
  source: "run" | "model_run" | "attempt" | "archive" | "baseline";
  id: string;
  sha256: string;
}

export interface ReportSourceAttempt {
  modelRunId: string;
  attemptId: string | null;
  archiveAttemptId: string | null;
}

export interface ReportEvidence {
  evidence: AnswerEvidenceLocation | null;
  integrity: "valid" | "missing" | "invalid";
}

export interface ReportClaim {
  value: string | null;
  evidence: ReportEvidence;
}

export interface ReportCompetitorRecord {
  id: string;
  name: string;
  domain: string | null;
  businessDescription: ReportClaim;
  productCategory: ReportClaim;
  evidence: ReportEvidence;
  keywordIds: string[];
}

export interface ReportKeywordRecord {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  competitorRecordId?: string | undefined;
  evidence: ReportEvidence;
}

export interface ReportProviderCitation {
  id: string;
  url: string;
  domain: string;
  title: string;
  providerPayloadPath: string;
  providerCitationSource: string;
}

export interface ReportAnswerUrl {
  id: string;
  url: string;
  domain: string;
  evidence: ReportEvidence;
}

export interface ReportModelObservation {
  modelRunId: string;
  modelId: string;
  displayName: string;
  recognitionMode: RecognitionMode;
  webSearch: {
    requested: boolean | null;
    used: boolean | null;
    usedMode: string | null;
    executionMode: string | null;
    label: string;
  };
  modelRunStatus: string;
  attemptStatus: RecognitionModelRunAttempt["status"] | null;
  state: ReportModelState;
  sourceAttemptId: string | null;
  rawAnswer: string | null;
  rawProviderResponse: unknown;
  recognizedBrand: ReportClaim | null;
  businessDescription: ReportClaim | null;
  productCategory: ReportClaim | null;
  unknowns: string[];
  competitors: ReportCompetitorRecord[] | null;
  brandKeywords: ReportKeywordRecord[] | null;
  competitorKeywords: ReportKeywordRecord[] | null;
  providerCitations: ReportProviderCitation[] | null;
  answerMentionedUrls: ReportAnswerUrl[] | null;
  claimCitationLinks: ClaimCitationLink[] | null;
  unavailableReason: string | null;
  sourceHashes: ReportSourceRecordHash[];
}

export interface ReportMatrixCell {
  modelRunId: string;
  state: ReportFieldState;
  recordIds: string[];
  keywordRecordIds: string[];
}

export interface ReportCompetitorGroup {
  id: string;
  name: string;
  host: string | null;
  identity: "confirmed_exact" | "unresolved";
  groupingRule: string;
  sourceRecordIds: string[];
  cells: ReportMatrixCell[];
}

export interface ReportKeywordGroup {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  sourceRecordIds: string[];
  cells: ReportMatrixCell[];
}

export interface RecognitionReport {
  reportId: string;
  projectId: string;
  runId: string;
  baselineId: string;
  reportRevision: number;
  sourceFingerprint: string;
  sourceAttemptMap: ReportSourceAttempt[];
  sourceRecordHashes: ReportSourceRecordHash[];
  reportSchemaVersion: typeof REPORT_SCHEMA_VERSION;
  groupingRuleVersion: typeof REPORT_GROUPING_RULE_VERSION;
  generatedAt: string;
  contentStatus: ReportContentStatus;
  runStatus: RecognitionRunStatus;
  domain: string;
  language: "zh" | "en";
  monitoringConfigurationVersion: number;
  protocol: {
    id: string;
    version: string;
  };
  models: ReportModelObservation[];
  competitorGroups: ReportCompetitorGroup[];
  brandKeywordGroups: ReportKeywordGroup[];
}
