import { answerAssessorInstructions } from "./answer-assessor.js";
import { entityRelationshipAnalyzerInstructions } from "./entity-relationship-analyzer.js";
import { intentAnalyzerInstructions } from "./intent-analyzer.js";
import type { IntentPipelineInput, ProviderCitationView } from "./intent-report-model.js";
import { parseJsonObjectFromText } from "./json-parser.js";
import { resultAdapterInstructions } from "./result-adapter.js";
import { taskDecomposerInstructions } from "./task-decomposer.js";
import { failedIntentRunAnalysis, validateIntentRunAnalysis, type IntentRunAnalysis } from "./intent-schema.js";
import { runProviderWithRetry } from "../providers/provider-retry.js";

const DEFAULT_ANALYSIS_MAX_TOKENS = 3200;

function maxTokens(): number {
  const configured = Number(process.env.INTENT_ANALYSIS_MAX_TOKENS || DEFAULT_ANALYSIS_MAX_TOKENS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_ANALYSIS_MAX_TOKENS;
  return Math.max(1200, Math.min(Math.floor(configured), 4000));
}

function compactText(value: string, limit: number): string {
  const parts: string[] = [];
  let previousWasSpace = false;
  for (const char of value) {
    const isSpace = char === " " || char === "\n" || char === "\t" || char === "\r";
    if (isSpace) {
      if (!previousWasSpace) parts.push(" ");
      previousWasSpace = true;
    } else {
      parts.push(char);
      previousWasSpace = false;
    }
    if (parts.length >= limit) break;
  }
  return parts.join("").trim();
}

function citationViews(input: IntentPipelineInput): ProviderCitationView[] {
  const seen = new Set<string>();
  const out: ProviderCitationView[] = [];
  for (const citation of input.citations) {
    if (!citation.url || seen.has(citation.url)) continue;
    seen.add(citation.url);
    const row: ProviderCitationView = {
      url: citation.url,
      domain: citation.domain,
    };
    if (citation.title) row.title = citation.title;
    out.push(row);
    if (out.length >= 20) break;
  }
  return out;
}

function analysisPrompt(input: IntentPipelineInput): string {
  return [
    "You are NiubiGEO's intent result layer for one completed provider answer.",
    "Return only one valid JSON object. Do not wrap it in markdown.",
    "All conclusions must be grounded in the actual AI answer or supplied provider citations.",
    "Do not add facts, entities, competitors, strategies, or source URLs that are not present in the input.",
    "Do not treat co-occurring names as competitors unless the answer establishes that relationship.",
    "Write all user-facing strings in the language indicated by Language context.",
    "Use the field contract below as structure only; it is not example data.",
    "Keep the JSON compact. Use at most six tasks and at most eight entities.",
    "Keep each explanation under 120 characters. Keep oneSentence under 80 Chinese characters or 140 English characters.",
    "If you cannot copy an exact evidenceQuote from the actual answer, omit evidenceQuote for that item.",
    "",
    intentAnalyzerInstructions(),
    "",
    taskDecomposerInstructions(),
    "",
    answerAssessorInstructions(),
    "",
    entityRelationshipAnalyzerInstructions(),
    "",
    resultAdapterInstructions(),
    "",
    "Target brand:",
    JSON.stringify({
      name: input.target.name,
      domain: input.target.domain,
      aliases: input.target.aliases,
      githubRepo: input.target.githubRepo,
    }),
    "",
    "Language context:",
    input.language,
    "",
    "User question:",
    input.userQuestion,
    "",
    "Actual AI answer:",
    compactText(input.answerText, 12000),
    "",
    "Provider citations:",
    JSON.stringify(citationViews(input)),
    "",
    "Required JSON field contract:",
    "Top-level object fields: promptIntent, tasks, answerAssessment, entities, adaptedResult.",
    "promptIntent fields: primaryIntent, secondaryIntents, requestedOutputs, targetBrandRole, requiresSources, requiresComparison, requiresRecommendation, uncertainty.",
    "tasks: array of objects with id, requirement, expectedAnswerType.",
    "answerAssessment fields: taskResults, overallAnswerQuality, missingRequirements.",
    "taskResults: array of objects with taskId, status, evidenceQuote, explanation, sourceUrls.",
    "entities: array of objects with name, entityType, relationshipToQuestion, relationshipToTarget, confidence, evidenceQuote, explanation, sourceUrls.",
    "adaptedResult fields: displayMode, oneSentence, userQuestion, answered, missing, uncertain, entityInsights.",
  ].join("\n");
}

function shouldRetryWithoutJsonFormat(error: string): boolean {
  const text = error.toLowerCase();
  if (text.includes("credit")) return false;
  if (text.includes("quota")) return false;
  if (text.includes("billing")) return false;
  if (text.includes("rate limit")) return false;
  if (text.includes("unauthorized")) return false;
  if (text.includes("forbidden")) return false;
  return true;
}

export class IntentResultPipeline {
  private async runAnalyzer(input: IntentPipelineInput, useJsonFormat: boolean): Promise<unknown> {
    const result = await runProviderWithRetry(input.provider, {
      prompt: analysisPrompt(input),
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: maxTokens(),
      temperature: 0,
      webSearchEnabled: false,
      webSearchMode: "auto",
      responseFormat: useJsonFormat ? "json_object" : undefined,
    });
    return parseJsonObjectFromText(result.text);
  }

  async analyze(input: IntentPipelineInput): Promise<IntentRunAnalysis> {
    const context = {
      userQuestion: input.userQuestion,
      language: input.language,
      answerText: input.answerText,
      citationUrls: input.citations.map((citation) => citation.url),
      analyzer: {
        providerId: input.provider.definition.id,
        model: input.model,
        sourceLabel: `Source: ${input.provider.definition.label} API`,
      },
    };

    const wantsJsonFormat = Boolean(input.provider.definition.supportsAnyModel);
    try {
      const parsed = await this.runAnalyzer(input, wantsJsonFormat);
      return validateIntentRunAnalysis(parsed, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (wantsJsonFormat && shouldRetryWithoutJsonFormat(message)) {
        try {
          const parsed = await this.runAnalyzer(input, false);
          return validateIntentRunAnalysis(parsed, context);
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          return failedIntentRunAnalysis(context, fallbackMessage);
        }
      }
      return failedIntentRunAnalysis(context, message);
    }
  }
}
