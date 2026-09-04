import type {
  AuditMetrics,
  Citation,
  ComparisonMetric,
  CompetitorMetric,
  FractionMetric,
  KeywordCandidate,
  KeywordRelevance,
  Mention,
  MetricSlice,
  MetricSliceType,
  PromptAuditCategory,
  PromptCategoryMetric,
  PromptOutcome,
  PromptRun,
} from "../core/types.js";
import { citationDomainGroups } from "../analyzer/citation-intelligence.js";
import { KeywordMetricsEngine } from "./keyword-metrics-engine.js";
import { inferPromptAuditCategory, promptAuditCategoryLabel } from "../prompts/audit-category.js";

function fraction(numerator: number, denominator: number): FractionMetric {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function targetMention(run: PromptRun): Mention | undefined {
  return run.analysis?.mentions.find((mention) => mention.entityType === "target");
}

function officialTargetCitations(run: PromptRun): Citation[] {
  return (run.analysis?.citations || []).filter(
    (citation) => citation.citationType === "target_official" || citation.citationType === "target_github",
  );
}

function allCitations(runs: PromptRun[]): Citation[] {
  return runs.flatMap((run) => run.analysis?.citations || []);
}

function allEntityMentionCoverage(runs: PromptRun[]): number {
  return runs
    .flatMap((run) => run.analysis?.mentions || [])
    .filter((mention) => mention.isMentioned)
    .length;
}

function runWebSearchEnabled(run: PromptRun): boolean {
  return run.webSearchEnabled;
}

function winner(run: PromptRun): string | null {
  const ranked = (run.analysis?.mentions || [])
    .filter((mention) => mention.isMentioned && mention.rankPosition !== null)
    .sort((a, b) => Number(a.rankPosition) - Number(b.rankPosition));
  return ranked[0]?.entityName ?? null;
}

function promptOutcome(run: PromptRun): PromptOutcome {
  const target = targetMention(run);
  const officialCount = officialTargetCitations(run).length;
  return {
    promptId: run.prompt.id,
    promptType: run.prompt.type,
    promptAuditCategory: inferPromptAuditCategory(run.prompt),
    providerId: run.providerId,
    model: run.model,
    sourceLabel: run.sourceLabel,
    webSearchEnabled: runWebSearchEnabled(run),
    search: run.search,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    targetMentioned: Boolean(target?.isMentioned),
    targetMentionCount: target?.count || 0,
    targetRank: target?.rankPosition ?? null,
    mentionType: target?.mentionType || "not_mentioned",
    sentiment: target?.sentiment || "neutral",
    officialCitationCount: officialCount,
    competitorMentions: (run.analysis?.mentions || [])
      .filter((mention) => mention.entityType === "competitor" && mention.isMentioned)
      .map((mention) => mention.entityName),
    keywordIds: run.prompt.keywordIds || [],
    keywordIntent: run.prompt.keywordIntent,
    winner: winner(run),
    rawJsonPath: run.rawJsonPath || null,
    costUsd: run.result?.costUsd,
  };
}

function completedRuns(runs: PromptRun[]): PromptRun[] {
  return runs.filter((run) => run.status === "completed" && run.analysis);
}

function failedRuns(runs: PromptRun[]): PromptRun[] {
  return runs.filter((run) => run.status === "failed");
}

function computeMetricSlice(input: { sliceType: MetricSliceType; key: string; label: string; runs: PromptRun[] }): MetricSlice {
  const completed = completedRuns(input.runs);
  const targetMentions = completed.map(targetMention).filter((mention): mention is Mention => Boolean(mention));
  const mentionedRuns = targetMentions.filter((mention) => mention.isMentioned);
  const recommendationRuns = targetMentions.filter((mention) => mention.isRecommendation);
  const firstPositionRuns = targetMentions.filter((mention) => mention.isMentioned && mention.isFirstPosition);
  const citationRuns = completed.filter((run) => officialTargetCitations(run).length > 0);
  const targetMentionOccurrences = targetMentions.reduce((sum, mention) => sum + mention.count, 0);
  const allEntityMentionOccurrences = completed
    .flatMap((run) => run.analysis?.mentions || [])
    .reduce((sum, mention) => sum + mention.count, 0);
  const allEntityCoverage = allEntityMentionCoverage(completed);
  const ranks = targetMentions.map((mention) => mention.rankPosition).filter((rank): rank is number => typeof rank === "number");

  return {
    sliceType: input.sliceType,
    key: input.key,
    label: input.label,
    validResponses: completed.length,
    failedResponses: failedRuns(input.runs).length,
    mentionRate: fraction(mentionedRuns.length, completed.length),
    citationRate: fraction(citationRuns.length, completed.length),
    recommendationRate: fraction(recommendationRuns.length, completed.length),
    firstPositionRate: fraction(firstPositionRuns.length, completed.length),
    shareOfVoice: fraction(mentionedRuns.length, allEntityCoverage),
    averageRank: average(ranks),
    targetMentionOccurrences,
    allEntityMentionOccurrences,
  };
}

function groupBy(runs: PromptRun[], keyFor: (run: PromptRun) => { key: string; label: string }): Array<{ key: string; label: string; runs: PromptRun[] }> {
  const groups = new Map<string, { key: string; label: string; runs: PromptRun[] }>();
  for (const run of runs) {
    const { key, label } = keyFor(run);
    const existing = groups.get(key) || { key, label, runs: [] };
    existing.runs.push(run);
    groups.set(key, existing);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function computeMetricSlices(runs: PromptRun[]): MetricSlice[] {
  const slicePlans: Array<{
    sliceType: MetricSliceType;
    keyFor: (run: PromptRun) => { key: string; label: string };
  }> = [
    {
      sliceType: "provider",
      keyFor: (run) => ({ key: run.providerId, label: run.sourceLabel || run.providerId }),
    },
    {
      sliceType: "model",
      keyFor: (run) => ({ key: run.model, label: run.model }),
    },
    {
      sliceType: "provider_model",
      keyFor: (run) => ({ key: `${run.providerId}:${run.model}`, label: `${run.providerId} / ${run.model}` }),
    },
    {
      sliceType: "prompt_type",
      keyFor: (run) => ({ key: run.prompt.type, label: run.prompt.type }),
    },
    {
      sliceType: "prompt_targeting",
      keyFor: (run) =>
        run.prompt.targetIncluded === false
          ? { key: "organic_unbranded", label: "Organic / unbranded prompts" }
          : { key: "branded_or_direct", label: "Branded or direct prompts" },
    },
  ];

  return slicePlans.flatMap((plan) =>
    groupBy(runs, plan.keyFor).map((group) =>
      computeMetricSlice({
        sliceType: plan.sliceType,
        key: group.key,
        label: group.label,
        runs: group.runs,
      }),
    ),
  );
}

function runsByPromptCategory(runs: PromptRun[], category: PromptAuditCategory): PromptRun[] {
  return runs.filter((run) => inferPromptAuditCategory(run.prompt) === category);
}

function computePromptCategoryMetric(category: PromptAuditCategory, runs: PromptRun[]): PromptCategoryMetric {
  const completed = completedRuns(runs);
  const targetMentions = completed.map(targetMention).filter((mention): mention is Mention => Boolean(mention));
  const mentionedRuns = targetMentions.filter((mention) => mention.isMentioned);
  const recommendationRuns = targetMentions.filter((mention) => mention.isRecommendation);
  const firstPositionRuns = targetMentions.filter((mention) => mention.isMentioned && mention.isFirstPosition);
  const citationRuns = completed.filter((run) => officialTargetCitations(run).length > 0);
  const suspectedIncorrectCount = targetMentions.filter((mention) => mention.mentionType === "incorrect").length;
  return {
    category,
    label: promptAuditCategoryLabel(category),
    validResponses: completed.length,
    failedResponses: failedRuns(runs).length,
    mentionRate: fraction(mentionedRuns.length, completed.length),
    citationRate: fraction(citationRuns.length, completed.length),
    recommendationRate: fraction(recommendationRuns.length, completed.length),
    firstPositionRate: fraction(firstPositionRuns.length, completed.length),
    shareOfVoice: fraction(mentionedRuns.length, allEntityMentionCoverage(completed)),
    suspectedIncorrectCount,
  };
}

function computePromptCategoryMetrics(runs: PromptRun[]): PromptCategoryMetric[] {
  const categories: PromptAuditCategory[] = ["organic_discovery", "brand_awareness", "comparison", "other"];
  return categories.map((category) => computePromptCategoryMetric(category, runsByPromptCategory(runs, category)));
}

function computeComparisonMetric(runs: PromptRun[]): ComparisonMetric {
  const comparisonRuns = runsByPromptCategory(runs, "comparison");
  const completed = completedRuns(comparisonRuns);
  const targetMentions = completed.map(targetMention).filter((mention): mention is Mention => Boolean(mention));
  const mentionedRuns = targetMentions.filter((mention) => mention.isMentioned);
  return {
    validResponses: completed.length,
    failedResponses: failedRuns(comparisonRuns).length,
    targetMentionCount: mentionedRuns.length,
    recommendationCount: targetMentions.filter((mention) => mention.isRecommendation).length,
    firstPositionCount: targetMentions.filter((mention) => mention.isMentioned && mention.isFirstPosition).length,
    officialCitationCount: completed.filter((run) => officialTargetCitations(run).length > 0).length,
    shareOfVoice: fraction(mentionedRuns.length, allEntityMentionCoverage(completed)),
  };
}

export class MetricsEngine {
  private readonly keywordMetrics = new KeywordMetricsEngine();

  compute(
    runs: PromptRun[],
    keywordContext: { keywords?: KeywordCandidate[] | undefined; keywordRelevance?: KeywordRelevance[] | undefined } = {},
  ): AuditMetrics {
    const completed = completedRuns(runs);
    const targetMentions = completed.map(targetMention).filter((mention): mention is Mention => Boolean(mention));
    const mentionedRuns = targetMentions.filter((mention) => mention.isMentioned);
    const recommendationRuns = targetMentions.filter((mention) => mention.isRecommendation);
    const firstPositionRuns = targetMentions.filter((mention) => mention.isMentioned && mention.isFirstPosition);
    const citationRuns = completed.filter((run) => officialTargetCitations(run).length > 0);
    const targetMentionOccurrences = targetMentions.reduce((sum, mention) => sum + mention.count, 0);
    const allEntityMentionOccurrences = completed
      .flatMap((run) => run.analysis?.mentions || [])
      .reduce((sum, mention) => sum + mention.count, 0);
    const allEntityCoverage = allEntityMentionCoverage(completed);
    const ranks = targetMentions.map((mention) => mention.rankPosition).filter((rank): rank is number => typeof rank === "number");
    const mentionedWithoutOfficialCitation = completed.filter((run) => {
      const mention = targetMention(run);
      return Boolean(mention?.isMentioned) && officialTargetCitations(run).length === 0;
    }).length;
    const citedWithoutProseMention = completed.filter((run) => {
      const mention = targetMention(run);
      return !mention?.isMentioned && officialTargetCitations(run).length > 0;
    }).length;

    const competitorEntities = completed[0]?.competitors || runs[0]?.competitors || [];
    const competitors: CompetitorMetric[] = competitorEntities.map((entity) => {
      const mentions = completed
        .map((run) => run.analysis?.mentions.find((mention) => mention.entityId === entity.id))
        .filter((mention): mention is Mention => Boolean(mention));
      const mentioned = mentions.filter((mention) => mention.isMentioned);
      const occurrences = mentions.reduce((sum, mention) => sum + mention.count, 0);
      const competitorRanks = mentions.map((mention) => mention.rankPosition).filter((rank): rank is number => typeof rank === "number");
      const citations = allCitations(completed).filter((citation) => citation.entityId === entity.id);
      return {
        entityId: entity.id,
        name: entity.name,
        domain: entity.domain,
        mentionCount: mentioned.length,
        mentionRate: fraction(mentioned.length, completed.length),
        recommendationCount: mentions.filter((mention) => mention.isRecommendation).length,
        citationCount: citations.length,
        shareOfVoice: fraction(mentioned.length, allEntityCoverage),
        averageRank: average(competitorRanks),
        wins: completed.filter((run) => winner(run) === entity.name).length,
      };
    });

    const keywordResult = this.keywordMetrics.compute({
      runs,
      keywords: keywordContext.keywords,
      keywordRelevance: keywordContext.keywordRelevance,
    });
    const promptCategoryMetrics = computePromptCategoryMetrics(runs);
    const brandAwareness = promptCategoryMetrics.find((row) => row.category === "brand_awareness");
    const organicDiscovery = promptCategoryMetrics.find((row) => row.category === "organic_discovery");
    const comparison = computeComparisonMetric(runs);

    return {
      validResponses: completed.length,
      failedResponses: failedRuns(runs).length,
      brandAwarenessRate: brandAwareness?.mentionRate || fraction(0, 0),
      naturalDiscoveryRate: organicDiscovery?.mentionRate || fraction(0, 0),
      organicRecommendationRate: organicDiscovery?.recommendationRate || fraction(0, 0),
      officialCitationRate: fraction(citationRuns.length, completed.length),
      comparison,
      promptCategoryMetrics,
      mentionCount: mentionedRuns.length,
      mentionRate: fraction(mentionedRuns.length, completed.length),
      recommendationRate: fraction(recommendationRuns.length, completed.length),
      firstPositionRate: fraction(firstPositionRuns.length, completed.length),
      citationCount: citationRuns.length,
      citationRate: fraction(citationRuns.length, completed.length),
      shareOfVoice: fraction(mentionedRuns.length, allEntityCoverage),
      averageRank: average(ranks),
      targetMentionOccurrences,
      allEntityMentionOccurrences,
      mentionedWithoutOfficialCitation,
      citedWithoutProseMention,
      competitors,
      promptOutcomes: runs.map(promptOutcome),
      keywordSummary: keywordResult.summary,
      keywordMetrics: keywordResult.metrics,
      citationDomains: citationDomainGroups(allCitations(completed)),
      slices: computeMetricSlices(runs),
    };
  }
}
