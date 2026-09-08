import type { AuditPlan, AuditRun, KeywordMode, MonitoringPrompt, ProviderTarget } from "../core/types.js";
import { sha256 } from "../utils/hash.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { MonitoringBaseline } from "./baseline-schema.js";

function sortedStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function promptPayload(prompt: MonitoringPrompt): Record<string, unknown> {
  return {
    type: prompt.type,
    topic: prompt.topic,
    language: prompt.language,
    text: prompt.text,
    enabled: prompt.enabled,
    auditCategory: prompt.auditCategory || "other",
    targetIncluded: Boolean(prompt.targetIncluded),
    keywordIds: sortedStrings(prompt.keywordIds || []),
    keywordClusterId: prompt.keywordClusterId || "",
    keywordIntent: prompt.keywordIntent || "",
    seedSource: prompt.seedSource || "",
    brandQuestion: prompt.brandQuestion || null,
    intentProfile: prompt.intentProfile || null,
  };
}

function providerPayload(target: ProviderTarget): Record<string, unknown> {
  return {
    providerId: target.providerId,
    model: target.model,
    webSearchEnabled: Boolean(target.webSearchEnabled),
    webSearchMode: target.webSearchEnabled ? "provider_native" : target.webSearchMode || "auto",
  };
}

function orderedPrompts(prompts: MonitoringPrompt[]): MonitoringPrompt[] {
  return [...prompts].sort((a, b) => {
    const text = a.text.localeCompare(b.text);
    if (text !== 0) return text;
    const type = a.type.localeCompare(b.type);
    if (type !== 0) return type;
    return a.id.localeCompare(b.id);
  });
}

function orderedProviderTargets(targets: ProviderTarget[]): ProviderTarget[] {
  return [...targets].sort((a, b) => {
    const provider = a.providerId.localeCompare(b.providerId);
    if (provider !== 0) return provider;
    const model = a.model.localeCompare(b.model);
    if (model !== 0) return model;
    return String(Boolean(a.webSearchEnabled)).localeCompare(String(Boolean(b.webSearchEnabled)));
  });
}

function deriveLanguage(prompts: MonitoringPrompt[]): string {
  const languages = sortedStrings([...new Set(prompts.map((prompt) => prompt.language).filter(Boolean))]);
  if (languages.length === 1) return languages[0] || "unknown";
  if (languages.length > 1) return "mixed";
  return "unknown";
}

function entityPayload(entity: MonitoringProject["target"]): Record<string, unknown> {
  return {
    type: entity.type,
    name: entity.name,
    domain: entity.domain,
    aliases: sortedStrings(entity.aliases),
    githubRepo: entity.githubRepo || "",
  };
}

export function projectEntityScopeHash(project: MonitoringProject): string {
  return sha256(
    JSON.stringify({
      target: entityPayload(project.target),
      competitors: project.competitors
        .map(entityPayload)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    }),
  );
}

export function baselineComparableKey(input: {
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  promptSetVersion: string;
  analysisRulesVersion: string;
  runCountPerPrompt: number;
  entityScopeHash: string;
}): string {
  return sha256(
    JSON.stringify({
      language: input.language,
      promptSetVersion: input.promptSetVersion,
      analysisRulesVersion: input.analysisRulesVersion,
      runCountPerPrompt: input.runCountPerPrompt,
      entityScopeHash: input.entityScopeHash,
      prompts: orderedPrompts(input.prompts).map(promptPayload),
      providerTargets: orderedProviderTargets(input.providerTargets).map(providerPayload),
    }),
  );
}

function baselineId(projectId: string, comparableKey: string, fallback: string): string {
  const source = comparableKey || fallback;
  return `baseline-${sha256(`${projectId}:${source}`).slice(0, 16)}`;
}

function promptSetHash(prompts: MonitoringPrompt[], providerTargets: ProviderTarget[], language: string): string {
  return sha256(
    JSON.stringify({
      language,
      prompts: orderedPrompts(prompts).map(promptPayload),
      providerTargets: orderedProviderTargets(providerTargets).map(providerPayload),
    }),
  ).slice(0, 12);
}

function trendEligibility(input: {
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  promptSetVersion?: string | undefined;
  analysisRulesVersion?: string | undefined;
  runCountPerPrompt?: number | undefined;
}): { eligible: boolean; reason?: string | undefined } {
  if (input.prompts.length === 0) return { eligible: false, reason: "No prompt set was recorded." };
  if (input.prompts.some((prompt) => prompt.enabled && prompt.intentProfile?.status !== "completed")) {
    return { eligible: false, reason: "One or more monitoring questions do not have a fixed AI intent profile." };
  }
  if (input.providerTargets.length === 0) return { eligible: false, reason: "No provider/model set was recorded." };
  if (!input.language || input.language === "unknown" || input.language === "mixed") return { eligible: false, reason: "Prompt language was not recorded consistently." };
  if (!input.promptSetVersion) return { eligible: false, reason: "Prompt set version is missing." };
  if (!input.analysisRulesVersion) return { eligible: false, reason: "Analysis rules version is missing." };
  if (!input.runCountPerPrompt) return { eligible: false, reason: "Run count per prompt is missing." };
  return { eligible: true };
}

function baseBaseline(input: {
  project: MonitoringProject;
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  promptSetHash?: string | undefined;
  promptSetVersion?: string | undefined;
  analysisRulesVersion?: string | undefined;
  runCountPerPrompt?: number | undefined;
  autoDiscover: boolean;
  keywordMode?: KeywordMode | undefined;
  sourcePlanId?: string | undefined;
  sourceAuditId?: string | undefined;
  sourceBaselineId?: string | undefined;
  source: MonitoringBaseline["source"];
  createdAt: string;
}): MonitoringBaseline {
  const promptSetVersion = input.promptSetVersion || "";
  const analysisRulesVersion = input.analysisRulesVersion || "";
  const runCountPerPrompt = input.runCountPerPrompt || 0;
  const entityScopeHash = projectEntityScopeHash(input.project);
  const comparableKey = baselineComparableKey({
    prompts: input.prompts,
    providerTargets: input.providerTargets,
    language: input.language,
    promptSetVersion,
    analysisRulesVersion,
    runCountPerPrompt,
    entityScopeHash,
  });
  const eligibility = trendEligibility({
    prompts: input.prompts,
    providerTargets: input.providerTargets,
    language: input.language,
    promptSetVersion,
    analysisRulesVersion,
    runCountPerPrompt,
  });
  const id = baselineId(input.project.id, comparableKey, input.sourceAuditId || input.sourcePlanId || input.createdAt);
  const baseline: MonitoringBaseline = {
    id,
    projectId: input.project.id,
    name: eligibility.eligible ? "Monitoring baseline" : "Imported historical snapshot",
    prompts: orderedPrompts(input.prompts),
    providerTargets: orderedProviderTargets(input.providerTargets),
    language: input.language,
    promptSetHash: input.promptSetHash || promptSetHash(input.prompts, input.providerTargets, input.language),
    promptSetVersion,
    analysisRulesVersion,
    runCountPerPrompt,
    entityScopeHash,
    comparableKey,
    trendEligible: eligibility.eligible,
    status: eligibility.eligible ? "active" : "legacy_snapshot",
    source: eligibility.eligible ? input.source : "legacy_snapshot",
    autoDiscover: input.autoDiscover,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  if (input.keywordMode) baseline.keywordMode = input.keywordMode;
  if (input.sourcePlanId) baseline.sourcePlanId = input.sourcePlanId;
  if (input.sourceAuditId) baseline.sourceAuditId = input.sourceAuditId;
  if (input.sourceBaselineId) baseline.sourceBaselineId = input.sourceBaselineId;
  if (!eligibility.eligible && eligibility.reason) baseline.nonComparableReason = eligibility.reason;
  return baseline;
}

export class BaselineBuilder {
  fromAuditPlan(project: MonitoringProject, plan: AuditPlan): MonitoringBaseline {
    return baseBaseline({
      project,
      prompts: plan.prompts,
      providerTargets: plan.providerTargets,
      language: plan.language,
      promptSetHash: plan.promptSetHash,
      promptSetVersion: plan.promptSetVersion,
      analysisRulesVersion: plan.analysisRulesVersion,
      runCountPerPrompt: plan.runCountPerPrompt,
      autoDiscover: plan.autoDiscover,
      keywordMode: plan.keywordMode,
      sourcePlanId: plan.id,
      source: "audit_plan",
      createdAt: plan.plannedAt,
    });
  }

  fromAuditRun(project: MonitoringProject, audit: AuditRun): MonitoringBaseline {
    const language = deriveLanguage(audit.prompts);
    return baseBaseline({
      project,
      prompts: audit.prompts,
      providerTargets: audit.providerTargets,
      language,
      promptSetHash: audit.promptSetHash,
      promptSetVersion: audit.promptSetVersion,
      analysisRulesVersion: audit.analysisRulesVersion,
      runCountPerPrompt: audit.runCountPerPrompt,
      autoDiscover: Boolean(audit.discoveryEvidence),
      sourceAuditId: audit.id,
      source: "audit_run",
      createdAt: audit.startedAt,
    });
  }

  derive(
    project: MonitoringProject,
    source: MonitoringBaseline,
    changes: {
      prompts?: MonitoringPrompt[] | undefined;
      providerTargets?: ProviderTarget[] | undefined;
      language?: string | undefined;
      runCountPerPrompt?: number | undefined;
    },
  ): MonitoringBaseline {
    const prompts = changes.prompts || source.prompts;
    const providerTargets = changes.providerTargets || source.providerTargets;
    const language = changes.language || source.language;
    return baseBaseline({
      project,
      prompts,
      providerTargets,
      language,
      promptSetVersion: source.promptSetVersion,
      analysisRulesVersion: source.analysisRulesVersion,
      runCountPerPrompt: changes.runCountPerPrompt || source.runCountPerPrompt,
      autoDiscover: source.autoDiscover,
      keywordMode: source.keywordMode,
      sourceBaselineId: source.id,
      source: "audit_plan",
      createdAt: new Date().toISOString(),
    });
  }
}
