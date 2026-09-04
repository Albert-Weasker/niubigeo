import type {
  AuditMetrics,
  AuditPlan,
  AuditRun,
  DiscoveredCompetitor,
  Entity,
  GeoGapAnalysis,
  KeywordCandidate,
  KeywordMode,
  KeywordRelevance,
  MonitoringPrompt,
  ProviderTarget,
  PromptRun,
  ReportBundle,
} from "../core/types.js";
import { hasProviderKey, resolveProviderKey, runsDir } from "../config/env.js";
import { ProviderCatalog } from "../providers/catalog.js";
import { PromptGenerator, promptsFromManual } from "../prompts/prompt-generator.js";
import { buildExecutionPrompt } from "../prompts/execution-prompt.js";
import { DomainProfiler } from "../profile/domain-profiler.js";
import { ResponseAnalyzer } from "../analyzer/response-analyzer.js";
import { CompetitorDiscovery } from "../analyzer/competitor-discovery.js";
import { MetricsEngine } from "../metrics/metrics-engine.js";
import { GeoGapAnalyzer } from "../insights/gap-analyzer.js";
import { FileStore } from "../store/file-store.js";
import { ReportBuilder } from "../report/report-builder.js";
import { ReportModelBuilder } from "../report/report-model.js";
import { validateReport } from "../report/report-quality.js";
import { entityFromInput, normalizeDomain, slugify } from "../utils/domain.js";
import { SiteEvidenceCollector } from "../keywords/site-evidence.js";
import { KeywordUniverseBuilder } from "../keywords/keyword-universe.js";
import { KeywordRelevanceScorer } from "../keywords/keyword-relevance.js";
import { KeywordPromptPlanner } from "../prompts/keyword-prompt-planner.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "../core/version.js";

export interface AuditRunnerInput {
  target: Entity;
  confirmedPlan?: AuditPlan | undefined;
  submittedDomain?: string | undefined;
  competitors: Entity[];
  providerTargets: ProviderTarget[];
  language: string;
  promptCount: number;
  manualPrompts?: string[] | undefined;
  keywords?: string[] | undefined;
  keywordMode?: KeywordMode | undefined;
  keywordLimit?: number | undefined;
  promptsPerKeyword?: number | undefined;
  autoDiscover?: boolean | undefined;
  targetNameExplicit?: boolean | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  runsRoot?: string | undefined;
}

export interface AuditRunnerOutput {
  audit: AuditRun;
  metrics: AuditMetrics;
  gaps: GeoGapAnalysis;
  paths: ReportBundle;
}

function timestampId(target: Entity): string {
  let safeTimestamp = "";
  for (const char of new Date().toISOString()) {
    safeTimestamp += char === ":" || char === "." ? "-" : char;
  }
  return `${safeTimestamp}-${slugify(target.name || target.domain)}`;
}

function runId(prompt: MonitoringPrompt, target: ProviderTarget): string {
  return `${target.providerId}::${target.model}::${prompt.id}`;
}

function profileTargetScore(target: ProviderTarget): number {
  const model = target.model.toLowerCase();
  if (target.webSearchEnabled) return 4;
  if (target.providerId === "perplexity" || model.includes("perplexity/") || model.includes("sonar")) return 3;
  if (target.providerId === "openrouter" && (model.includes("search") || model.includes("online") || model.includes("web"))) return 2;
  return 1;
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

interface ProviderRunTask {
  prompt: MonitoringPrompt;
  providerTarget: ProviderTarget;
}

function competitorKey(entity: Entity): string {
  const domain = normalizeDomain(entity.domain);
  if (domain) return `domain:${domain}`;
  return `name:${entity.name.trim().toLowerCase()}`;
}

function competitorIsUsable(item: DiscoveredCompetitor): boolean {
  const relationship = item.relationship || "unknown";
  const confidence = item.confidence ?? 0;
  if (relationship === "infrastructure" || relationship === "unknown") return false;
  return confidence >= 0.55;
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
  private readonly catalog = new ProviderCatalog();
  private readonly analyzer = new ResponseAnalyzer();
  private readonly metrics = new MetricsEngine();
  private readonly gaps = new GeoGapAnalyzer();
  private readonly domainProfiler = new DomainProfiler();
  private readonly competitorDiscovery = new CompetitorDiscovery();
  private readonly promptGenerator = new PromptGenerator();
  private readonly siteEvidenceCollector = new SiteEvidenceCollector();
  private readonly keywordUniverse = new KeywordUniverseBuilder();
  private readonly keywordRelevanceScorer = new KeywordRelevanceScorer();
  private readonly keywordPromptPlanner = new KeywordPromptPlanner();
  private readonly reportModelBuilder = new ReportModelBuilder();
  private readonly reportBuilder = new ReportBuilder();

  async run(input: AuditRunnerInput): Promise<AuditRunnerOutput> {
    const providerTargets = input.confirmedPlan?.providerTargets || input.providerTargets;
    if (providerTargets.length === 0) throw new Error("At least one provider target is required.");
    for (const target of providerTargets) this.catalog.validate(target.providerId, target.model);

    const auditId = timestampId(input.confirmedPlan?.target || input.target);
    const store = new FileStore(input.runsRoot || runsDir());
    const startedAt = new Date().toISOString();

    const firstTarget = providerTargets[0];
    if (!firstTarget) throw new Error("At least one provider target is required.");
    const availableTargets = providerTargets.filter((target) => hasProviderKey(target.providerId));
    const promptTarget = availableTargets[0] || firstTarget;
    const profileTarget = selectProfileTarget(availableTargets.length ? availableTargets : providerTargets);
    const profileProvider = this.catalog.get(profileTarget.providerId);
    const firstProvider = this.catalog.get(promptTarget.providerId);
    let profileApiKey: string | undefined;

    let effectiveTarget = input.target;
    let effectiveCompetitors = input.competitors;
    let discoveredPrompts: MonitoringPrompt[] = [];
    let domainProfile: AuditRun["domainProfile"];
    let discoveryEvidence: AuditRun["discoveryEvidence"];
    let siteEvidence: AuditRun["siteEvidence"];
    let keywords: KeywordCandidate[] = [];
    let keywordClusters: AuditRun["keywordClusters"] = [];
    let keywordRelevance: KeywordRelevance[] = [];
    let promptData: { prompts: MonitoringPrompt[]; evidence: AuditRun["promptGeneration"] };

    if (input.confirmedPlan) {
      effectiveTarget = input.confirmedPlan.target;
      effectiveCompetitors = input.confirmedPlan.competitors;
      domainProfile = input.confirmedPlan.domainProfile;
      discoveryEvidence = input.confirmedPlan.discoveryEvidence;
      siteEvidence = input.confirmedPlan.siteEvidence;
      keywords = input.confirmedPlan.keywords || [];
      keywordClusters = input.confirmedPlan.keywordClusters || [];
      keywordRelevance = input.confirmedPlan.keywordRelevance || [];
      promptData = {
        prompts: input.confirmedPlan.prompts,
        evidence: input.confirmedPlan.promptGeneration,
      };
    } else {
      if (input.autoDiscover && hasProviderKey(profileTarget.providerId)) {
        profileApiKey = resolveProviderKey(profileTarget.providerId);
        const discovered = await this.domainProfiler.discover({
          auditId,
          domain: input.submittedDomain || input.target.domain,
          language: input.language,
          desiredPrompts: input.promptCount,
          provider: profileProvider,
          model: profileTarget.model,
          apiKey: profileApiKey,
          store,
        });
        domainProfile = discovered.profile;
        discoveryEvidence = discovered.evidence;
        discoveredPrompts = discovered.prompts.slice(0, input.promptCount);

        if (input.targetNameExplicit) {
          const discoveredAliases = [discovered.target.name, ...discovered.target.aliases].filter(
            (alias) => alias.toLowerCase() !== input.target.name.toLowerCase(),
          );
          effectiveTarget = {
            ...input.target,
            aliases: [...new Set([...input.target.aliases, ...discoveredAliases])],
          };
        } else {
          effectiveTarget = discovered.target;
        }

        if (input.competitors.length === 0 && discovered.competitors.length > 0) {
          effectiveCompetitors = discovered.competitors;
        }
      }

      if (input.target.githubRepo && !effectiveTarget.githubRepo) {
        effectiveTarget = { ...effectiveTarget, githubRepo: input.target.githubRepo };
      }

      const manualPrompts = input.manualPrompts?.map((prompt) => prompt.trim()).filter(Boolean);
      const requestedKeywords = [...new Set((input.keywords || []).map((keyword) => keyword.trim()).filter(Boolean))];
      const keywordAuditEnabled = Boolean(input.keywordMode || requestedKeywords.length > 0);
      let keywordPrompts: MonitoringPrompt[] = [];

      if (keywordAuditEnabled) {
        const submittedDomain = input.submittedDomain || effectiveTarget.domain;
        const collectedEvidence = await this.siteEvidenceCollector.collect({
          submittedDomain,
          maxPages: Math.max(3, Math.min(input.keywordLimit ?? 6, 10)),
          githubRepo: effectiveTarget.githubRepo,
        });
        siteEvidence = collectedEvidence;
        const universe = this.keywordUniverse.build({
          siteEvidence,
          domainProfile,
          userKeywords: requestedKeywords,
          language: input.language,
          mode: input.keywordMode || "site_plus_user",
          limit: Math.max(1, Math.min(input.keywordLimit ?? input.promptCount, 30)),
        });
        keywords = universe.keywords;
        keywordClusters = universe.clusters;
        keywordRelevance = this.keywordRelevanceScorer.score({ keywords, siteEvidence });
        keywordPrompts = this.keywordPromptPlanner.build({
          target: effectiveTarget,
          competitors: effectiveCompetitors,
          keywords,
          language: input.language,
          promptsPerKeyword: input.promptsPerKeyword ?? 2,
        });
      }

      const manualPromptRows = manualPrompts?.length
        ? promptsFromManual({
            target: effectiveTarget,
            language: input.language,
            prompts: manualPrompts,
          })
        : [];
      promptData = keywordPrompts.length
        ? {
            prompts: [...discoveredPrompts, ...keywordPrompts, ...manualPromptRows],
            evidence: undefined,
          }
        : manualPromptRows.length
          ? {
              prompts: manualPromptRows.slice(0, input.promptCount),
              evidence: undefined,
            }
          : discoveredPrompts.length
            ? {
                prompts: discoveredPrompts,
                evidence: undefined,
              }
            : await this.promptGenerator.generate({
                auditId,
                target: effectiveTarget,
                competitors: effectiveCompetitors,
                language: input.language,
                count: input.promptCount,
                provider: firstProvider,
                model: promptTarget.model,
                apiKey: resolveProviderKey(promptTarget.providerId),
                store,
              });
    }

    const runTasks: ProviderRunTask[] = promptData.prompts
      .filter((item) => item.enabled)
      .flatMap((prompt) => providerTargets.map((providerTarget) => ({ prompt, providerTarget })));

    let runs = await mapLimited(runTasks, auditConcurrency(), (task) =>
      this.executeProviderRun({
        task,
        target: effectiveTarget,
        competitors: effectiveCompetitors,
        maxTokens: input.maxTokens ?? 900,
        temperature: input.temperature ?? 0,
      }),
    );

    let discoveredCompetitors: DiscoveredCompetitor[] = [];
    try {
      const apiKey = profileApiKey || resolveProviderKey(profileTarget.providerId);
      discoveredCompetitors = await this.discoverCompetitorsFromAnswers({
        target: effectiveTarget,
        existingCompetitors: effectiveCompetitors,
        runs,
        language: input.language,
        provider: profileProvider,
        model: profileTarget.model,
        apiKey,
      });
    } catch {
      discoveredCompetitors = [];
    }
    const mergedCompetitors = mergeDiscoveredCompetitors({
      target: effectiveTarget,
      existing: effectiveCompetitors,
      discovered: discoveredCompetitors,
    });
    if (mergedCompetitors.length !== effectiveCompetitors.length) {
      effectiveCompetitors = mergedCompetitors;
      runs = this.reanalyzeRuns(runs, effectiveTarget, effectiveCompetitors);
    }

    const audit: AuditRun = {
      id: auditId,
      auditPlanId: input.confirmedPlan?.id,
      promptSetId: input.confirmedPlan?.promptSetId,
      promptSetHash: input.confirmedPlan?.promptSetHash,
      promptSetVersion: input.confirmedPlan?.promptSetVersion || PROMPT_SET_VERSION,
      analysisRulesVersion: input.confirmedPlan?.analysisRulesVersion || ANALYSIS_RULES_VERSION,
      runCountPerPrompt: input.confirmedPlan?.runCountPerPrompt || 1,
      submittedDomain: input.confirmedPlan?.submittedDomain || input.submittedDomain,
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
      promptGeneration: promptData.evidence,
      runs,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    const metrics = this.metrics.compute(runs, { keywords, keywordRelevance });
    const gaps = this.gaps.analyze(audit, metrics);
    const reportModel = this.reportModelBuilder.build(audit, metrics, gaps);
    const markdown = this.reportBuilder.renderMarkdown(reportModel);
    const quality = validateReport(markdown, audit, metrics, gaps);
    if (!quality.ok) {
      throw new Error(`Report quality gate failed:\n${quality.errors.join("\n")}`);
    }
    const paths = await store.saveAudit(audit, metrics, gaps, this.reportBuilder);
    return { audit, metrics, gaps, paths };
  }

  private async executeProviderRun(input: {
    task: ProviderRunTask;
    target: Entity;
    competitors: Entity[];
    maxTokens: number;
    temperature: number;
  }): Promise<PromptRun> {
    const { prompt, providerTarget } = input.task;
    const provider = this.catalog.get(providerTarget.providerId);
    const id = runId(prompt, providerTarget);
    const runStartedAt = new Date().toISOString();
    const executionPrompt = buildExecutionPrompt(prompt);
    let run: PromptRun = {
      id,
      prompt,
      executionPrompt,
      target: input.target,
      competitors: input.competitors,
      providerId: providerTarget.providerId,
      model: providerTarget.model,
      webSearchEnabled: providerTarget.webSearchEnabled ?? false,
      sourceType: provider.definition.sourceType,
      sourceLabel: `Source: ${provider.definition.label} API`,
      status: "failed",
      startedAt: runStartedAt,
      finishedAt: runStartedAt,
    };

    try {
      const apiKey = resolveProviderKey(providerTarget.providerId);
      const result = await provider.run({
        prompt: executionPrompt,
        model: providerTarget.model,
        apiKey,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        webSearchEnabled: providerTarget.webSearchEnabled ?? false,
      });
      const citations = result.citations.map((citation) => ({ ...citation, promptId: prompt.id, runId: id }));
      const analysis = this.analyzer.analyze({
        text: result.text,
        citations,
        target: input.target,
        competitors: input.competitors,
      });
      run = {
        ...run,
        status: "completed",
        finishedAt: new Date().toISOString(),
        result: { ...result, rawJson: null, citations: analysis.citations },
        analysis,
      };
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
      return {
        ...baseRun,
        result: { ...baseRun.result, rawJson: null, citations: analysis.citations },
        analysis,
      };
    });
  }
}
