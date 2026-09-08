import { applyIntentSemantics, ResponseAnalyzer } from "../analyzer/response-analyzer.js";
import { resolveProviderKey } from "../config/env.js";
import type { Citation, Mention, PromptRunAnalysis } from "../core/types.js";
import { IntentResultPipeline } from "../intent/intent-result-pipeline.js";
import type { IntentRunAnalysis } from "../intent/intent-schema.js";
import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import { ProviderCatalog } from "../providers/catalog.js";
import { analysisModelFor } from "../providers/provider-role.js";
import type { ProjectMonitoringStore } from "../projects/project-store.js";
import { buildObservationAnalysisResult, buildRunAnalysisCoverage } from "./analysis-qualification.js";
import type { Observation } from "./observation-schema.js";

export interface ObservationAnalysisEngine {
  analyze(input: {
    observation: Observation;
    project: NonNullable<Awaited<ReturnType<ProjectMonitoringStore["readProject"]>>>;
  }): Promise<{ analysis: PromptRunAnalysis; intentAnalysis: IntentRunAnalysis }>;
}

function uniqueCompetitorNames(mentions: Mention[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const mention of mentions) {
    if (!mention.isMentioned || mention.entityType !== "competitor") continue;
    const name = mention.entityName.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function evidence(mentions: Mention[], citations: Citation[], answerText: string): Observation["evidence"] {
  return {
    hasAnswer: Boolean(answerText.trim()),
    targetMentioned: mentions.some((mention) => mention.entityType === "target" && mention.isMentioned),
    mentionedCompetitors: uniqueCompetitorNames(mentions),
    citationCount: citations.length,
    officialCitationCount: citations.filter(
      (citation) => citation.citationType === "target_official" || citation.citationType === "target_github",
    ).length,
  };
}

class ProviderObservationAnalysisEngine implements ObservationAnalysisEngine {
  private readonly catalog = new ProviderCatalog();
  private readonly responses = new ResponseAnalyzer();
  private readonly intents = new IntentResultPipeline();

  async analyze(input: {
    observation: Observation;
    project: NonNullable<Awaited<ReturnType<ProjectMonitoringStore["readProject"]>>>;
  }): Promise<{ analysis: PromptRunAnalysis; intentAnalysis: IntentRunAnalysis }> {
    const provider = this.catalog.get(input.observation.providerId);
    const apiKey = resolveProviderKey(input.observation.providerId);
    const model = analysisModelFor(provider, input.observation.model);
    const citations = input.observation.citations.map((citation) => ({
      ...citation,
      promptId: input.observation.promptId,
      runId: input.observation.id,
    }));
    const base = this.responses.analyze({
      text: input.observation.answerText || "",
      citations,
      target: input.project.target,
      competitors: input.project.competitors,
    });
    const intentAnalysis = await this.intents.analyze({
      userQuestion: input.observation.promptText,
      target: input.project.target,
      answerText: input.observation.answerText || "",
      citations: base.citations,
      provider,
      model,
      apiKey,
      language: input.observation.language,
      questionClassification: input.observation.brandQuestion,
      questionIntent: input.observation.promptIntent,
    });
    return { analysis: applyIntentSemantics(base, intentAnalysis), intentAnalysis };
  }
}

async function mapLimited<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await mapper(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export class ObservationReanalysisService {
  constructor(
    private readonly store: ProjectMonitoringStore,
    private readonly engine: ObservationAnalysisEngine = new ProviderObservationAnalysisEngine(),
  ) {}

  async reanalyze(projectId: string, runId: string): Promise<{ run: ProjectRunRecord; observations: Observation[] }> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const run = await this.store.readRun(projectId, runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const observations = await this.store.listObservations(projectId, runId);
    const updated = await mapLimited(observations, 4, async (observation): Promise<Observation> => {
      if (observation.status !== "completed" || !observation.answerText?.trim()) {
        const qualification = buildObservationAnalysisResult({
          status: observation.status,
          answerText: observation.answerText,
          analysis: observation.analysis,
          intentAnalysis: observation.intentAnalysis,
          promptIntent: observation.promptIntent,
          mentions: observation.mentions,
          citations: observation.citations,
        });
        return { ...observation, ...qualification };
      }
      try {
        const analyzed = await this.engine.analyze({ observation, project });
        const qualification = buildObservationAnalysisResult({
          status: observation.status,
          answerText: observation.answerText,
          analysis: analyzed.analysis,
          intentAnalysis: analyzed.intentAnalysis,
          promptIntent: observation.promptIntent,
          mentions: analyzed.analysis.mentions,
          citations: analyzed.analysis.citations,
        });
        return {
          ...observation,
          analysis: analyzed.analysis,
          intentAnalysis: analyzed.intentAnalysis,
          mentions: analyzed.analysis.mentions,
          citations: analyzed.analysis.citations,
          evidence: evidence(analyzed.analysis.mentions, analyzed.analysis.citations, observation.answerText),
          analysisError: undefined,
          ...qualification,
        };
      } catch (error) {
        const qualification = buildObservationAnalysisResult({
          status: observation.status,
          answerText: observation.answerText,
          analysis: observation.analysis,
          intentAnalysis: undefined,
          promptIntent: observation.promptIntent,
          mentions: observation.mentions,
          citations: observation.citations,
        });
        return {
          ...observation,
          intentAnalysis: undefined,
          analysisError: error instanceof Error ? error.message : String(error),
          ...qualification,
        };
      }
    });
    const coverage = buildRunAnalysisCoverage(updated);
    const savedRun: ProjectRunRecord = {
      ...run,
      analysisVersion: coverage.version || undefined,
      analysisStatus: coverage.status,
      analysisCompletedObservationCount: coverage.completedAnalysisCount,
      analysisIncompleteObservationCount: coverage.incompleteAnalysisCount,
      analysisCoverage: coverage,
    };
    await this.store.saveObservations(projectId, runId, updated);
    await this.store.saveRun(savedRun);
    return { run: savedRun, observations: updated };
  }
}
