import type { AuditRun, Citation, Mention, MonitoringPrompt, PromptAuditCategory, PromptRun } from "../core/types.js";
import { sha256 } from "../utils/hash.js";
import type { Observation, ObservationBuildInput, ObservationEvidenceSummary } from "./observation-schema.js";
import { buildObservationAnalysisResult } from "./analysis-qualification.js";

function auditCategory(prompt: MonitoringPrompt): PromptAuditCategory {
  return prompt.auditCategory || "other";
}

function uniqueNames(mentions: Mention[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const mention of mentions) {
    if (!mention.isMentioned) continue;
    if (mention.entityType !== "competitor") continue;
    const name = mention.entityName.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function evidenceSummary(mentions: Mention[], citations: Citation[], answerText: string): ObservationEvidenceSummary {
  const targetMentioned = mentions.some((mention) => mention.entityType === "target" && mention.isMentioned);
  const officialCitationCount = citations.filter((citation) => citation.citationType === "target_official" || citation.citationType === "target_github").length;
  return {
    hasAnswer: Boolean(answerText.trim()),
    targetMentioned,
    mentionedCompetitors: uniqueNames(mentions),
    citationCount: citations.length,
    officialCitationCount,
  };
}

function observationId(input: ObservationBuildInput): string {
  return `obs-${sha256(`${input.projectId}:${input.baselineId}:${input.auditRunId}:${input.promptRun.id}`).slice(0, 20)}`;
}

export class ObservationBuilder {
  fromPromptRun(input: ObservationBuildInput): Observation {
    const run = input.promptRun;
    const citations = run.analysis?.citations || run.result?.citations || [];
    const mentions = run.analysis?.mentions || [];
    const observation: Observation = {
      id: observationId(input),
      projectId: input.projectId,
      baselineId: input.baselineId,
      runId: input.runId,
      auditRunId: input.auditRunId,
      promptId: input.prompt.id,
      sampleIndex: run.sampleIndex || 1,
      sampleCount: run.sampleCount || 1,
      promptText: input.prompt.text,
      promptType: input.prompt.type,
      promptAuditCategory: auditCategory(input.prompt),
      targetIncluded: Boolean(input.prompt.targetIncluded),
      keywordIds: [...(input.prompt.keywordIds || [])],
      providerId: run.providerId,
      model: run.model,
      language: input.prompt.language,
      sourceType: run.sourceType,
      sourceLabel: run.sourceLabel,
      webSearchEnabled: run.webSearchEnabled,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      citations,
      mentions,
      evidence: run.status === "completed" && run.result
        ? evidenceSummary(mentions, citations, run.result.text)
        : {
            hasAnswer: false,
            targetMentioned: false,
            mentionedCompetitors: [],
            citationCount: citations.length,
            officialCitationCount: 0,
          },
    };
    if (run.search) observation.search = run.search;
    if (input.prompt.brandQuestion) observation.brandQuestion = input.prompt.brandQuestion;
    if (input.prompt.intentProfile) observation.promptIntent = input.prompt.intentProfile;
    if (run.result?.text) observation.answerText = run.result.text;
    if (run.analysis) observation.analysis = run.analysis;
    if (run.intentAnalysis) observation.intentAnalysis = run.intentAnalysis;
    if (run.error) observation.error = run.error;
    const qualification = buildObservationAnalysisResult({
      status: observation.status,
      answerText: observation.answerText,
      analysis: observation.analysis,
      intentAnalysis: observation.intentAnalysis,
      promptIntent: observation.promptIntent,
      mentions: observation.mentions,
      citations: observation.citations,
    });
    observation.analysisVersion = qualification.analysisVersion;
    observation.analysisStatus = qualification.analysisStatus;
    observation.analysisResult = qualification.analysisResult;
    return observation;
  }

  fromAuditRun(input: { projectId: string; baselineId: string; runId: string; audit: AuditRun }): Observation[] {
    const prompts = new Map(input.audit.prompts.map((prompt) => [prompt.id, prompt]));
    return input.audit.runs.map((run) => {
      const prompt = prompts.get(run.prompt.id) || run.prompt;
      return this.fromPromptRun({
        projectId: input.projectId,
        baselineId: input.baselineId,
        auditRunId: input.audit.id,
        runId: input.runId,
        promptRun: run,
        prompt,
      });
    });
  }
}
