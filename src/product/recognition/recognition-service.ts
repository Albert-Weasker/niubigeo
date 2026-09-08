import { randomUUID } from "node:crypto";
import { resolveProviderKey } from "../../config/env.js";
import type { AnswerResult } from "../../core/types.js";
import { ProviderCatalog } from "../../providers/catalog.js";
import { providerFailureCode } from "../../providers/provider-error.js";
import { sha256 } from "../../utils/hash.js";
import type { ProductBaseline, ProductModelSnapshot } from "../configuration/baseline-schema.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductProjectService } from "../projects/project-service.js";
import { DOMAIN_RECOGNITION_SCHEMA_HASH, DOMAIN_RECOGNITION_SCHEMA_NAME, DOMAIN_RECOGNITION_TOOL_DESCRIPTION, domainRecognitionPrompt, domainRecognitionResponseSchema } from "./recognition-prompt.js";
import { RecognitionAnalysisError, RecognitionAttemptNotFoundError, RecognitionInputError, RecognitionModelRunNotFoundError, RecognitionRunNotFoundError } from "./recognition-errors.js";
import type {
  AnswerEvidenceLocation,
  AnswerMentionedUrl,
  BrandKeywordRecognition,
  ClaimCitationLink,
  CompetitorKeywordRecognition,
  CompetitorRecognition,
  ProviderCitation,
  RecognitionArchive,
  RecognitionAnalysisRevision,
  RecognitionClaim,
  RecognitionClaimType,
  RecognitionModelRun,
  RecognitionModelRunAttempt,
  RecognitionModelRunDetail,
  RecognitionRequestParameters,
  RecognitionResult,
  RecognitionRun,
  RecognitionRunDetail,
} from "./recognition-schema.js";
import { ProductRecognitionFileStore } from "./recognition-store.js";
import { buildRecognitionModelRunPresentation } from "./recognition-presentation.js";
import { parseStructuredRecognitionOutput, RECOGNITION_ANALYZER_VERSION, type StructuredRecognitionKeyword, type StructuredRecognitionOutput, type StructuredRecognitionValue } from "./structured-recognition-output.js";

const DEFAULT_MAX_TOKENS = 900;
const TRUNCATION_RETRY_MAX_TOKENS = 2000;
const DEFAULT_TEMPERATURE = 0;

export interface RecognitionAnswerExecutor {
  execute(input: {
    baseline: ProductBaseline;
    modelSnapshot: ProductModelSnapshot;
    prompt: string;
    requestParameters: RecognitionRequestParameters;
    executionContext?: RecognitionExecutionContext | undefined;
    structuredOutput?: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
    } | undefined;
  }): Promise<AnswerResult>;
}

export interface RecognitionExecutionContext {
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  probeRunId?: string | undefined;
}

export class OpenRouterRecognitionAnswerExecutor implements RecognitionAnswerExecutor {
  constructor(private readonly providers: ProviderCatalog = new ProviderCatalog()) {}

  async execute(input: {
    baseline: ProductBaseline;
    modelSnapshot: ProductModelSnapshot;
    prompt: string;
    requestParameters: RecognitionRequestParameters;
    executionContext?: RecognitionExecutionContext | undefined;
    structuredOutput?: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
    } | undefined;
  }): Promise<AnswerResult> {
    const structuredOutput = input.structuredOutput || {
      name: DOMAIN_RECOGNITION_SCHEMA_NAME,
      description: DOMAIN_RECOGNITION_TOOL_DESCRIPTION,
      schema: domainRecognitionResponseSchema,
    };
    return this.providers.get("openrouter").run({
      prompt: input.prompt,
      model: input.modelSnapshot.modelId,
      apiKey: resolveProviderKey("openrouter"),
      maxTokens: input.requestParameters.maxTokens,
      temperature: input.requestParameters.temperature,
      webSearchEnabled: input.requestParameters.webSearchEnabled,
      webSearchMode: input.requestParameters.webSearchMode === "provider_native" ? "provider_native" : undefined,
      ...(input.requestParameters.structuredOutputTransport === "function_tool"
        ? {
            structuredOutputTool: {
              name: structuredOutput.name,
              description: structuredOutput.description,
              schema: structuredOutput.schema,
            },
          }
        : {
            responseJsonSchema: {
              name: structuredOutput.name,
              schema: structuredOutput.schema,
            },
          }),
      requireProviderParameters: input.requestParameters.requireProviderParameters,
    });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function answerWasTruncated(rawProviderResponse: unknown): boolean {
  const root = rawProviderResponse && typeof rawProviderResponse === "object" && !Array.isArray(rawProviderResponse) ? rawProviderResponse as Record<string, unknown> : null;
  if (!root) return false;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices.length > 0 && typeof choices[0] === "object" && !Array.isArray(choices[0]) ? choices[0] as Record<string, unknown> : null;
  const normalizeReason = (value: unknown): string => typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  const finishReason = normalizeReason(firstChoice?.finish_reason);
  const nativeFinishReason = normalizeReason(firstChoice?.native_finish_reason);
  if (finishReason === "length" || finishReason === "max_tokens" || nativeFinishReason === "length" || nativeFinishReason === "max_tokens" || nativeFinishReason === "max_output_tokens") return true;
  const incompleteDetails = root.incomplete_details && typeof root.incomplete_details === "object" && !Array.isArray(root.incomplete_details)
    ? root.incomplete_details as Record<string, unknown>
    : null;
  const incompleteReason = normalizeReason(incompleteDetails?.reason);
  return normalizeReason(root.status) === "incomplete"
    && (incompleteReason === "length" || incompleteReason === "max_tokens" || incompleteReason === "max_output_tokens");
}

function recognitionMode(snapshot: ProductModelSnapshot): "unaided_domain_recognition" | "native_web_domain_discovery" {
  return snapshot.webSearchMode === "provider_native" ? "native_web_domain_discovery" : "unaided_domain_recognition";
}

function requestParameters(snapshot: ProductModelSnapshot): RecognitionRequestParameters {
  return {
    model: snapshot.modelId,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    responseSchemaName: DOMAIN_RECOGNITION_SCHEMA_NAME,
    responseSchemaHash: DOMAIN_RECOGNITION_SCHEMA_HASH,
    // Native search is an execution tool, not an output format. Keeping the
    // response schema independent lets the provider perform search and then
    // return one structured final answer instead of competing tool calls.
    structuredOutputTransport: "response_json_schema",
    requireProviderParameters: true,
    webSearchEnabled: snapshot.webSearchMode === "provider_native",
    webSearchMode: snapshot.webSearchMode,
  };
}

function evidence(answer: string, quote: string | null): AnswerEvidenceLocation | null {
  if (!quote) return null;
  const start = answer.indexOf(quote);
  if (start === -1) return null;
  return { quote, start, end: start + quote.length, encoding: "utf16_code_unit" };
}

function normalizedKeyword(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function claim(answer: string, value: string | null): RecognitionClaim {
  return { value, evidence: evidence(answer, value) };
}

function normalUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function providerCitations(answer: AnswerResult, parent: { projectId: string; runId: string; modelRunId: string; attemptId: string }): ProviderCitation[] {
  if (!answer.search?.requested) return [];
  const results: ProviderCitation[] = [];
  for (const citation of answer.citations) {
    if (citation.source === "answer_text_url") continue;
    if (!citation.title || !citation.providerPayloadPath) continue;
    results.push({
      id: randomUUID(),
      ...parent,
      url: normalUrl(citation.url),
      domain: citation.domain,
      title: citation.title,
      providerCitationSource: citation.source,
      providerCitationIndex: citation.citationIndex,
      providerPayloadPath: citation.providerPayloadPath,
      createdAt: nowIso(),
    });
  }
  return results;
}

function answerMentionedUrls(answer: AnswerResult, parent: { projectId: string; runId: string; modelRunId: string; attemptId: string }): AnswerMentionedUrl[] {
  const results: AnswerMentionedUrl[] = [];
  const seen = new Set<string>();
  for (const citation of answer.citations) {
    if (citation.source !== "answer_text_url") continue;
    const url = normalUrl(citation.url);
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({
      id: randomUUID(),
      ...parent,
      url,
      domain: citation.domain,
      evidence: evidence(answer.text, citation.url),
      createdAt: nowIso(),
    });
  }
  return results;
}

function citationMap(citations: ProviderCitation[]): Map<string, ProviderCitation> {
  return new Map(citations.map((citation) => [normalUrl(citation.url), citation]));
}

function linksForUrls(input: {
  urls: string[];
  citations: Map<string, ProviderCitation>;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  claimType: RecognitionClaimType;
  claimEntityId: string;
}): ClaimCitationLink[] {
  const links: ClaimCitationLink[] = [];
  const seen = new Set<string>();
  for (const value of input.urls) {
    const citation = input.citations.get(normalUrl(value));
    if (!citation || seen.has(citation.id)) continue;
    seen.add(citation.id);
    links.push({
      id: randomUUID(),
      projectId: input.projectId,
      runId: input.runId,
      modelRunId: input.modelRunId,
      attemptId: input.attemptId,
      recognitionResultId: input.recognitionResultId,
      providerCitationId: citation.id,
      claimType: input.claimType,
      claimEntityId: input.claimEntityId,
      createdAt: nowIso(),
    });
  }
  return links;
}

function updateClaimLinks(input: {
  links: ClaimCitationLink[];
  value: StructuredRecognitionValue;
  citations: Map<string, ProviderCitation>;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  claimType: RecognitionClaimType;
  claimEntityId: string;
}): void {
  input.links.push(...linksForUrls({
    urls: input.value.citationUrls,
    citations: input.citations,
    projectId: input.projectId,
    runId: input.runId,
    modelRunId: input.modelRunId,
    attemptId: input.attemptId,
    recognitionResultId: input.recognitionResultId,
    claimType: input.claimType,
    claimEntityId: input.claimEntityId,
  }));
}

function updateKeywordLinks(input: {
  links: ClaimCitationLink[];
  keyword: StructuredRecognitionKeyword;
  citations: Map<string, ProviderCitation>;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionResultId: string;
  claimType: RecognitionClaimType;
  claimEntityId: string;
}): void {
  input.links.push(...linksForUrls({
    urls: input.keyword.citationUrls,
    citations: input.citations,
    projectId: input.projectId,
    runId: input.runId,
    modelRunId: input.modelRunId,
    attemptId: input.attemptId,
    recognitionResultId: input.recognitionResultId,
    claimType: input.claimType,
    claimEntityId: input.claimEntityId,
  }));
}

function archiveFromOutput(input: {
  answer: AnswerResult;
  output: StructuredRecognitionOutput;
  recognitionMode: "unaided_domain_recognition" | "native_web_domain_discovery";
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  preservedEvidence?: Pick<RecognitionArchive, "providerCitations" | "answerMentionedUrls"> | undefined;
}): RecognitionArchive {
  const { answer, output, projectId, runId, modelRunId, attemptId } = input;
  const createdAt = nowIso();
  const parent = { projectId, runId, modelRunId, attemptId };
  const result: RecognitionResult = {
    id: randomUUID(),
    ...parent,
    recognitionMode: input.recognitionMode,
    analysisStatus: output.analysisStatus,
    domainRecognition: output.domainRecognition,
    recognizedBrand: claim(answer.text, output.recognizedBrand.value),
    businessDescription: claim(answer.text, output.businessDescription.value),
    productCategory: claim(answer.text, output.productCategory.value),
    detailedDescription: claim(answer.text, output.detailedDescription.value),
    unknowns: output.unknowns,
    fieldIssues: output.fieldIssues,
    mappingVersion: output.mappingVersion,
    createdAt,
  };
  const providerCitationRows = input.preservedEvidence ? input.preservedEvidence.providerCitations : providerCitations(answer, parent);
  const citationByUrl = citationMap(providerCitationRows);
  const claimCitationLinks: ClaimCitationLink[] = [];
  updateClaimLinks({ links: claimCitationLinks, value: output.recognizedBrand, citations: citationByUrl, ...parent, recognitionResultId: result.id, claimType: "recognized_brand", claimEntityId: result.id });
  updateClaimLinks({ links: claimCitationLinks, value: output.businessDescription, citations: citationByUrl, ...parent, recognitionResultId: result.id, claimType: "business_description", claimEntityId: result.id });
  updateClaimLinks({ links: claimCitationLinks, value: output.productCategory, citations: citationByUrl, ...parent, recognitionResultId: result.id, claimType: "product_category", claimEntityId: result.id });

  const competitors: CompetitorRecognition[] = [];
  const competitorKeywords: CompetitorKeywordRecognition[] = [];
  for (const item of output.competitors) {
    const row: CompetitorRecognition = {
      id: randomUUID(),
      ...parent,
      recognitionResultId: result.id,
      name: item.name,
      domain: item.domain,
      businessDescription: claim(answer.text, item.businessDescription),
      productCategory: claim(answer.text, item.productCategory),
      evidence: evidence(answer.text, item.name),
      createdAt,
    };
    competitors.push(row);
    claimCitationLinks.push(...linksForUrls({
      urls: item.citationUrls,
      citations: citationByUrl,
      ...parent,
      recognitionResultId: result.id,
      claimType: "competitor",
      claimEntityId: row.id,
    }));
    for (const itemKeyword of item.keywords) {
      const keyword: CompetitorKeywordRecognition = {
        id: randomUUID(),
        ...parent,
        recognitionResultId: result.id,
        competitorRecognitionId: row.id,
        competitorName: row.name,
        competitorDomain: row.domain,
        keyword: itemKeyword.keyword,
        normalizedKeyword: normalizedKeyword(itemKeyword.keyword),
        evidence: evidence(answer.text, itemKeyword.keyword),
        createdAt,
      };
      competitorKeywords.push(keyword);
      updateKeywordLinks({ links: claimCitationLinks, keyword: itemKeyword, citations: citationByUrl, ...parent, recognitionResultId: result.id, claimType: "competitor_keyword", claimEntityId: keyword.id });
    }
  }

  const brandKeywords: BrandKeywordRecognition[] = [];
  for (const item of output.brandKeywords) {
    const keyword: BrandKeywordRecognition = {
      id: randomUUID(),
      ...parent,
      recognitionResultId: result.id,
      keyword: item.keyword,
      normalizedKeyword: normalizedKeyword(item.keyword),
      evidence: evidence(answer.text, item.keyword),
      createdAt,
    };
    brandKeywords.push(keyword);
    updateKeywordLinks({ links: claimCitationLinks, keyword: item, citations: citationByUrl, ...parent, recognitionResultId: result.id, claimType: "brand_keyword", claimEntityId: keyword.id });
  }

  return {
    result,
    competitors,
    brandKeywords,
    competitorKeywords,
    providerCitations: providerCitationRows,
    answerMentionedUrls: input.preservedEvidence ? input.preservedEvidence.answerMentionedUrls : answerMentionedUrls(answer, parent),
    claimCitationLinks,
  };
}

function analysisFailedArchive(input: {
  answer: AnswerResult;
  projectId: string;
  runId: string;
  modelRunId: string;
  attemptId: string;
  recognitionMode: "unaided_domain_recognition" | "native_web_domain_discovery";
  message: string;
  preservedEvidence?: Pick<RecognitionArchive, "providerCitations" | "answerMentionedUrls"> | undefined;
}): RecognitionArchive {
  const createdAt = nowIso();
  const parent = {
    projectId: input.projectId,
    runId: input.runId,
    modelRunId: input.modelRunId,
    attemptId: input.attemptId,
  };
  const providerCitationRows = input.preservedEvidence ? input.preservedEvidence.providerCitations : providerCitations(input.answer, parent);
  return {
    result: {
      id: randomUUID(),
      projectId: input.projectId,
      runId: input.runId,
      modelRunId: input.modelRunId,
      attemptId: input.attemptId,
      recognitionMode: input.recognitionMode,
      analysisStatus: "analysis_failed",
      domainRecognition: null,
      recognizedBrand: { value: null, evidence: null },
      businessDescription: { value: null, evidence: null },
      productCategory: { value: null, evidence: null },
      unknowns: [input.message],
      createdAt,
    },
    competitors: [],
    brandKeywords: [],
    competitorKeywords: [],
    providerCitations: providerCitationRows,
    answerMentionedUrls: input.preservedEvidence ? input.preservedEvidence.answerMentionedUrls : answerMentionedUrls(input.answer, parent),
    claimCitationLinks: [],
  };
}

function attemptStatusForFailure(code: string): "provider_failed" | "unsupported" {
  return code === "unsupported_capability" ? "unsupported" : "provider_failed";
}

function modelStatusForFailure(code: string): "failed" | "unsupported" {
  return code === "unsupported_capability" ? "unsupported" : "failed";
}

function successfulModelRun(status: RecognitionModelRun["status"]): boolean {
  return status === "completed";
}

export class ProductRecognitionRunService {
  private readonly startLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly store: ProductRecognitionFileStore,
    private readonly executor: RecognitionAnswerExecutor = new OpenRouterRecognitionAnswerExecutor(),
  ) {}

  async start(projectId: string, input: string | { idempotencyKey?: string; modelIds?: string[] } = {}): Promise<RecognitionRunDetail> {
    const request = typeof input === "string" ? { idempotencyKey: input } : input;
    return this.withStartLock(projectId, () => this.startUnlocked(projectId, request));
  }

  private async withStartLock<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.startLocks.get(projectId) || Promise.resolve();
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = previous.then(() => hold);
    this.startLocks.set(projectId, queue);
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
      if (this.startLocks.get(projectId) === queue) this.startLocks.delete(projectId);
    }
  }

  private async startUnlocked(projectId: string, input: { idempotencyKey?: string; modelIds?: string[] }): Promise<RecognitionRunDetail> {
    const project = await this.projects.get(projectId);
    if (!project.activeBaselineId) throw new RecognitionInputError("Save a monitoring configuration before starting recognition.");
    const baseline = await this.baselines.get(projectId, project.activeBaselineId);
    const requestedModelIds = input.modelIds ? new Set(input.modelIds) : null;
    const modelSnapshots = requestedModelIds
      ? baseline.modelSnapshots.filter((item) => requestedModelIds.has(item.modelId))
      : baseline.modelSnapshots;
    if (requestedModelIds && modelSnapshots.length !== requestedModelIds.size) {
      throw new RecognitionInputError("A requested recognition model is not part of the current monitoring configuration.");
    }
    if (modelSnapshots.length === 0) throw new RecognitionInputError("The current monitoring configuration has no models.");
    const existing = await this.store.listRuns(projectId);
    if (input.idempotencyKey) {
      const duplicate = existing.find((run) => run.idempotencyKey === input.idempotencyKey);
      if (duplicate) return this.get(projectId, duplicate.id);
    }
    if (existing.some((run) => run.status === "queued" || run.status === "running")) {
      throw new RecognitionInputError("A recognition run is already in progress for this project.");
    }

    const createdAt = nowIso();
    const run: RecognitionRun = {
      id: randomUUID(),
      projectId,
      baselineId: baseline.id,
      baselineVersion: baseline.version,
      status: "queued",
      plannedModelRunCount: modelSnapshots.length,
      successfulModelRunCount: 0,
      failedModelRunCount: 0,
      idempotencyKey: input.idempotencyKey,
      createdAt,
    };
    await this.store.saveRun(run);
    const modelRuns: RecognitionModelRun[] = modelSnapshots.map((modelSnapshot) => ({
      id: randomUUID(),
      projectId,
      runId: run.id,
      baselineId: baseline.id,
      modelSnapshot,
      recognitionMode: recognitionMode(modelSnapshot),
      status: "queued",
      attemptIds: [],
      createdAt,
    }));
    await Promise.all(modelRuns.map((modelRun) => this.store.saveModelRun(modelRun)));
    void this.executeRun(run, baseline, modelRuns);
    return { run, modelRuns };
  }

  async list(projectId: string): Promise<RecognitionRun[]> {
    await this.projects.get(projectId);
    return this.store.listRuns(projectId);
  }

  async get(projectId: string, runId: string): Promise<RecognitionRunDetail> {
    await this.projects.get(projectId);
    const run = await this.store.readRun(projectId, runId);
    if (!run) throw new RecognitionRunNotFoundError(runId);
    return { run, modelRuns: await this.store.listModelRuns(projectId, runId) };
  }

  async getModelRun(projectId: string, runId: string, modelRunId: string): Promise<RecognitionModelRunDetail> {
    await this.projects.get(projectId);
    const run = await this.store.readRun(projectId, runId);
    if (!run) throw new RecognitionRunNotFoundError(runId);
    const modelRun = await this.store.readModelRun(projectId, runId, modelRunId);
    if (!modelRun) throw new RecognitionModelRunNotFoundError(modelRunId);
    const attempts = await this.store.listAttempts(projectId, runId, modelRunId);
    const archives = await this.store.listArchives(projectId, runId, modelRunId);
    const analysisRevisions = await this.store.listAnalysisRevisions(projectId, runId, modelRunId);
    const currentAnalysis = analysisRevisions.length ? analysisRevisions[analysisRevisions.length - 1] : undefined;
    const archive = currentAnalysis?.archive || archives.find((item) => item.result.attemptId === modelRun.currentAttemptId);
    return {
      modelRun,
      attempts,
      archives,
      analysisRevisions,
      ...(currentAnalysis ? { currentAnalysis } : {}),
      archive,
      presentation: buildRecognitionModelRunPresentation({ modelRun, attempts, archive, ...(currentAnalysis ? { currentAnalysis } : {}) }),
    };
  }

  async getAttempt(projectId: string, runId: string, modelRunId: string, attemptId: string): Promise<{ attempt: RecognitionModelRunAttempt; archive?: RecognitionArchive | undefined }> {
    await this.getModelRun(projectId, runId, modelRunId);
    const attempt = await this.store.readAttempt(projectId, runId, modelRunId, attemptId);
    if (!attempt) throw new RecognitionAttemptNotFoundError(attemptId);
    return { attempt, archive: await this.store.readArchive(projectId, runId, modelRunId, attemptId) || undefined };
  }

  async reanalyze(projectId: string, runId: string, modelRunId: string, attemptId: string): Promise<RecognitionAnalysisRevision> {
    const detail = await this.getModelRun(projectId, runId, modelRunId);
    const attempt = detail.attempts.find((item) => item.id === attemptId);
    if (!attempt) throw new RecognitionAttemptNotFoundError(attemptId);
    if (!attempt.rawAnswer) throw new RecognitionInputError("This attempt has no saved answer to reanalyze.");
    const sourceRawAnswerHash = sha256(attempt.rawAnswer);
    const existing = detail.analysisRevisions.find((revision) => revision.attemptId === attempt.id && revision.sourceRawAnswerHash === sourceRawAnswerHash && revision.analyzerVersion === RECOGNITION_ANALYZER_VERSION);
    if (existing) return existing;

    const originalArchive = detail.archives.find((archive) => archive.result.attemptId === attempt.id);
    const answer = this.savedAnswerForReanalysis(detail.modelRun, attempt);
    let archive: RecognitionArchive;
    let status: RecognitionAnalysisRevision["status"];
    try {
      const output = parseStructuredRecognitionOutput(attempt.rawAnswer);
      archive = archiveFromOutput({
        answer,
        output,
        recognitionMode: detail.modelRun.recognitionMode,
        projectId,
        runId,
        modelRunId,
        attemptId,
        ...(originalArchive ? { preservedEvidence: originalArchive } : {}),
      });
      status = output.fieldIssues.length === 0 ? "complete" : "partial";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      archive = analysisFailedArchive({
        answer,
        projectId,
        runId,
        modelRunId,
        attemptId,
        recognitionMode: detail.modelRun.recognitionMode,
        message,
        ...(originalArchive ? { preservedEvidence: originalArchive } : {}),
      });
      status = "failed";
    }
    const revision: RecognitionAnalysisRevision = {
      id: randomUUID(),
      projectId,
      runId,
      modelRunId,
      attemptId,
      sourceRawAnswerHash,
      analyzerVersion: RECOGNITION_ANALYZER_VERSION,
      status,
      archive,
      createdAt: nowIso(),
    };
    await this.store.saveAnalysisRevision(revision);
    return revision;
  }

  async retry(projectId: string, runId: string, modelRunId: string): Promise<RecognitionModelRunDetail> {
    const detail = await this.getModelRun(projectId, runId, modelRunId);
    const retryable = new Set<RecognitionModelRun["status"]>(["failed", "unsupported"]);
    const analysisFailed = detail.archive?.result.analysisStatus === "analysis_failed";
    if (!retryable.has(detail.modelRun.status) && !analysisFailed) throw new RecognitionInputError("Only a failed, unsupported, or analysis-failed model run can be retried.");
    const baseline = await this.baselines.get(projectId, detail.modelRun.baselineId);
    const run = await this.store.readRun(projectId, runId);
    if (!run) throw new RecognitionRunNotFoundError(runId);
    await this.store.saveRun({ ...run, status: "running", completedAt: undefined });
    await this.executeModelRun(run, baseline, detail.modelRun);
    await this.updateRunStatus(projectId, runId);
    return this.getModelRun(projectId, runId, modelRunId);
  }

  private savedAnswerForReanalysis(modelRun: RecognitionModelRun, attempt: RecognitionModelRunAttempt): AnswerResult {
    return {
      providerId: attempt.providerId,
      providerName: "OpenRouter",
      sourceType: "api",
      sourceLabel: "Source: OpenRouter API",
      resultCaveat: "This record was locally reanalyzed from a saved Provider response.",
      model: attempt.providerModel || modelRun.modelSnapshot.modelId,
      modelVersion: attempt.providerModelVersion || attempt.providerModel || modelRun.modelSnapshot.modelId,
      text: attempt.rawAnswer || "",
      structuredOutput: { transport: attempt.requestParameters.structuredOutputTransport, value: attempt.rawAnswer || "" },
      rawProviderResponse: attempt.rawProviderResponse,
      citations: [],
      webQueries: [],
      tokenUsage: attempt.tokenUsage,
      costUsd: attempt.costUsd === null ? undefined : attempt.costUsd,
      latencyMs: attempt.latencyMs || 0,
      createdAt: attempt.createdAt,
    };
  }

  private async executeRun(run: RecognitionRun, baseline: ProductBaseline, modelRuns: RecognitionModelRun[]): Promise<void> {
    await this.store.saveRun({ ...run, status: "running", startedAt: nowIso() });
    await Promise.all(modelRuns.map((modelRun) => this.executeModelRun(run, baseline, modelRun)));
    await this.updateRunStatus(run.projectId, run.id);
  }

  private async executeModelRun(run: RecognitionRun, baseline: ProductBaseline, previous: RecognitionModelRun): Promise<void> {
    const attempts = await this.store.listAttempts(run.projectId, run.id, previous.id);
    const parameters = requestParameters(previous.modelSnapshot);
    const prompt = domainRecognitionPrompt({
      normalizedDomain: baseline.normalizedDomain,
      language: baseline.language,
      protocol: baseline.recognitionProtocol,
    });
    const attempt: RecognitionModelRunAttempt = {
      id: randomUUID(),
      projectId: run.projectId,
      runId: run.id,
      modelRunId: previous.id,
      attemptNumber: attempts.length + 1,
      status: "running",
      promptHash: sha256(prompt),
      requestParameters: parameters,
      providerId: "openrouter",
      costUsd: null,
      createdAt: nowIso(),
      startedAt: nowIso(),
    };
    const modelRun: RecognitionModelRun = {
      ...previous,
      status: "running",
      attemptIds: [...previous.attemptIds, attempt.id],
      currentAttemptId: attempt.id,
      startedAt: nowIso(),
      completedAt: undefined,
      errorCode: undefined,
      errorMessage: undefined,
    };
    await Promise.all([this.store.saveAttempt(attempt), this.store.saveModelRun(modelRun)]);
    if (modelRun.recognitionMode === "native_web_domain_discovery" && !modelRun.modelSnapshot.nativeWebSearchSupported) {
      const errorCode = "unsupported_capability";
      const errorMessage = "This model snapshot does not support Provider native web search.";
      await Promise.all([
        this.store.saveAttempt({ ...attempt, status: "unsupported", errorCode, errorMessage, costUsd: null, completedAt: nowIso() }),
        this.store.saveModelRun({ ...modelRun, status: "unsupported", errorCode, errorMessage, completedAt: nowIso() }),
      ]);
      return;
    }
    try {
      const answer = await this.executor.execute({
        baseline,
        modelSnapshot: modelRun.modelSnapshot,
        prompt,
        requestParameters: parameters,
        executionContext: {
          projectId: run.projectId,
          runId: run.id,
          modelRunId: modelRun.id,
          attemptId: attempt.id,
        },
      });
      const responseSaved: RecognitionModelRunAttempt = {
        ...attempt,
        status: "response_saved",
        rawProviderResponse: answer.rawProviderResponse === undefined ? null : answer.rawProviderResponse,
        rawAnswer: answer.text,
        providerModel: answer.model,
        providerModelVersion: answer.modelVersion,
        providerSearch: answer.search,
        tokenUsage: answer.tokenUsage,
        costUsd: answer.costUsd ?? null,
        latencyMs: answer.latencyMs,
      };
      await this.store.saveAttempt(responseSaved);
      try {
        if (!answer.structuredOutput) {
          throw new RecognitionAnalysisError("The provider did not return a structured recognition payload.");
        }
        const output = parseStructuredRecognitionOutput(answer.structuredOutput.value);
        const archive = archiveFromOutput({
          answer,
          output,
          recognitionMode: modelRun.recognitionMode,
          projectId: run.projectId,
          runId: run.id,
          modelRunId: modelRun.id,
          attemptId: attempt.id,
        });
        await this.store.saveArchive({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, archive });
        await Promise.all([
          this.store.saveAttempt({ ...responseSaved, status: output.analysisStatus === "unknown" ? "unknown" : "completed", completedAt: nowIso() }),
          this.store.saveModelRun({ ...modelRun, status: "completed", completedAt: nowIso() }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const truncated = answerWasTruncated(answer.rawProviderResponse);
        if (truncated && parameters.maxTokens < TRUNCATION_RETRY_MAX_TOKENS) {
          const retryParams: RecognitionRequestParameters = {
            ...parameters,
            maxTokens: TRUNCATION_RETRY_MAX_TOKENS,
          };
          const retryAttempt: RecognitionModelRunAttempt = {
            id: randomUUID(),
            projectId: run.projectId,
            runId: run.id,
            modelRunId: modelRun.id,
            attemptNumber: attempts.length + 2,
            status: "running",
            promptHash: sha256(prompt),
            requestParameters: retryParams,
            providerId: "openrouter",
            costUsd: null,
            createdAt: nowIso(),
            startedAt: nowIso(),
          };
          const retryModelRun: RecognitionModelRun = {
            ...modelRun,
            status: "running",
            attemptIds: [...attempts.map((a) => a.id), attempt.id, retryAttempt.id],
            currentAttemptId: retryAttempt.id,
            completedAt: undefined,
            errorCode: undefined,
            errorMessage: undefined,
          };
          await Promise.all([this.store.saveAttempt(retryAttempt), this.store.saveModelRun(retryModelRun)]);
          let retryAnswer: AnswerResult;
          try {
            retryAnswer = await this.executor.execute({
              baseline,
              modelSnapshot: modelRun.modelSnapshot,
              prompt,
              requestParameters: retryParams,
              executionContext: {
                projectId: run.projectId,
                runId: run.id,
                modelRunId: modelRun.id,
                attemptId: retryAttempt.id,
              },
            });
          } catch (error) {
            const retryCode = providerFailureCode(error);
            const retryMessage = error instanceof Error ? error.message : String(error);
            await Promise.all([
              this.store.saveAttempt({ ...retryAttempt, status: attemptStatusForFailure(retryCode), errorCode: retryCode, errorMessage: retryMessage, completedAt: nowIso() }),
              this.store.saveModelRun({ ...retryModelRun, status: modelStatusForFailure(retryCode), errorCode: retryCode, errorMessage: retryMessage, completedAt: nowIso() }),
            ]);
            return;
          }
          const retrySaved: RecognitionModelRunAttempt = {
            ...retryAttempt,
            status: "response_saved",
            rawProviderResponse: retryAnswer.rawProviderResponse === undefined ? null : retryAnswer.rawProviderResponse,
            rawAnswer: retryAnswer.text,
            providerModel: retryAnswer.model,
            providerModelVersion: retryAnswer.modelVersion,
            providerSearch: retryAnswer.search,
            tokenUsage: retryAnswer.tokenUsage,
            costUsd: retryAnswer.costUsd ?? null,
            latencyMs: retryAnswer.latencyMs,
          };
          await this.store.saveAttempt(retrySaved);
          if (retryAnswer.structuredOutput) {
            try {
              const retryOutput = parseStructuredRecognitionOutput(retryAnswer.structuredOutput.value);
              const retryArchive = archiveFromOutput({
                answer: retryAnswer,
                output: retryOutput,
                recognitionMode: modelRun.recognitionMode,
                projectId: run.projectId,
                runId: run.id,
                modelRunId: modelRun.id,
                attemptId: retryAttempt.id,
              });
              await this.store.saveArchive({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, archive: retryArchive });
              await Promise.all([
                this.store.saveAttempt({ ...retrySaved, status: retryOutput.analysisStatus === "unknown" ? "unknown" : "completed", completedAt: nowIso() }),
                this.store.saveModelRun({ ...retryModelRun, status: "completed", completedAt: nowIso() }),
              ]);
              return;
            } catch (retryError) {
              const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
              const retryArchive = analysisFailedArchive({
                answer: retryAnswer,
                projectId: run.projectId,
                runId: run.id,
                modelRunId: modelRun.id,
                attemptId: retryAttempt.id,
                recognitionMode: modelRun.recognitionMode,
                message: retryMessage,
              });
              await this.store.saveArchive({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, archive: retryArchive });
              await Promise.all([
                this.store.saveAttempt({ ...retrySaved, status: "analysis_failed", errorCode: "analysis_failed", errorMessage: retryMessage, completedAt: nowIso() }),
                this.store.saveModelRun({ ...retryModelRun, status: "completed", errorCode: "analysis_failed", errorMessage: retryMessage, completedAt: nowIso() }),
              ]);
              return;
            }
          }
          const retryArchive = analysisFailedArchive({
            answer: retryAnswer,
            projectId: run.projectId,
            runId: run.id,
            modelRunId: modelRun.id,
            attemptId: retryAttempt.id,
            recognitionMode: modelRun.recognitionMode,
            message: "The retried provider response did not include a structured recognition payload.",
          });
          await this.store.saveArchive({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, archive: retryArchive });
          await Promise.all([
            this.store.saveAttempt({ ...retrySaved, status: "analysis_failed", errorCode: "analysis_failed", errorMessage: "The retried provider response did not include a structured recognition payload.", completedAt: nowIso() }),
            this.store.saveModelRun({ ...retryModelRun, status: "completed", errorCode: "analysis_failed", errorMessage: "The retried provider response did not include a structured recognition payload.", completedAt: nowIso() }),
          ]);
          return;
        }
        const archive = analysisFailedArchive({
          answer,
          projectId: run.projectId,
          runId: run.id,
          modelRunId: modelRun.id,
          attemptId: attempt.id,
          recognitionMode: modelRun.recognitionMode,
          message,
        });
        await this.store.saveArchive({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, archive });
        await Promise.all([
          this.store.saveAttempt({ ...responseSaved, status: "analysis_failed", errorCode: "analysis_failed", errorMessage: message, completedAt: nowIso() }),
          this.store.saveModelRun({ ...modelRun, status: "completed", errorCode: "analysis_failed", errorMessage: message, completedAt: nowIso() }),
        ]);
      }
    } catch (error) {
      const code = providerFailureCode(error);
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all([
        this.store.saveAttempt({ ...attempt, status: attemptStatusForFailure(code), errorCode: code, errorMessage: message, completedAt: nowIso() }),
        this.store.saveModelRun({ ...modelRun, status: modelStatusForFailure(code), errorCode: code, errorMessage: message, completedAt: nowIso() }),
      ]);
    }
  }

  private async updateRunStatus(projectId: string, runId: string): Promise<void> {
    const run = await this.store.readRun(projectId, runId);
    if (!run) return;
    const modelRuns = await this.store.listModelRuns(projectId, runId);
    const succeeded = modelRuns.filter((modelRun) => successfulModelRun(modelRun.status)).length;
    const failed = modelRuns.length - succeeded;
    const complete = modelRuns.length === run.plannedModelRunCount && modelRuns.every((modelRun) => modelRun.status !== "queued" && modelRun.status !== "running");
    const status = !complete ? "running" : succeeded === modelRuns.length ? "completed" : succeeded > 0 ? "partial" : "failed";
    await this.store.saveRun({
      ...run,
      status,
      successfulModelRunCount: succeeded,
      failedModelRunCount: failed,
      startedAt: run.startedAt || nowIso(),
      completedAt: complete ? nowIso() : undefined,
    });
  }
}
