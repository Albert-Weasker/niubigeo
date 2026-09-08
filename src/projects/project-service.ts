import type { AuditPlan, AuditRun, Entity, ReportBundle } from "../core/types.js";
import { BaselineBuilder } from "../baselines/baseline-builder.js";
import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import { ObservationBuilder } from "../observations/observation-builder.js";
import type { Observation } from "../observations/observation-schema.js";
import { buildRunAnalysisCoverage } from "../observations/analysis-qualification.js";
import { normalizeDomain, slugify } from "../utils/domain.js";
import { sha256 } from "../utils/hash.js";
import type { MonitoringProject } from "./project-schema.js";

function projectIdFromTarget(target: Entity): string {
  const key = normalizeDomain(target.domain) || target.name.trim().toLowerCase();
  const slug = slugify(key);
  return slug ? `project-${slug}` : `project-${sha256(key).slice(0, 12)}`;
}

function assertExistingProjectMatchesTarget(existing: MonitoringProject, target: Entity): void {
  const incomingDomain = normalizeDomain(target.domain);
  const existingDomain = normalizeDomain(existing.domain);
  if (!incomingDomain || incomingDomain !== existingDomain || existing.id !== projectIdFromTarget(target)) {
    throw new Error("The audit target does not belong to the existing project domain.");
  }
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const alias = value.trim();
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

function competitorKey(entity: Entity): string {
  const domain = normalizeDomain(entity.domain);
  if (domain) return `domain:${domain}`;
  return `name:${entity.name.trim().toLowerCase()}`;
}

function mergeCompetitors(existing: Entity[], incoming: Entity[]): Entity[] {
  const merged = [...existing];
  const seen = new Set(existing.map(competitorKey));
  for (const competitor of incoming) {
    const key = competitorKey(competitor);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(competitor);
  }
  return merged;
}

function runStatus(completed: number, failed: number): ProjectRunRecord["status"] {
  if (completed > 0 && failed === 0) return "completed";
  if (completed > 0 && failed > 0) return "partial";
  return "failed";
}

function plannedObservationCount(audit: AuditRun): number {
  const enabledPrompts = audit.prompts.filter((prompt) => prompt.enabled).length;
  const planned = enabledPrompts * audit.providerTargets.length * (audit.runCountPerPrompt || 1);
  return planned || audit.runs.length;
}

export interface MaterializedAuditRun {
  project: MonitoringProject;
  baseline: MonitoringBaseline;
  run: ProjectRunRecord;
  observations: Observation[];
}

export class ProjectService {
  private readonly baselineBuilder = new BaselineBuilder();
  private readonly observationBuilder = new ObservationBuilder();

  create(input: {
    target: Entity;
    competitors?: Entity[] | undefined;
    defaultLanguage: string;
    now?: string | undefined;
  }): MonitoringProject {
    const now = input.now || new Date().toISOString();
    return {
      id: projectIdFromTarget(input.target),
      name: input.target.name,
      domain: normalizeDomain(input.target.domain),
      aliases: uniqueAliases(input.target.aliases),
      target: input.target,
      competitors: input.competitors || [],
      defaultLanguage: input.defaultLanguage,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  projectFromAuditPlan(plan: AuditPlan, existing?: MonitoringProject | undefined): MonitoringProject {
    const plannedProject = this.create({
      target: plan.target,
      competitors: plan.competitors,
      defaultLanguage: plan.language,
      now: plan.plannedAt,
    });
    if (!existing) return plannedProject;
    assertExistingProjectMatchesTarget(existing, plan.target);
    return {
      ...existing,
      name: plan.target.name || existing.name,
      domain: normalizeDomain(plan.target.domain) || existing.domain,
      aliases: uniqueAliases([...existing.aliases, ...plan.target.aliases]),
      target: plan.target,
      competitors: mergeCompetitors(existing.competitors, plan.competitors),
      defaultLanguage: plan.language || existing.defaultLanguage,
      updatedAt: plan.plannedAt,
    };
  }

  projectFromAuditRun(audit: AuditRun, existing?: MonitoringProject | undefined): MonitoringProject {
    const now = audit.finishedAt || new Date().toISOString();
    if (existing) assertExistingProjectMatchesTarget(existing, audit.target);
    const project: MonitoringProject = existing
      ? {
          ...existing,
          name: audit.target.name || existing.name,
          domain: normalizeDomain(audit.target.domain) || existing.domain,
          aliases: uniqueAliases([...existing.aliases, ...audit.target.aliases]),
          target: audit.target,
          competitors: mergeCompetitors(existing.competitors, audit.competitors),
          updatedAt: now,
        }
      : {
          id: projectIdFromTarget(audit.target),
          name: audit.target.name,
          domain: normalizeDomain(audit.target.domain),
          aliases: uniqueAliases(audit.target.aliases),
          target: audit.target,
          competitors: audit.competitors,
          defaultLanguage: audit.prompts[0]?.language || "unknown",
          status: "active",
          createdAt: audit.startedAt,
          updatedAt: now,
        };
    if (!project.defaultLanguage || project.defaultLanguage === "unknown") {
      project.defaultLanguage = audit.prompts[0]?.language || "unknown";
    }
    return project;
  }

  materializeAuditRun(input: {
    audit: AuditRun;
    existingProject?: MonitoringProject | undefined;
    existingBaseline?: MonitoringBaseline | undefined;
    projectRunId?: string | undefined;
    paths?: ReportBundle | undefined;
  }): MaterializedAuditRun {
    const project = this.projectFromAuditRun(input.audit, input.existingProject);
    const baseline = input.existingBaseline || this.baselineBuilder.fromAuditRun(project, input.audit);
    if (baseline.projectId !== project.id) throw new Error("Baseline does not belong to the audit project.");
    const completed = input.audit.runs.filter((run) => run.status === "completed").length;
    const failed = input.audit.runs.filter((run) => run.status === "failed").length;
    const observations = this.observationBuilder.fromAuditRun({
      projectId: project.id,
      baselineId: baseline.id,
      runId: input.projectRunId || `run-${input.audit.id}`,
      audit: input.audit,
    });
    const coverage = buildRunAnalysisCoverage(observations);
    const run: ProjectRunRecord = {
      id: input.projectRunId || `run-${input.audit.id}`,
      projectId: project.id,
      baselineId: baseline.id,
      auditRunId: input.audit.id,
      status: runStatus(completed, failed),
      plannedObservationCount: plannedObservationCount(input.audit),
      completedObservationCount: completed,
      failedObservationCount: failed,
      comparableKey: baseline.comparableKey,
      trendEligible: baseline.trendEligible,
      analysisVersion: coverage.version || undefined,
      analysisStatus: coverage.status,
      analysisCompletedObservationCount: coverage.completedAnalysisCount,
      analysisIncompleteObservationCount: coverage.incompleteAnalysisCount,
      analysisCoverage: coverage,
      startedAt: input.audit.startedAt,
      finishedAt: input.audit.finishedAt,
      createdAt: input.audit.finishedAt,
    };
    if (input.paths?.reportHtml) run.reportHtmlPath = input.paths.reportHtml;
    if (input.paths?.reportMd) run.reportMdPath = input.paths.reportMd;
    if (input.paths?.reportJson) run.reportJsonPath = input.paths.reportJson;
    return { project, baseline, run, observations };
  }
}
