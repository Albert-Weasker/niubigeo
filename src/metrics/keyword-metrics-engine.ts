import type {
  Citation,
  CompetitorMetric,
  FractionMetric,
  KeywordCandidate,
  KeywordMetric,
  KeywordMetricSummary,
  KeywordRelevance,
  Mention,
  PromptRun,
} from "../core/types.js";

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

function completedRuns(runs: PromptRun[]): PromptRun[] {
  return runs.filter((run) => run.status === "completed" && run.analysis);
}

function failedRuns(runs: PromptRun[]): PromptRun[] {
  return runs.filter((run) => run.status === "failed");
}

function targetMention(run: PromptRun): Mention | undefined {
  return run.analysis?.mentions.find((mention) => mention.entityType === "target");
}

function officialTargetCitations(run: PromptRun): Citation[] {
  return (run.analysis?.citations || []).filter(
    (citation) => citation.citationType === "target_official" || citation.citationType === "target_github",
  );
}

function winner(run: PromptRun): string | null {
  const ranked = (run.analysis?.mentions || [])
    .filter((mention) => mention.isMentioned && mention.rankPosition !== null)
    .sort((a, b) => Number(a.rankPosition) - Number(b.rankPosition));
  return ranked[0]?.entityName ?? null;
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

function competitorMetrics(runs: PromptRun[]): CompetitorMetric[] {
  const completed = completedRuns(runs);
  const competitorEntities = completed[0]?.competitors || runs[0]?.competitors || [];
  const allEntityCoverage = allEntityMentionCoverage(completed);

  return competitorEntities
    .map((entity) => {
      const mentions = completed
        .map((run) => run.analysis?.mentions.find((mention) => mention.entityId === entity.id))
        .filter((mention): mention is Mention => Boolean(mention));
      const mentioned = mentions.filter((mention) => mention.isMentioned);
      const ranks = mentions.map((mention) => mention.rankPosition).filter((rank): rank is number => typeof rank === "number");
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
        averageRank: average(ranks),
        wins: completed.filter((run) => winner(run) === entity.name).length,
      };
    })
    .sort((a, b) => b.mentionCount - a.mentionCount || b.citationCount - a.citationCount || a.name.localeCompare(b.name));
}

function gapLabel(input: {
  keyword: KeywordCandidate;
  ownedRelevance: number;
  validResponses: number;
  mentionRate: FractionMetric;
  citationRate: FractionMetric;
  competitorOnlyRate: FractionMetric;
}): string {
  if (input.validResponses === 0) return "No completed AI answers";
  if (input.mentionRate.numerator === 0 && input.competitorOnlyRate.numerator > 0) return "Competitors own this AI answer space";
  if (input.mentionRate.numerator === 0) return "Target absent from AI answers";
  if (input.ownedRelevance >= 0.6 && (input.mentionRate.value ?? 0) < 0.5) return "Owned content is not reflected in AI answers";
  if (input.citationRate.numerator === 0) return "Mentioned without official citation";
  if (input.competitorOnlyRate.numerator > 0) return "Competitors still appear without target in some answers";
  return "Covered in this audit";
}

export class KeywordMetricsEngine {
  compute(input: {
    runs: PromptRun[];
    keywords?: KeywordCandidate[] | undefined;
    keywordRelevance?: KeywordRelevance[] | undefined;
  }): { summary: KeywordMetricSummary; metrics: KeywordMetric[] } {
    const relevanceByKeyword = new Map((input.keywordRelevance || []).map((row) => [row.keywordId, row]));
    const keywordRows = input.keywords || [];
    const metrics = keywordRows.map((keyword) => {
      const keywordRuns = input.runs.filter((run) => run.prompt.keywordIds?.includes(keyword.id));
      const completed = completedRuns(keywordRuns);
      const mentions = completed.map(targetMention).filter((mention): mention is Mention => Boolean(mention));
      const mentionedRuns = mentions.filter((mention) => mention.isMentioned);
      const recommendationRuns = mentions.filter((mention) => mention.isRecommendation);
      const firstPositionRuns = mentions.filter((mention) => mention.isMentioned && mention.isFirstPosition);
      const citationRuns = completed.filter((run) => officialTargetCitations(run).length > 0);
      const competitorOnlyRuns = completed.filter((run) => {
        const target = targetMention(run);
        const competitorMentioned = (run.analysis?.mentions || []).some(
          (mention) => mention.entityType === "competitor" && mention.isMentioned,
        );
        return !target?.isMentioned && competitorMentioned;
      });
      const allEntityCoverage = allEntityMentionCoverage(completed);
      const ranks = mentions.map((mention) => mention.rankPosition).filter((rank): rank is number => typeof rank === "number");
      const promptCount = new Set(keywordRuns.map((run) => run.prompt.id)).size;
      const ownedRelevance = relevanceByKeyword.get(keyword.id)?.score ?? 0;
      const mentionRate = fraction(mentionedRuns.length, completed.length);
      const citationRate = fraction(citationRuns.length, completed.length);
      const recommendationRate = fraction(recommendationRuns.length, completed.length);
      const firstPositionRate = fraction(firstPositionRuns.length, completed.length);
      const competitorOnlyRate = fraction(competitorOnlyRuns.length, completed.length);

      return {
        keywordId: keyword.id,
        phrase: keyword.phrase,
        source: keyword.source,
        userDefined: keyword.userDefined,
        ownedRelevance,
        validResponses: completed.length,
        failedResponses: failedRuns(keywordRuns).length,
        promptCount,
        mentionRate,
        citationRate,
        recommendationRate,
        firstPositionRate,
        shareOfVoice: fraction(mentionedRuns.length, allEntityCoverage),
        competitorOnlyRate,
        averageRank: average(ranks),
        topCompetitors: competitorMetrics(keywordRuns).slice(0, 5),
        gapLabel: gapLabel({
          keyword,
          ownedRelevance,
          validResponses: completed.length,
          mentionRate,
          citationRate,
          competitorOnlyRate,
        }),
      };
    });

    const withValidResponses = metrics.filter((metric) => metric.validResponses > 0);
    const ownedScores = metrics.map((metric) => metric.ownedRelevance).filter((score) => Number.isFinite(score));
    const summary: KeywordMetricSummary = {
      totalKeywords: metrics.length,
      userDefinedKeywords: metrics.filter((metric) => metric.userDefined).length,
      discoveredKeywords: metrics.filter((metric) => !metric.userDefined).length,
      averageOwnedRelevance: average(ownedScores),
      aiMentionRate: fraction(
        withValidResponses.filter((metric) => metric.mentionRate.numerator > 0).length,
        withValidResponses.length,
      ),
      competitorOnlyRate: fraction(
        withValidResponses.filter((metric) => metric.competitorOnlyRate.numerator > 0).length,
        withValidResponses.length,
      ),
    };

    return { summary, metrics };
  }
}
