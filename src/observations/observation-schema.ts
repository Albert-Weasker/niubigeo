import type {
  Citation,
  BrandQuestionClassification,
  Mention,
  MonitoringPrompt,
  PromptAuditCategory,
  PromptRun,
  PromptRunAnalysis,
  PromptType,
  PromptIntentProfile,
  SearchExecution,
  SourceType,
} from "../core/types.js";
import type { IntentRunAnalysis } from "../intent/intent-schema.js";
import type { IntentName } from "../intent/intent-schema.js";

export type AnalysisBoolean = boolean | "not_applicable" | null;
export type ObservationAnalysisStatus = "completed" | "incomplete" | "failed" | "not_applicable";

export interface ObservationAnalysisResult {
  questionIntents: IntentName[] | null;
  brandMentioned: boolean | null;
  brandCandidate: AnalysisBoolean;
  brandRecommended: AnalysisBoolean;
  entitiesAnalyzed: boolean | null;
  citationsAnalyzed: boolean | null;
}

export interface ObservationEvidenceSummary {
  hasAnswer: boolean;
  targetMentioned: boolean;
  mentionedCompetitors: string[];
  citationCount: number;
  officialCitationCount: number;
}

export interface Observation {
  id: string;
  projectId: string;
  baselineId: string;
  runId: string;
  auditRunId: string;
  promptId: string;
  sampleIndex: number;
  sampleCount: number;
  promptText: string;
  promptType: PromptType;
  promptAuditCategory: PromptAuditCategory;
  targetIncluded: boolean;
  brandQuestion?: BrandQuestionClassification | undefined;
  promptIntent?: PromptIntentProfile | undefined;
  keywordIds: string[];
  providerId: string;
  model: string;
  language: string;
  sourceType: SourceType;
  sourceLabel: string;
  webSearchEnabled: boolean;
  search?: SearchExecution | undefined;
  status: PromptRun["status"];
  startedAt: string;
  finishedAt: string;
  answerText?: string | undefined;
  citations: Citation[];
  mentions: Mention[];
  analysis?: PromptRunAnalysis | undefined;
  intentAnalysis?: IntentRunAnalysis | undefined;
  analysisVersion?: string | undefined;
  analysisStatus?: ObservationAnalysisStatus | undefined;
  analysisResult?: ObservationAnalysisResult | undefined;
  analysisError?: string | undefined;
  error?: string | undefined;
  evidence: ObservationEvidenceSummary;
}

export interface ObservationBuildInput {
  projectId: string;
  baselineId: string;
  auditRunId: string;
  runId: string;
  promptRun: PromptRun;
  prompt: MonitoringPrompt;
}
