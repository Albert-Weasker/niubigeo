import type {
  AuditMetrics,
  AuditPlan,
  AuditRun,
  DiscoveredCompetitor,
  Entity,
  GeoGapAnalysis,
  MonitoringPrompt,
  ProviderTarget,
  PromptRun,
  ReportBundle,
} from "../core/types.js";
import { resolveProviderKey, runsDir } from "../config/env.js";
import { ProviderCatalog } from "../providers/catalog.js";
import { runProviderWithRetry } from "../providers/provider-retry.js";
import { buildExecutionPrompt } from "../prompts/execution-prompt.js";
import { applyIntentSemantics, ResponseAnalyzer } from "../analyzer/response-analyzer.js";
import { CompetitorDiscovery } from "../analyzer/competitor-discovery.js";
import { MetricsEngine } from "../metrics/metrics-engine.js";
import { GeoGapAnalyzer } from "../insights/gap-analyzer.js";
import { FileStore } from "../store/file-store.js";
import { ReportBuilder } from "../report/report-builder.js";
import { ReportModelBuilder } from "../report/report-model.js";
import { validateReport } from "../report/report-quality.js";
import { entityFromInput, normalizeDomain, slugify } from "../utils/domain.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "../core/version.js";
import { IntentResultPipeline } from "../intent/intent-result-pipeline.js";
import { analysisModelFor } from "../providers/provider-role.js";
import type { AuditModelProgress, AuditProgressListener, AuditProgressSnapshot } from "./audit-progress.js";
import { ProviderCallLedger } from "../telemetry/provider-call-ledger.js";

export interface AuditRunnerInput {
  confirmedPlan: AuditPlan;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  runsRoot?: string | undefined;
  onProgress?: AuditProgressListener | undefined;
}

function progressModels(tasks: ProviderRunTask[]): AuditModelProgress[] {
  const grouped = new Map<string, AuditModelProgress>();
  for (const task of tasks) {
    const key = `${task.providerTarget.providerId}::${task.providerTarget.model}`;
    const current = grouped.get(key);
    if (current) current.planned += 1;
    else {
      grouped.set(key, {
        providerId: task.providerTarget.providerId,
        model: task.providerTarget.model,
        planned: 1,
        completed: 0,
        failed: 0,
      });
    }
  }
  return [...grouped.values()];
}

async function emitProgress(listener: AuditProgressListener | undefined, progress: AuditProgressSnapshot): Promise<void> {
  if (listener) await listener(structuredClone(progress));
}

export interface AuditRunnerOutput {
  audit: AuditRun;
  metrics: AuditMetrics;
  gaps: GeoGapAnalysis;
  paths: ReportBundle;
}

export interface AuditRunnerDependencies {
  catalog?: Pick<ProviderCatalog, "get" | "validate"> | undefined;
  competitorDiscovery?: Pick<CompetitorDiscovery, "discover"> | undefined;
  intentResultPipeline?: Pick<IntentResultPipeline, "analyze"> | undefined;
}

function timestampId(target: Entity): string {
  let safeTimestamp = "";
  for (const char of new Date().toISOString()) {
    safeTimestamp += char === ":" || char === "." ? "-" : char;
  }
  return `${safeTimestamp}-${slugify(target.name || target.domain)}`;
}

function runId(prompt: MonitoringPrompt, target: ProviderTarget, sampleIndex: number, sampleCount: number): string {
  const base = `${target.providerId}::${target.model}::${prompt.id}`;
  return sampleCount > 1 ? `${base}::sample-${sampleIndex}` : base;
}

function profileTargetScore(target: ProviderTarget): number {
  return target.webSearchEnabled ? 2 : 1;
}

function selectProfileTarget(targets: ProviderTarget[]): ProviderTarget {
  const sorted = [...targets].sort((a, b) => profileTargetScore(b) - profileTargetScore(a));
  const selected = sorted[0];
  if (!selected) throw new Error("At least one provider target is required.");
  return selected;
}

function auditConcurrency(): number {
  const configured = Number(process.env.AUDIT_CONCURRENCY || 5);
  if (!Number.isFinite(configured) || configured <= 0) return 5;
  return Math.max(1, Math.min(Math.floor(configured), 8));
}

async function mapLimited<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), Math.max(1, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await mapper(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface ProviderRunTask {
  prompt: MonitoringPrompt;
  providerTarget: ProviderTarget;
  sampleIndex: number;
  sampleCount: number;
}

export function buildProviderRunTasks(
  prompts: MonitoringPrompt[],
  providerTargets: ProviderTarget[],
  sampleCount: number,
): ProviderRunTask[] {
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) throw new Error("Run count per prompt must be a positive integer.");
  return prompts
    .filter((item) => item.enabled)
    .flatMap((prompt) =>
      providerTargets.flatMap((providerTarget) =>
        Array.from({ length: sampleCount }, (_, index) => ({
          prompt,
          providerTarget,
          sampleIndex: index + 1,
          sampleCount,
        })),
      ),
    );
}

function competitorKey(entity: Entity): string {
  const domain = normalizeDomain(entity.domain);
  if (domain) return `domain:${domain}`;
  return `name:${entity.name.trim().toLowerCase()}`;
}

function competitorIsUsable(item: DiscoveredCompetitor): boolean {
  const relationship = item.relationship || "unknown";
  return relationship === "direct_competitor";
}

function mergeDiscoveredCompetitors(input: { target: Entity; existing: Entity[]; discovered: DiscoveredCompetitor[] }): Entity[] {
  const merged = [...input.existing];
  const seen = new Set(merged.map((competitor) => competitorKey(competitor)));
  const targetDomain = normalizeDomain(input.target.domain);
  const targetName = input.target.name.trim().toLowerCase();

  for (const item of input.discovered) {
    if (!competitorIsUsable(item)) continue;
    const domain = normalizeDomain(item.domain);
    const name = item.name.trim();
    if (!domain || !name) continue;
    if (domain === targetDomain || name.toLowerCase() === targetName) continue;
    const competitor = entityFromInput({ type: "competitor", domain, name });
    const key = competitorKey(competitor);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(competitor);
  }

  return merged;
}

export class AuditRunner {
  private readonly catalog: Pick<ProviderCatalog, "get" | "validate">;
  private readonly analyzer = new ResponseAnalyzer();
  private readonly metrics = new MetricsEngine();
  private readonly gaps = new GeoGapAnalyzer();
  private readonly competitorDiscovery: Pick<CompetitorDiscovery, "discover">;
  private readonly reportModelBuilder = new ReportModelBuilder();
  private readonly reportBuilder = new ReportBuilder();
  private readonly intentResultPipeline: Pick<IntentResultPipeline, "analyze">;

  constructor(dependencies: AuditRunnerDependencies = {}) {
    this.catalog = dependencies.catalog || new ProviderCatalog();
    this.competitorDiscovery = dependencies.competitorDiscovery || new CompetitorDiscovery();
    this.intentResultPipeline = dependencies.intentResultPipeline || new IntentResultPipeline();
  }

  async run(input: AuditRunnerInput): Promise<AuditRunnerOutput> {
    const providerTargets = input.confirmedPlan.providerTargets;
    if (providerTargets.length === 0) throw new Error("At least one provider target is required.");
    for (const target of providerTargets) this.catalog.validate(target.providerId, target.model);

    const auditId = timestampId(input.confirmedPlan.target);
    const store = new FileStore(input.runsRoot || runsDir());
    const startedAt = new Date().toISOString();
    const callLedger = new ProviderCallLedger();
    const projectId = `project-${slugify(normalizeDomain(input.confirmedPlan.target.domain))}`;

    const profileTarget = selectProfileTarget(providerTargets);
    const profileProvider = this.catalog.get(profileTarget.providerId);
    const profileApiKey = resolveProviderKey(profileTarget.providerId);
    const profileAnalysisModel = analysisModelFor(profileProvider, profileTarget.model);
    let effectiveTarget = input.confirmedPlan.target;
    let effectiveCompetitors = input.confirmedPlan.competitors;
    const domainProfile = input.confirmedPlan.domainProfile;
    const discoveryEvidence = input.confirmedPlan.discoveryEvidence;
    const siteEvidence = input.confirmedPlan.siteEvidence;
    const keywords = input.confirmedPlan.keywords || [];
    const keywordClusters = input.confirmedPlan.keywordClusters || [];
    const keywordRelevance = input.confirmedPlan.keywordRelevance || [];
    const keywordAnalysis = input.confirmedPlan.keywordAnalysis;
    const promptData = {
      prompts: input.confirmedPlan.prompts,
      evidence: input.confirmedPlan.promptGeneration,
    };

    const sampleCount = input.confirmedPlan?.runCountPerPrompt || 1;
    const runTasks = buildProviderRunTasks(promptData.prompts, providerTargets, sampleCount);
    const progress: AuditProgressSnapshot = {
      stage: "preparing",
      plannedObservationCount: runTasks.length,
      completedObservationCount: 0,
      failedObservationCount: 0,
      models: progressModels(runTasks),
    };
    await emitProgress(input.onProgress, progress);

    const checkpointRuns = new Map<string, PromptRun>();
    let checkpointWrite = Promise.resolve();
    const auditState = (runs: PromptRun[], finishedAt: string): AuditRun => ({
      id: auditId,
      auditPlanId: input.confirmedPlan.id,
      promptSetId: input.confirmedPlan.promptSetId,
      promptSetHash: input.confirmedPlan.promptSetHash,
      promptSetVersion: input.confirmedPlan.promptSetVersion || PROMPT_SET_VERSION,
      analysisRulesVersion: input.confirmedPlan.analysisRulesVersion || ANALYSIS_RULES_VERSION,
      runCountPerPrompt: input.confirmedPlan.runCountPerPrompt || 1,
      submittedDomain: input.confirmedPlan.submittedDomain,
      target: effectiveTarget,
      competitors: effectiveCompetitors,
      prompts: promptData.prompts,
      providerTargets,
      domainProfile,
      discoveryEvidence,
      siteEvidence,
      keywords,
      keywordClusters,
      keywordRelevance,
      keywordAnalysis,
      promptGeneration: promptData.evidence,
      providerCalls: callLedger.snapshot(),
      runs,
      startedAt,
      finishedAt,
    });
    const persistCheckpoint = (run: PromptRun): Promise<void> => {
      checkpointRuns.set(run.id, run);
      checkpointWrite = checkpointWrite.then(async () => {
        const rows = runTasks.flatMap((task) => {
          const value = checkpointRuns.get(runId(task.prompt, task.providerTarget, task.sampleIndex, task.sampleCount));
          return value ? [value] : [];
        });
        await store.saveAuditState(auditState(rows, new Date().toISOString()));
      });
      return checkpointWrite;
    };
    await store.saveAuditState(auditState([], startedAt));

    let runs = await mapLimited(runTasks, auditConcurrency(), async (task) => {
      progress.stage = "calling_providers";
      progress.activeProviderId = task.providerTarget.providerId;
      progress.activeModel = task.providerTarget.model;
      await emitProgress(input.onProgress, progress);
      const run = await this.executeProviderRun({
        task,
        target: effectiveTarget,
        competitors: effectiveCompetitors,
        maxTokens: input.maxTokens ?? 900,
        temperature: input.temperature ?? 0,
        auditId,
        projectId,
        callLedger,
        onProviderAnswer: persistCheckpoint,
      });
      await persistCheckpoint(run);
      const model = progress.models.find(
        (item) => item.providerId === task.providerTarget.providerId && item.model === task.providerTarget.model,
      );
      progress.completedObservationCount += run.status === "completed" ? 1 : 0;
      progress.failedObservationCount += run.status === "failed" ? 1 : 0;
      if (model) {
        model.completed += run.status === "completed" ? 1 : 0;
        model.failed += run.status === "failed" ? 1 : 0;
      }
      await emitProgress(input.onProgress, progress);
      return run;
    });
    await checkpointWrite;

    if (!runs.some((run) => run.status === "completed")) {
      await store.saveAuditState(auditState(runs, new Date().toISOString()));
      const failures = runs.map((run) => `${run.providerId}/${run.model}: ${run.error || "unknown provider error"}`);
      throw new Error(`No provider responses completed.\n${failures.join("\n")}`);
    }

    progress.stage = "building_result";
    progress.activeProviderId = undefined;
    progress.activeModel = undefined;
    await emitProgress(input.onProgress, progress);
    const discoveredCompetitors = await this.discoverCompetitorsFromAnswers({
      target: effectiveTarget,
      existingCompetitors: effectiveCompetitors,
      runs,
      language: input.confirmedPlan.language,
      provider: profileProvider,
      model: profileAnalysisModel,
      apiKey: profileApiKey,
      callLedger,
      callContext: {
        projectId,
        runId: auditId,
      },
    });
    const mergedCompetitors = mergeDiscoveredCompetitors({
      target: effectiveTarget,
      existing: effectiveCompetitors,
      discovered: discoveredCompetitors,
    });
    if (mergedCompetitors.length !== effectiveCompetitors.length) {
      effectiveCompetitors = mergedCompetitors;
      runs = this.reanalyzeRuns(runs, effectiveTarget, effectiveCompetitors);
    }

    const audit = auditState(runs, new Date().toISOString());
    await store.saveAuditState(audit);

    const metrics = this.metrics.compute(runs, { keywords, keywordRelevance });
    const gaps = this.gaps.analyze(audit, metrics);
    const reportModel = this.reportModelBuilder.build(audit, metrics, gaps);
    const markdown = this.reportBuilder.renderMarkdown(reportModel);
    const quality = validateReport(markdown, audit, metrics, gaps);
    if (!quality.ok) await store.saveAuditState({ ...audit, providerCalls: callLedger.snapshot() });
    progress.stage = "saving_result";
    await emitProgress(input.onProgress, progress);
    const paths = await store.saveAudit(audit, metrics, gaps, this.reportBuilder);
    progress.stage = "completed";
    await emitProgress(input.onProgress, progress);
    return { audit, metrics, gaps, paths };
  }

  private async executeProviderRun(input: {
    task: ProviderRunTask;
    target: Entity;
    competitors: Entity[];
    maxTokens: number;
    temperature: number;
    auditId: string;
    projectId: string;
    callLedger: ProviderCallLedger;
    onProviderAnswer: (run: PromptRun) => Promise<void>;
  }): Promise<PromptRun> {
    const { prompt, providerTarget } = input.task;
    const provider = this.catalog.get(providerTarget.providerId);
    const apiKey = resolveProviderKey(providerTarget.providerId);
    const analysisModel = analysisModelFor(provider, providerTarget.model);
    const id = runId(prompt, providerTarget, input.task.sampleIndex, input.task.sampleCount);
    const runStartedAt = new Date().toISOString();
    const executionPrompt = buildExecutionPrompt(prompt, providerTarget.webSearchEnabled ?? false);
    let run: PromptRun = {
      id,
      sampleIndex: input.task.sampleIndex,
      sampleCount: input.task.sampleCount,
      prompt,
      executionPrompt,
      target: input.target,
      competitors: input.competitors,
      providerId: providerTarget.providerId,
      model: providerTarget.model,
      webSearchEnabled: providerTarget.webSearchEnabled ?? false,
      search: undefined,
      sourceType: provider.definition.sourceType,
      sourceLabel: `Source: ${provider.definition.label} API`,
      status: "failed",
      startedAt: runStartedAt,
      finishedAt: runStartedAt,
    };

    try {
      const result = await runProviderWithRetry(provider, {
        prompt: executionPrompt,
        model: providerTarget.model,
        apiKey,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        webSearchEnabled: providerTarget.webSearchEnabled ?? false,
        webSearchMode: providerTarget.webSearchEnabled ? "provider_native" : providerTarget.webSearchMode || "auto",
      }, {
        callId: input.callLedger.createCallId(),
        context: {
          purpose: "audit_answer",
          projectId: input.projectId,
          runId: input.auditId,
          observationId: id,
        },
        onAttempt: (event) => input.callLedger.record(event),
      });
      const citations = result.citations.map((citation) => ({ ...citation, promptId: prompt.id, runId: id }));
      run = {
        ...run,
        status: "completed",
        finishedAt: new Date().toISOString(),
        webSearchEnabled: result.search?.used ?? (providerTarget.webSearchEnabled ?? false),
        search: result.search,
        result: { ...result, citations },
        analysisStatus: "pending",
      };
      await input.onProviderAnswer(run);
      try {
        const analysis = this.analyzer.analyze({
          text: result.text,
          citations,
          target: input.target,
          competitors: input.competitors,
        });
        const intentAnalysis = await this.intentResultPipeline.analyze({
          userQuestion: prompt.text,
          target: input.target,
          answerText: result.text,
          citations: analysis.citations,
          provider,
          model: analysisModel,
          apiKey,
          language: prompt.language,
          questionClassification: prompt.brandQuestion,
          questionIntent: prompt.intentProfile,
          callLedger: input.callLedger,
          callContext: {
            projectId: input.projectId,
            runId: input.auditId,
            observationId: id,
          },
        });
        const semanticAnalysis = applyIntentSemantics(analysis, intentAnalysis);
        run = {
          ...run,
          result: { ...result, citations: semanticAnalysis.citations },
          analysis: semanticAnalysis,
          intentAnalysis,
          analysisStatus: intentAnalysis.status === "completed" ? "completed" : "partial",
          analysisError: intentAnalysis.error,
        };
      } catch (analysisError) {
        run = {
          ...run,
          analysisStatus: "failed",
          analysisError: analysisError instanceof Error ? analysisError.message : String(analysisError),
        };
      }
    } catch (error) {
      run = {
        ...run,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
    return run;
  }

  private async discoverCompetitorsFromAnswers(input: {
    target: Entity;
    existingCompetitors: Entity[];
    runs: PromptRun[];
    language: string;
    provider: ReturnType<ProviderCatalog["get"]>;
    model: string;
    apiKey: string;
    callLedger: ProviderCallLedger;
    callContext: {
      projectId: string;
      runId: string;
    };
  }): Promise<DiscoveredCompetitor[]> {
    try {
      return await this.competitorDiscovery.discover(input);
    } catch {
      return [];
    }
  }

  private reanalyzeRuns(runs: PromptRun[], target: Entity, competitors: Entity[]): PromptRun[] {
    return runs.map((run) => {
      const baseRun = { ...run, target, competitors };
      if (baseRun.status !== "completed" || !baseRun.result) return baseRun;
      const citations = baseRun.result.citations.map((citation) => ({
        ...citation,
        promptId: baseRun.prompt.id,
        runId: baseRun.id,
      }));
      const analysis = this.analyzer.analyze({
        text: baseRun.result.text,
        citations,
        target,
        competitors,
      });
      const semanticAnalysis = baseRun.intentAnalysis ? applyIntentSemantics(analysis, baseRun.intentAnalysis) : analysis;
      return {
        ...baseRun,
        result: { ...baseRun.result, citations: semanticAnalysis.citations },
        analysis: semanticAnalysis,
      };
    });
  }
}
