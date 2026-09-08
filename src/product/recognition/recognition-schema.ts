import type { ProductModelSnapshot } from "../configuration/baseline-schema.js";

export type RecognitionMode = "unaided_domain_recognition" | "native_web_domain_discovery";

export type RecognitionRunStatus = "queued" | "running" | "completed" | "partial" | "failed";

export type RecognitionModelRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "unknown"
  | "failed"
  | "unsupported";

export type RecognitionAttemptStatus =
  | "queued"
  | "running"
  | "provider_failed"
  | "unsupported"
  | "response_saved"
  | "analysis_failed"
  | "completed"
  | "unknown";

export type DomainRecognitionClaim = "recognized" | "not_recognized" | "unknown";

export type RecognitionAnalysisStatus =
  | "recognized"
  | "partially_recognized"
  | "unknown"
  | "ambiguous"
  | "analysis_failed";

export type RecognitionFieldIssueKind = "missing_field" | "invalid_field" | "conflicting_field";

export interface RecognitionFieldIssue {
  field: string;
  kind: RecognitionFieldIssueKind;
  detail: string;
  sourcePath?: string | undefined;
}

export type RecognitionLocalAnalysisStatus = "complete" | "partial" | "failed";

export type RecognitionRequestExecutionState =
  | "not_started"
  | "running"
  | "response_received"
  | "request_rejected"
  | "transport_failed";

export type RecognitionResponseCompleteness =
  | "complete"
  | "incomplete"
  | "empty"
  | "unavailable"
  | "unknown";

export type RecognitionPrimaryAction =
  | "reanalyze_saved_answer"
  | "retry_request"
  | "check_model_configuration"
  | "open_provider_settings"
  | "none";

export interface RecognitionModelRunPresentation {
  requestExecution: RecognitionRequestExecutionState;
  responseCompleteness: RecognitionResponseCompleteness;
  localAnalysis: RecognitionLocalAnalysisStatus | "not_started" | "running";
  domainRecognition: DomainRecognitionClaim | null;
  primaryAction: RecognitionPrimaryAction;
  statusLabel: string;
  detail: string | null;
}

export interface AnswerEvidenceLocation {
  quote: string;
  start: number;
  end: number;
  encoding: "utf16_code_unit";
}

export interface RecognitionRun {
  id: string;
  projectId: string;
  baselineId: string;
  baselineVersion: number;
  status: RecognitionRunStatus;
  plannedModelRunCount: number;
  successfulModelRunCount: number;
  failedModelRunCount: number;
  idempotencyKey?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface RecognitionModelRun {
  id: string;
  projectId: string;
  runId: string;
  baselineId: string;
  modelSnapshot: ProductModelSnapshot;
  recognitionMode: RecognitionMode;
  status: RecognitionModelRunStatus;
  attemptIds: string[];
  currentAttemptId?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
}

export interface RecognitionRequestParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  responseSchemaName: string;
  responseSchemaHash: string;
  structuredOutputTransport: "response_json_schema" | "function_tool";
  requireProviderParameters: boolean;
  webSearchEnabled: boolean;
  webSearchMode: "off" | "provider_native";
}

export interface RecognitionModelRunAttempt {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptNumber: number;
  status: RecognitionAttemptStatus;
  promptHash: string;
  requestParameters: RecognitionRequestParameters;
  rawProviderResponse?: unknown;
  rawAnswer?: string | undefined;
  providerId: "openrouter";
  providerModel?: string | undefined;
  providerModelVersion?: string | undefined;
  providerSearch?: unknown;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  } | undefined;
  costUsd?: number | null | undefined;
  latencyMs?: number | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface RecognitionClaim {
  value: string | null;
  evidence: AnswerEvidenceLocation | null;
}

export interface RecognitionResult {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionMode: RecognitionMode;
  analysisStatus: RecognitionAnalysisStatus;
  domainRecognition: DomainRecognitionClaim | null;
  recognizedBrand: RecognitionClaim;
  businessDescription: RecognitionClaim;
  productCategory: RecognitionClaim;
  detailedDescription?: RecognitionClaim | undefined;
  unknowns: string[];
  fieldIssues?: RecognitionFieldIssue[] | undefined;
  mappingVersion?: string | undefined;
  createdAt: string;
}

export interface CompetitorRecognition {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  name: string;
  domain: string | null;
  businessDescription: RecognitionClaim;
  productCategory: RecognitionClaim;
  evidence: AnswerEvidenceLocation | null;
  createdAt: string;
}

export interface BrandKeywordRecognition {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  keyword: string;
  normalizedKeyword: string;
  evidence: AnswerEvidenceLocation | null;
  createdAt: string;
}

export interface CompetitorKeywordRecognition {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  competitorRecognitionId: string;
  competitorName: string;
  competitorDomain: string | null;
  keyword: string;
  normalizedKeyword: string;
  evidence: AnswerEvidenceLocation | null;
  createdAt: string;
}

export interface ProviderCitation {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  url: string;
  domain: string;
  title: string;
  providerCitationSource: string;
  providerCitationIndex: number;
  providerPayloadPath: string;
  createdAt: string;
}

export interface AnswerMentionedUrl {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  url: string;
  domain: string;
  evidence: AnswerEvidenceLocation | null;
  createdAt: string;
}

export type RecognitionClaimType =
  | "recognized_brand"
  | "business_description"
  | "product_category"
  | "competitor"
  | "brand_keyword"
  | "competitor_keyword";

export interface ClaimCitationLink {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  providerCitationId: string;
  claimType: RecognitionClaimType;
  claimEntityId: string;
  createdAt: string;
}

export interface RecognitionArchive {
  result: RecognitionResult;
  competitors: CompetitorRecognition[];
  brandKeywords: BrandKeywordRecognition[];
  competitorKeywords: CompetitorKeywordRecognition[];
  providerCitations: ProviderCitation[];
  answerMentionedUrls: AnswerMentionedUrl[];
  claimCitationLinks: ClaimCitationLink[];
}

export interface RecognitionAnalysisRevision {
  id: string;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  sourceRawAnswerHash: string;
  analyzerVersion: string;
  status: RecognitionLocalAnalysisStatus;
  archive: RecognitionArchive;
  createdAt: string;
}

export interface RecognitionRunDetail {
  run: RecognitionRun;
  modelRuns: RecognitionModelRun[];
}

export interface RecognitionModelRunDetail {
  modelRun: RecognitionModelRun;
  attempts: RecognitionModelRunAttempt[];
  archive?: RecognitionArchive | undefined;
  archives: RecognitionArchive[];
  analysisRevisions: RecognitionAnalysisRevision[];
  currentAnalysis?: RecognitionAnalysisRevision | undefined;
  presentation: RecognitionModelRunPresentation;
}
