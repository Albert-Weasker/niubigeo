import type { AuditMetrics, AuditRun, GapFinding, GapSeverity, GeoGapAnalysis, PromptRun } from "../core/types.js";

function findingKey(finding: GapFinding): string {
  return `${finding.area}:${finding.severity}:${finding.title}:${finding.evidence}`;
}

function runLabel(run: PromptRun): string {
  return `${run.providerId} / ${run.model} / ${run.prompt.id}`;
}

function taskRequirement(run: PromptRun, taskId: string): string {
  return run.intentAnalysis?.tasks.find((task) => task.id === taskId)?.requirement || taskId;
}

function incompleteTaskFinding(run: PromptRun): GapFinding | null {
  const analysis = run.intentAnalysis;
  if (!analysis || analysis.status !== "completed") return null;
  const incomplete = analysis.taskResults.filter((task) => task.status !== "completed");
  if (incomplete.length === 0) return null;
  const severity: GapSeverity = incomplete.some((task) => task.status === "missing") ? "warning" : "info";
  const evidence = incomplete
    .map((task) => `${taskRequirement(run, task.taskId)}: ${task.status}. ${task.explanation}`)
    .join(" ");
  return {
    area: "prompt",
    severity,
    title: "The AI answer did not fully satisfy every requested task",
    evidence: `${runLabel(run)}. ${evidence}`,
    recommendation: "Open this answer and its cited sources to review the incomplete requirements.",
  };
}

export class GeoGapAnalyzer {
  analyze(audit: AuditRun, metrics: AuditMetrics): GeoGapAnalysis {
    void metrics;
    const findings: GapFinding[] = [];
    const seen = new Set<string>();
    const push = (finding: GapFinding | null) => {
      if (!finding) return;
      const key = findingKey(finding);
      if (seen.has(key)) return;
      seen.add(key);
      findings.push(finding);
    };

    for (const run of audit.runs) {
      if (run.status === "failed") {
        push({
          area: "provider",
          severity: "critical",
          title: "A planned provider observation failed",
          evidence: `${runLabel(run)}. ${run.error || "The provider did not return a completed answer."}`,
          recommendation: "Review the provider response and rerun this observation before comparing periods.",
        });
        continue;
      }

      if (!run.result?.text) {
        push({
          area: "provider",
          severity: "critical",
          title: "A completed observation has no usable answer",
          evidence: `${runLabel(run)} has no answer text.`,
          recommendation: "Review the saved provider result before using this observation.",
        });
        continue;
      }

      if (!run.intentAnalysis || run.intentAnalysis.status !== "completed") {
        push({
          area: "prompt",
          severity: "warning",
          title: "A completed answer has no verified intent assessment",
          evidence: `${runLabel(run)}. ${run.intentAnalysis?.error || "No completed intent analysis was stored."}`,
          recommendation: "Run the AI intent assessment before presenting this answer as a structured result.",
        });
        continue;
      }

      push(incompleteTaskFinding(run));
      if (run.intentAnalysis.promptIntent.requiresSources && (run.analysis?.citations || run.result.citations).length === 0) {
        push({
          area: "source",
          severity: "warning",
          title: "The question required sources but the provider returned none",
          evidence: `${runLabel(run)} was assessed as requiring sources and has no provider citation.`,
          recommendation: "Treat source-dependent conclusions from this answer as unverified.",
        });
      }
    }

    const order: Record<GapSeverity, number> = { critical: 0, warning: 1, info: 2 };
    findings.sort((left, right) => order[left.severity] - order[right.severity] || left.title.localeCompare(right.title));
    if (findings.length === 0) {
      return {
        summary: "Every completed provider observation has a verified intent assessment and no unresolved answer requirement.",
        findings,
      };
    }
    const unresolved = findings.filter((finding) => finding.severity !== "info").length;
    return {
      summary: `${findings.length} evidence issue(s) were found; ${unresolved} require review before period comparison.`,
      findings,
    };
  }
}
