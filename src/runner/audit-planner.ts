import type {
  AuditPlan,
  DomainProfile,
  Entity,
  KeywordCandidate,
  KeywordMode,
  KeywordRelevance,
  MonitoringPrompt,
  ProviderTarget,
} from "../core/types.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "../core/version.js";
import { resolveProviderKey, runsDir } from "../config/env.js";
import { ProviderCatalog } from "../providers/catalog.js";
import { PromptGenerator, promptsFromManual } from "../prompts/prompt-generator.js";
import { DomainProfiler } from "../profile/domain-profiler.js";
import { FileStore } from "../store/file-store.js";
import { slugify } from "../utils/domain.js";
import { sha256 } from "../utils/hash.js";
import { containsTextTerm } from "../utils/text-match.js";
import { SiteEvidenceCollector } from "../keywords/site-evidence.js";
import { KeywordUniverseBuilder } from "../keywords/keyword-universe.js";
import { KeywordRelevanceScorer } from "../keywords/keyword-relevance.js";
import { KeywordPromptPlanner } from "../prompts/keyword-prompt-planner.js";
import { withAuditCategory } from "../prompts/audit-category.js";

export interface AuditPlannerInput {
  target: Entity;
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
  runsRoot?: string | undefined;
}

function timestampId(prefix: string, target: Entity): string {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(target.name || target.domain)}`;
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

function promptSetHash(input: { prompts: MonitoringPrompt[]; providerTargets: ProviderTarget[]; language: string }): string {
  return sha256(
    JSON.stringify({
      language: input.language,
      providerTargets: input.providerTargets.map((target) => ({
        providerId: target.providerId,
        model: target.model,
        webSearchEnabled: Boolean(target.webSearchEnabled),
        webSearchMode: target.webSearchMode || "auto",
      })),
      prompts: input.prompts.map((prompt) => ({
        type: prompt.type,
        auditCategory: prompt.auditCategory,
        text: prompt.text,
        enabled: prompt.enabled,
        keywordIds: prompt.keywordIds || [],
      })),
    }),
  ).slice(0, 12);
}

function dedupePrompts(prompts: MonitoringPrompt[], target: Entity): MonitoringPrompt[] {
  const seen = new Set<string>();
  const rows: MonitoringPrompt[] = [];
  for (const prompt of prompts) {
    const text = prompt.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(
      withAuditCategory({
        ...prompt,
        text,
        targetIncluded:
          prompt.targetIncluded ??
          [target.name, target.domain, ...target.aliases]
            .map((term) => term.trim().toLowerCase())
            .filter(Boolean)
            .some((term) => containsTextTerm(text, term)),
      }),
    );
  }
  return rows;
}

function estimate(prompts: MonitoringPrompt[], providerTargets: ProviderTarget[]): AuditPlan["estimate"] {
  const enabledPromptCount = prompts.filter((prompt) => prompt.enabled).length;
  return {
    enabledPromptCount,
    disabledPromptCount: prompts.length - enabledPromptCount,
    providerTargetCount: providerTargets.length,
    providerRunCount: enabledPromptCount * providerTargets.length,
  };
}

export class AuditPlanner {
  private readonly catalog = new ProviderCatalog();
  private readonly domainProfiler = new DomainProfiler();
  private readonly promptGenerator = new PromptGenerator();
  private readonly siteEvidenceCollector = new SiteEvidenceCollector();
  private readonly keywordUniverse = new KeywordUniverseBuilder();
  private readonly keywordRelevanceScorer = new KeywordRelevanceScorer();
  private readonly keywordPromptPlanner = new KeywordPromptPlanner();

  async plan(input: AuditPlannerInput): Promise<AuditPlan> {
    if (input.providerTargets.length === 0) throw new Error("At least one provider target is required.");
    for (const target of input.providerTargets) this.catalog.validate(target.providerId, target.model);

    const planId = timestampId("plan", input.target);
    const store = new FileStore(input.runsRoot || runsDir());
    const firstTarget = input.providerTargets[0];
    if (!firstTarget) throw new Error("At least one provider target is required.");
    const firstProvider = this.catalog.get(firstTarget.providerId);
    const firstApiKey = resolveProviderKey(firstTarget.providerId);
    const profileTarget = selectProfileTarget(input.providerTargets);
    const profileProvider = this.catalog.get(profileTarget.providerId);
    const profileApiKey = resolveProviderKey(profileTarget.providerId);

    let effectiveTarget = input.target;
    let effectiveCompetitors = input.competitors;
    let domainProfile: DomainProfile | undefined;
    let discoveryEvidence: AuditPlan["discoveryEvidence"];
    let discoveredPrompts: MonitoringPrompt[] = [];

    if (input.autoDiscover) {
      const discovered = await this.domainProfiler.discover({
        auditId: planId,
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

    const requestedKeywords = [...new Set((input.keywords || []).map((keyword) => keyword.trim()).filter(Boolean))];
    const keywordAuditEnabled = Boolean(input.keywordMode || requestedKeywords.length > 0);
    let siteEvidence: AuditPlan["siteEvidence"];
    let keywords: KeywordCandidate[] = [];
    let keywordClusters: AuditPlan["keywordClusters"] = [];
    let keywordRelevance: KeywordRelevance[] = [];
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

    const manualPromptRows = input.manualPrompts?.length
      ? promptsFromManual({
          target: effectiveTarget,
          language: input.language,
          prompts: input.manualPrompts,
        })
      : [];

    let promptGeneration: AuditPlan["promptGeneration"];
    let generatedPrompts: MonitoringPrompt[] = [];
    if (!discoveredPrompts.length && !manualPromptRows.length && !keywordPrompts.length) {
      const generated = await this.promptGenerator.generate({
        auditId: planId,
        target: effectiveTarget,
        competitors: effectiveCompetitors,
        language: input.language,
        count: input.promptCount,
        provider: firstProvider,
        model: firstTarget.model,
        apiKey: firstApiKey,
        store,
      });
      generatedPrompts = generated.prompts;
      promptGeneration = generated.evidence;
    }

    const prompts = dedupePrompts([...discoveredPrompts, ...keywordPrompts, ...manualPromptRows, ...generatedPrompts], effectiveTarget);
    const hash = promptSetHash({ prompts, providerTargets: input.providerTargets, language: input.language });
    return {
      id: planId,
      submittedDomain: input.submittedDomain || input.target.domain,
      target: effectiveTarget,
      competitors: effectiveCompetitors,
      prompts,
      providerTargets: input.providerTargets,
      language: input.language,
      autoDiscover: Boolean(input.autoDiscover),
      keywordMode: input.keywordMode,
      promptSetId: `${PROMPT_SET_VERSION}-${hash}`,
      promptSetHash: hash,
      promptSetVersion: PROMPT_SET_VERSION,
      analysisRulesVersion: ANALYSIS_RULES_VERSION,
      runCountPerPrompt: 1,
      plannedAt: new Date().toISOString(),
      domainProfile,
      discoveryEvidence,
      siteEvidence,
      keywords,
      keywordClusters,
      keywordRelevance,
      promptGeneration,
      estimate: estimate(prompts, input.providerTargets),
    };
  }
}
