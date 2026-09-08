import type { BaselineComparison, MonitoringBaseline } from "./baseline-schema.js";

function fieldDiffs(a: MonitoringBaseline, b: MonitoringBaseline): string[] {
  const diffs: string[] = [];
  if (a.projectId !== b.projectId) diffs.push("project");
  if (a.language !== b.language) diffs.push("language");
  if (a.promptSetHash !== b.promptSetHash) diffs.push("promptSetHash");
  if (a.promptSetVersion !== b.promptSetVersion) diffs.push("promptSetVersion");
  if (a.analysisRulesVersion !== b.analysisRulesVersion) diffs.push("analysisRulesVersion");
  if (a.runCountPerPrompt !== b.runCountPerPrompt) diffs.push("runCountPerPrompt");
  if (a.entityScopeHash !== b.entityScopeHash) diffs.push("entityScopeHash");
  if (a.comparableKey !== b.comparableKey) diffs.push("comparableKey");
  return diffs;
}

export class BaselineComparator {
  compare(a: MonitoringBaseline, b: MonitoringBaseline): BaselineComparison {
    if (!a.trendEligible || !b.trendEligible) {
      return {
        comparable: false,
        reason: "At least one baseline is a historical snapshot or lacks enough configuration to trend.",
        differingFields: fieldDiffs(a, b),
      };
    }
    const differingFields = fieldDiffs(a, b);
    if (differingFields.length > 0) {
      return {
        comparable: false,
        reason: "Monitoring conditions differ, so the runs should not be compared as a trend.",
        differingFields,
      };
    }
    return {
      comparable: true,
      reason: "Baselines have the same project and monitoring conditions.",
      differingFields: [],
    };
  }

  canCompare(a: MonitoringBaseline, b: MonitoringBaseline): boolean {
    return this.compare(a, b).comparable;
  }
}
