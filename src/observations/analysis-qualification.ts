import type { ProjectRunRecord, RunAnalysisCoverage } from "../monitoring/monitoring-task-schema.js";
import { OBSERVATION_ANALYSIS_VERSION } from "../core/version.js";
import type { Observation, ObservationAnalysisResult, ObservationAnalysisStatus } from "./observation-schema.js";

function targetMention(observation: Pick<Observation, "mentions">) {
  return observation.mentions.find((mention) => mention.entityType === "target");
}

export function buildObservationAnalysisResult(input: {
  status: Observation["status"];
  answerText?: string | undefined;
  analysis: Observation["analysis"];
  intentAnalysis: Observation["intentAnalysis"];
  promptIntent: Observation["promptIntent"];
  mentions: Observation["mentions"];
  citations: Observation["citations"];
}): {
  analysisVersion: string;
  analysisStatus: ObservationAnalysisStatus;
  analysisResult: ObservationAnalysisResult;
} {
  const hasAnswer = input.status === "completed" && Boolean(input.answerText?.trim());
  const intent = input.intentAnalysis;
  const promptIntent = input.promptIntent;
  const intentComplete = intent?.status === "completed";
  const baseComplete = Boolean(input.analysis);
  if (!hasAnswer) {
    return {
      analysisVersion: OBSERVATION_ANALYSIS_VERSION,
      analysisStatus: "not_applicable",
      analysisResult: {
        questionIntents: null,
        brandMentioned: null,
        brandCandidate: null,
        brandRecommended: null,
        entitiesAnalyzed: null,
        citationsAnalyzed: null,
      },
    };
  }
  if (!baseComplete || !intentComplete || !intent) {
    return {
      analysisVersion: OBSERVATION_ANALYSIS_VERSION,
      analysisStatus: intent?.status === "failed" ? "failed" : "incomplete",
      analysisResult: {
        questionIntents: promptIntent?.intents || null,
        brandMentioned: baseComplete ? Boolean(targetMention(input)?.isMentioned) : null,
        brandCandidate: null,
        brandRecommended: null,
        entitiesAnalyzed: intent?.status === "completed" ? true : null,
        citationsAnalyzed: baseComplete ? true : null,
      },
    };
  }

  const inferredIntents = [intent.promptIntent.primaryIntent, ...intent.promptIntent.secondaryIntents].filter((value) => value !== "unclear");
  const intents = promptIntent?.intents || inferredIntents;
  const mention = targetMention(input);
  const mentioned = Boolean(mention?.isMentioned);
  const candidateApplicable = promptIntent?.candidateApplicable ?? intent.promptIntent.candidateApplicable;
  const recommendationApplicable = promptIntent?.recommendationApplicable ?? intent.promptIntent.recommendationApplicable;
  const candidate = mentioned && Boolean(
    mention?.mentionType === "recommendation" ||
    mention?.mentionType === "list_appearance" ||
    mention?.mentionType === "comparison",
  );
  const recommended = mentioned && Boolean(mention?.mentionType === "recommendation" && mention.isRecommendation);
  return {
    analysisVersion: OBSERVATION_ANALYSIS_VERSION,
    analysisStatus: "completed",
    analysisResult: {
      questionIntents: intents,
      brandMentioned: mentioned,
      brandCandidate: candidateApplicable ? candidate : "not_applicable",
      brandRecommended: recommendationApplicable ? recommended : "not_applicable",
      entitiesAnalyzed: true,
      citationsAnalyzed: true,
    },
  };
}

function intentCounts(observations: Observation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const observation of observations) {
    for (const intent of observation.analysisResult?.questionIntents || []) {
      counts[intent] = (counts[intent] || 0) + 1;
    }
  }
  return counts;
}

export function buildRunAnalysisCoverage(observations: Observation[]): RunAnalysisCoverage {
  const answered = observations.filter((observation) => observation.status === "completed" && Boolean(observation.answerText?.trim()));
  const currentVersion = answered.filter((observation) => observation.analysisVersion === OBSERVATION_ANALYSIS_VERSION);
  const completed = currentVersion.filter((observation) => observation.analysisStatus === "completed");
  const failed = currentVersion.filter((observation) => observation.analysisStatus === "failed");
  const incomplete = answered.filter(
    (observation) =>
      observation.analysisVersion !== OBSERVATION_ANALYSIS_VERSION ||
      observation.analysisStatus !== "completed",
  );
  const candidateApplicable = completed.filter((observation) => typeof observation.analysisResult?.brandCandidate === "boolean");
  const candidateNotApplicable = completed.filter((observation) => observation.analysisResult?.brandCandidate === "not_applicable");
  const recommendationApplicable = completed.filter((observation) => typeof observation.analysisResult?.brandRecommended === "boolean");
  const recommendationNotApplicable = completed.filter((observation) => observation.analysisResult?.brandRecommended === "not_applicable");
  const questionIntentProfiled = completed.filter((observation) => Array.isArray(observation.analysisResult?.questionIntents));
  const brandMentionJudged = completed.filter((observation) => typeof observation.analysisResult?.brandMentioned === "boolean");
  const entitiesCompleted = completed.filter((observation) => observation.analysisResult?.entitiesAnalyzed === true);
  const citationsCompleted = completed.filter((observation) => observation.analysisResult?.citationsAnalyzed === true);
  const criticalNull = completed.filter((observation) => {
    const result = observation.analysisResult;
    return (
      !result ||
      result.questionIntents === null ||
      result.brandMentioned === null ||
      result.brandCandidate === null ||
      result.brandRecommended === null ||
      result.entitiesAnalyzed === null ||
      result.citationsAnalyzed === null
    );
  });
  const status: RunAnalysisCoverage["status"] = answered.length === 0
    ? "not_applicable"
    : incomplete.length === 0
      ? "completed"
      : failed.length === answered.length
        ? "failed"
        : "incomplete";
  return {
    version: currentVersion.length > 0 ? OBSERVATION_ANALYSIS_VERSION : null,
    status,
    observationCount: observations.length,
    answeredObservationCount: answered.length,
    completedAnalysisCount: completed.length,
    incompleteAnalysisCount: incomplete.length,
    failedAnalysisCount: failed.length,
    intentCounts: intentCounts(completed),
    questionIntentProfiledCount: questionIntentProfiled.length,
    candidateApplicableCount: candidateApplicable.length,
    candidateNotApplicableCount: candidateNotApplicable.length,
    recommendationApplicableCount: recommendationApplicable.length,
    recommendationNotApplicableCount: recommendationNotApplicable.length,
    brandMentionJudgedCount: brandMentionJudged.length,
    entityExtractionCompletedCount: entitiesCompleted.length,
    citationParsingCompletedCount: citationsCompleted.length,
    criticalNullCount: criticalNull.length,
    criticalNullObservationIds: criticalNull.map((observation) => observation.id),
    incompleteObservationIds: incomplete.map((observation) => observation.id),
  };
}

export function runHasCurrentAnalysis(run: ProjectRunRecord): boolean {
  const coverage = run.analysisCoverage;
  return (
    run.analysisVersion === OBSERVATION_ANALYSIS_VERSION &&
    run.analysisStatus === "completed" &&
    run.analysisCompletedObservationCount === run.completedObservationCount &&
    run.analysisIncompleteObservationCount === 0 &&
    coverage?.version === OBSERVATION_ANALYSIS_VERSION &&
    coverage.status === "completed" &&
    coverage.observationCount === run.plannedObservationCount &&
    coverage.answeredObservationCount === run.completedObservationCount &&
    coverage.completedAnalysisCount === run.completedObservationCount &&
    coverage.incompleteAnalysisCount === 0 &&
    coverage.failedAnalysisCount === 0 &&
    coverage.questionIntentProfiledCount === run.completedObservationCount &&
    coverage.candidateApplicableCount + coverage.candidateNotApplicableCount === run.completedObservationCount &&
    coverage.recommendationApplicableCount + coverage.recommendationNotApplicableCount === run.completedObservationCount &&
    coverage.brandMentionJudgedCount === run.completedObservationCount &&
    coverage.entityExtractionCompletedCount === run.completedObservationCount &&
    coverage.citationParsingCompletedCount === run.completedObservationCount &&
    coverage.criticalNullCount === 0
  );
}
