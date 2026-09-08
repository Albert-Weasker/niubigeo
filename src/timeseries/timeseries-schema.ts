import type { MonitoringMetricId, MonitoringMetricResult } from "../metrics/monitoring-metrics.js";

export type TrendRange = "24h" | "7d" | "30d" | "90d" | "all";
export type TrendEligibilityState = "ready" | "first_observation" | "same_day_only" | "partial_run" | "baseline_changed" | "no_data";

export interface TrendFilter {
  range: TrendRange;
  timezone: string;
  now?: string | undefined;
  model?: string | undefined;
  searchUsed?: boolean | undefined;
}

export interface MetricSeriesPoint {
  runId: string;
  baselineId: string;
  bucket: string;
  observedAt: string;
  result: MonitoringMetricResult;
  previousComparableRunId?: string | undefined;
  change?: {
    comparable: boolean;
    delta: number | null;
  } | undefined;
  evidenceChange?: MetricEvidenceChange | undefined;
}

export interface MetricEvidencePair {
  currentObservationId: string;
  previousObservationId: string;
}

export interface MetricEvidenceChange {
  comparable: boolean;
  reasonKey: string;
  addedCurrentObservationIds: string[];
  persistedObservationPairs: MetricEvidencePair[];
  removedPreviousObservationIds: string[];
}

export interface MetricSeries {
  metricId: MonitoringMetricId;
  baselineId: string;
  state: TrendEligibilityState;
  explanationKey: string;
  points: MetricSeriesPoint[];
  excludedRunIds: string[];
}

export interface BrandComparisonLine {
  key: string;
  name: string;
  canonicalUrl?: string | undefined;
  points: MetricSeriesPoint[];
}

export interface BrandComparisonSeries {
  metricId: MonitoringMetricId;
  baselineId: string;
  state: TrendEligibilityState;
  explanationKey: string;
  brands: BrandComparisonLine[];
  excludedRunIds: string[];
}
