import type { AuditMetrics, AuditRun, GeoGapAnalysis } from "../core/types.js";

export interface AuditReportModel {
  audit: AuditRun;
  metrics: AuditMetrics;
  gaps: GeoGapAnalysis;
  generatedAt: string;
}

export class ReportModelBuilder {
  build(audit: AuditRun, metrics: AuditMetrics, gaps: GeoGapAnalysis): AuditReportModel {
    return {
      audit,
      metrics,
      gaps,
      generatedAt: new Date().toISOString(),
    };
  }
}
