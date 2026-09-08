import type { EntityRelationshipType, IntentDisplayMode, IntentName, TaskStatus } from "../intent/intent-schema.js";
import type { EvidenceBackedChangeSet } from "../changes/change-schema.js";
import type { EntityRegistry } from "../entities/entity-schema.js";
import type { MonitoringMetricResult } from "../metrics/monitoring-metrics.js";
import type { MetricSeries } from "../timeseries/timeseries-schema.js";

export interface CountFraction {
  numerator: number;
  denominator: number;
  value: number | null;
}

export interface ObservationAggregate {
  total: number;
  completed: number;
  failed: number;
  targetMentioned: CountFraction;
  targetRecommended: CountFraction;
  targetOfficiallyCited: CountFraction;
}

export interface TrendPoint extends ObservationAggregate {
  runId: string;
  finishedAt: string;
}

export interface BaselineTrend {
  baselineId: string;
  comparableKey: string;
  comparable: boolean;
  reason: string;
  points: TrendPoint[];
}

export interface ConfirmedCompetitorInsight {
  entityId: string;
  name: string;
  domain: string;
  observationCount: number;
  recommendationCount: number;
  firstPositionCount: number;
  promptTexts: string[];
  sourceUrls: string[];
  providerModels: string[];
}

export interface RelatedEntityInsight {
  name: string;
  relationship: EntityRelationshipType;
  confidence: "low" | "medium" | "high";
  observationIds: string[];
  evidenceQuotes: string[];
  sourceUrls: string[];
}

export interface CompetitorLandscape {
  confirmed: ConfirmedCompetitorInsight[];
  relatedCandidates: RelatedEntityInsight[];
}

export interface CitationSourceInsight {
  url: string;
  domain: string;
  title?: string | undefined;
  citationType: "target" | "competitor" | "third_party" | "unknown";
  observationCount: number;
  observationIds: string[];
  promptTexts: string[];
  providerModels: string[];
}

export interface CitationLandscape {
  targetSources: CitationSourceInsight[];
  targetDomains: CitationDomainInsight[];
  competitorSources: CitationSourceInsight[];
  thirdPartySources: CitationSourceInsight[];
  unknownSources: CitationSourceInsight[];
}

export interface CitationDomainInsight {
  domain: string;
  observationCount: number;
  observationIds: string[];
  pages: CitationSourceInsight[];
}

export interface IntentTaskStatusCount {
  status: TaskStatus;
  count: number;
}

export interface IntentOutcome {
  analyzedObservationCount: number;
  failedAnalysisCount: number;
  primaryIntents: Array<{ intent: IntentName; count: number }>;
  displayModes: Array<{ mode: IntentDisplayMode; count: number }>;
  taskStatuses: IntentTaskStatusCount[];
  missingRequirements: Array<{ requirement: string; count: number; observationIds: string[] }>;
}

export interface ProjectChangeSet {
  baselineId: string;
  comparable: boolean;
  reason: string;
  currentRunId?: string | undefined;
  previousRunId?: string | undefined;
  prompts: {
    newlyVisible: string[];
    disappeared: string[];
    persistentlyVisible: string[];
    persistentlyAbsent: string[];
  };
  competitors: {
    newlyObserved: string[];
    disappeared: string[];
  };
  citations: {
    newlyObserved: string[];
    disappeared: string[];
  };
}

export interface ProjectInsight {
  projectId: string;
  generatedAt: string;
  latestRunId?: string | undefined;
  latestRun?: ObservationAggregate | undefined;
  cumulative: ObservationAggregate;
  trends: BaselineTrend[];
  changes: ProjectChangeSet[];
  competitors: CompetitorLandscape;
  citations: CitationLandscape;
  intentOutcomes: IntentOutcome;
  latestMetrics: MonitoringMetricResult[];
  metricSeries: MetricSeries[];
  evidenceChanges: EvidenceBackedChangeSet[];
  entityRegistry: EntityRegistry;
}
