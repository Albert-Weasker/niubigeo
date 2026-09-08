export type MonitoringScheduleKind = "manual" | "daily" | "weekly" | "monthly" | "cron";

export interface MonitoringSchedule {
  kind: MonitoringScheduleKind;
  timezone: string;
  cron?: string | undefined;
  dayOfWeek?: number | undefined;
  dayOfMonth?: number | undefined;
  hour?: number | undefined;
  minute?: number | undefined;
}

export type MonitoringNotificationCondition =
  | "brand_disappeared"
  | "competitor_appeared"
  | "official_citation_added"
  | "recommendation_changed"
  | "run_completed"
  | "run_failed";

export type MonitoringNotificationChannelType = "email" | "webhook" | "slack" | "discord" | "wecom" | "lark";

export interface MonitoringNotificationChannel {
  id: string;
  type: MonitoringNotificationChannelType;
  target: string;
  enabled: boolean;
}

export interface MonitoringNotificationPolicy {
  conditions: MonitoringNotificationCondition[];
  channels: MonitoringNotificationChannel[];
}

export interface MonitoringTask {
  id: string;
  name: string;
  projectId: string;
  baselineId: string;
  schedule: MonitoringSchedule;
  notifications: MonitoringNotificationPolicy;
  enabled: boolean;
  lastRunId?: string | undefined;
  lastAttemptAt?: string | undefined;
  lastError?: string | undefined;
  lastNotificationError?: string | undefined;
  nextRunAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringTaskLease {
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
}

export type ProjectRunStatus = "running" | "completed" | "partial" | "failed";
export type RunAnalysisStatus = "pending" | "completed" | "incomplete" | "failed" | "not_applicable" | "historical";

export interface RunAnalysisCoverage {
  version: string | null;
  status: RunAnalysisStatus;
  observationCount: number;
  answeredObservationCount: number;
  completedAnalysisCount: number;
  incompleteAnalysisCount: number;
  failedAnalysisCount: number;
  intentCounts: Record<string, number>;
  questionIntentProfiledCount: number;
  candidateApplicableCount: number;
  candidateNotApplicableCount: number;
  recommendationApplicableCount: number;
  recommendationNotApplicableCount: number;
  brandMentionJudgedCount: number;
  entityExtractionCompletedCount: number;
  citationParsingCompletedCount: number;
  criticalNullCount: number;
  criticalNullObservationIds: string[];
  incompleteObservationIds: string[];
}

export interface ProjectRunRecord {
  id: string;
  projectId: string;
  baselineId: string;
  auditRunId?: string | undefined;
  status: ProjectRunStatus;
  plannedObservationCount: number;
  completedObservationCount: number;
  failedObservationCount: number;
  comparableKey: string;
  trendEligible: boolean;
  analysisVersion?: string | undefined;
  analysisStatus?: RunAnalysisStatus | undefined;
  analysisCompletedObservationCount?: number | undefined;
  analysisIncompleteObservationCount?: number | undefined;
  analysisCoverage?: RunAnalysisCoverage | undefined;
  startedAt: string;
  finishedAt?: string | undefined;
  error?: string | undefined;
  reportHtmlPath?: string | undefined;
  reportMdPath?: string | undefined;
  reportJsonPath?: string | undefined;
  createdAt: string;
}
