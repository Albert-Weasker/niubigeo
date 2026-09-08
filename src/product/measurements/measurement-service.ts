import { randomUUID } from "node:crypto";
import { sha256 } from "../../utils/hash.js";
import type { AnswerResult, Citation } from "../../core/types.js";
import { providerFailureCode } from "../../providers/provider-error.js";
import type { ProductBaseline, ProductModelSnapshot } from "../configuration/baseline-schema.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductProjectService } from "../projects/project-service.js";
import type { RecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import { OpenRouterRecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import { DOMAIN_RECOGNITION_SCHEMA_NAME, DOMAIN_RECOGNITION_TOOL_DESCRIPTION, domainRecognitionPrompt, domainRecognitionResponseSchema } from "../recognition/recognition-prompt.js";
import { parseStructuredRecognitionOutput } from "../recognition/structured-recognition-output.js";
import type { AnswerMentionedUrl, ProviderCitation } from "../recognition/recognition-schema.js";
import { extractDomainFromUrl, normalizeDomain } from "../../utils/domain.js";
import { KEYWORD_DISCOVERY_SCHEMA_HASH, KEYWORD_DISCOVERY_SCHEMA_NAME, KEYWORD_DISCOVERY_TOOL_DESCRIPTION, evidenceLocation, keywordDiscoveryPrompt, keywordDiscoveryResponseSchema, parseKeywordDiscoveryOutput } from "./keyword-discovery-protocol.js";
import { ProductMeasurementFileStore } from "./measurement-store.js";
import type {
  DomainProbeResult,
  KeywordDiscoveryMention,
  KeywordDiscoveryResult,
  MeasurementBudget,
  MeasurementModelRun,
  MeasurementRun,
  ProbeAttempt,
  ProbeEvidenceArchive,
  ProbeFingerprint,
  ProbeRun,
  ProbeRequestParameters,
  WatchObject,
  WatchSet,
} from "./measurement-schema.js";
import { DOMAIN_PROTOCOL_ID, KEYWORD_PROTOCOL_ID } from "./measurement-schema.js";
import { ProductWatchSetService } from "./watchset-service.js";

const DEFAULT_BUDGET: MeasurementBudget = { requestLimit: 100, dailyRequestLimit: null, tokenLimit: null, costLimitUsd: null };
const DEFAULT_MAX_TOKENS = 900;
const DEFAULT_TEMPERATURE = 0;

function now(): string { return new Date().toISOString(); }
function normalized(value: string): string { return value.trim().toLocaleLowerCase(); }

function parameters(model: ProductModelSnapshot, schemaName: string, schemaHash: string): ProbeRequestParameters {
  return {
    model: model.modelId,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    requireProviderParameters: true,
    responseSchemaName: schemaName,
    responseSchemaHash: schemaHash,
    // Provider-native search and the response schema are independent request
    // features. A response schema avoids making them compete as tool calls.
    structuredOutputTransport: "response_json_schema",
    webSearchEnabled: model.webSearchMode === "provider_native",
    webSearchMode: model.webSearchMode,
  };
}

function fingerprint(input: {
  model: ProductModelSnapshot;
  protocol: ProbeRun["protocol"];
  subject: string;
  repetitions: number;
  keywordSetHash: string | null;
}): ProbeFingerprint {
  const raw = {
    provider: input.model.providerId,
    model: input.model.modelId,
    webSearchMode: input.model.webSearchMode,
    protocol: input.protocol.id,
    protocolVersion: input.protocol.version,
    language: input.protocol.language,
    scenario: input.protocol.scenario || null,
    subject: input.subject,
    repetitions: input.repetitions,
    generation: { temperature: DEFAULT_TEMPERATURE, maxTokens: DEFAULT_MAX_TOKENS },
    matchingRuleVersion: "measurement-matching/v1",
    keywordSetHash: input.keywordSetHash,
  };
  return { value: sha256(JSON.stringify(raw)), modelId: input.model.modelId, webSearchMode: input.model.webSearchMode, protocolId: input.protocol.id, protocolVersion: input.protocol.version, language: input.protocol.language, scenario: input.protocol.scenario || null, subject: input.subject, repetitions: input.repetitions, matchingRuleVersion: "measurement-matching/v1", keywordSetHash: input.keywordSetHash };
}

function keywordSetHash(watchSet: WatchSet): string {
  return sha256(JSON.stringify(watchSet.keywords.filter((item) => item.neutralEligible).map((item) => item.normalizedKeyword).sort((left, right) => left.localeCompare(right))));
}

function providerCitations(answer: AnswerResult, parent: { projectId: string; runId: string; modelRunId: string; attemptId: string }): ProviderCitation[] {
  const rows: ProviderCitation[] = [];
  for (const citation of answer.citations) {
    if (citation.source === "answer_text_url" || !citation.providerPayloadPath) continue;
    rows.push({
      id: randomUUID(), ...parent, url: citation.url, domain: citation.domain, title: citation.title || citation.domain,
      providerCitationSource: citation.source, providerCitationIndex: citation.citationIndex, providerPayloadPath: citation.providerPayloadPath, createdAt: now(),
    });
  }
  return rows;
}

function answerUrls(answer: AnswerResult, parent: { projectId: string; runId: string; modelRunId: string; attemptId: string }): AnswerMentionedUrl[] {
  const rows: AnswerMentionedUrl[] = [];
  for (const citation of answer.citations) {
    if (citation.source !== "answer_text_url") continue;
    const offset = answer.text.indexOf(citation.url);
    rows.push({ id: randomUUID(), ...parent, url: citation.url, domain: citation.domain || extractDomainFromUrl(citation.url), evidence: offset < 0 ? null : { quote: citation.url, start: offset, end: offset + citation.url.length, encoding: "utf16_code_unit" }, createdAt: now() });
  }
  return rows;
}

function objectMatch(name: string, domain: string | null, objects: WatchObject[]): { id: string | null; basis: KeywordDiscoveryMention["matchingBasis"] } {
  const normalizedDomain = domain ? normalizeDomain(domain) : null;
  const found = objects.filter((object) => {
    const sameName = normalized(object.name) === normalized(name) || object.aliases.some((alias) => normalized(alias) === normalized(name));
    const sameDomain = Boolean(normalizedDomain && object.domain && normalizedDomain === object.domain);
    return sameName || sameDomain;
  });
  if (found.length !== 1) return { id: null, basis: "unresolved" };
  const object = found[0] as WatchObject;
  const sameName = normalized(object.name) === normalized(name) || object.aliases.some((alias) => normalized(alias) === normalized(name));
  const sameDomain = Boolean(normalizedDomain && object.domain && normalizedDomain === object.domain);
  return { id: object.id, basis: sameName && sameDomain ? "exact_name_and_domain" : sameDomain ? "exact_domain" : "exact_name" };
}

function domainResult(input: { answer: AnswerResult; projectId: string; runId: string; modelRunId: string; probeRunId: string; attemptId: string }): DomainProbeResult {
  const output = parseStructuredRecognitionOutput(input.answer.structuredOutput?.value);
  return {
    id: randomUUID(), projectId: input.projectId, runId: input.runId, modelRunId: input.modelRunId, probeRunId: input.probeRunId, attemptId: input.attemptId,
    domainRecognition: output.domainRecognition, analysisStatus: output.analysisStatus,
    recognizedBrand: output.recognizedBrand.value, businessDescription: output.businessDescription.value, productCategory: output.productCategory.value,
    associatedKeywords: output.brandKeywords.map((item) => ({ keyword: item.keyword, evidence: evidenceLocation(input.answer.text, item.keyword, null) })),
    unknowns: output.unknowns, createdAt: now(),
  };
}

function keywordResult(input: { answer: AnswerResult; projectId: string; runId: string; modelRunId: string; probeRunId: string; attemptId: string; objects: WatchObject[] }): { result: KeywordDiscoveryResult; mentions: KeywordDiscoveryMention[] } {
  const output = parseKeywordDiscoveryOutput(input.answer.structuredOutput?.value);
  const mentions = output.mentions.map((value) => {
    const match = objectMatch(value.name, value.domain, input.objects);
    return {
      id: randomUUID(), projectId: input.projectId, runId: input.runId, modelRunId: input.modelRunId, probeRunId: input.probeRunId, attemptId: input.attemptId,
      name: value.name, domain: value.domain, matchedObjectId: match.id, matchingBasis: match.basis, recommendation: value.recommendation,
      mentionEvidence: evidenceLocation(input.answer.text, value.mentionQuote, value.firstMentionOffset),
      recommendationEvidence: evidenceLocation(input.answer.text, value.recommendationQuote, value.firstRecommendationOffset),
      firstMentionOffset: value.firstMentionOffset, firstRecommendationOffset: value.firstRecommendationOffset,
      firstMentionState: value.firstMentionState, firstRecommendationState: value.firstRecommendationState, createdAt: now(),
    };
  });
  return {
    result: {
      id: randomUUID(), projectId: input.projectId, runId: input.runId, modelRunId: input.modelRunId, probeRunId: input.probeRunId, attemptId: input.attemptId,
      analysisStatus: output.analysisStatus, mentionJudgment: output.analysisStatus === "completed" ? "adjudicable" : "unknown",
      recommendationJudgment: output.analysisStatus === "completed" ? "adjudicable" : "unknown",
      firstMentionJudgment: output.analysisStatus === "completed" ? "adjudicable" : "unknown",
      firstRecommendationJudgment: output.analysisStatus === "completed" ? "adjudicable" : "unknown",
      unknowns: output.unknowns, createdAt: now(),
    }, mentions,
  };
}

function failureStatus(code: string): ProbeAttempt["status"] { return code === "unsupported_capability" ? "unsupported" : "provider_failed"; }

export class ProductMeasurementRunService {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly watchSets: ProductWatchSetService,
    private readonly store: ProductMeasurementFileStore,
    private readonly executor: RecognitionAnswerExecutor = new OpenRouterRecognitionAnswerExecutor(),
  ) {}

  async start(projectId: string, input: { modelIds?: string[]; source?: MeasurementRun["source"]; idempotencyKey?: string; occurrenceId?: string; budget?: Partial<MeasurementBudget> } = {}): Promise<MeasurementRun> {
    return this.withLock(projectId, async () => {
      const project = await this.projects.get(projectId);
      if (!project.activeBaselineId) throw new Error("Save a monitoring configuration before starting a measurement.");
      const baseline = await this.baselines.get(projectId, project.activeBaselineId);
      const watchSet = await this.watchSets.current(projectId);
      if (watchSet.baselineId !== baseline.id) throw new Error("Confirm a new monitoring scope after changing the monitoring configuration.");
      const requested = new Set(input.modelIds || baseline.modelSnapshots.map((model) => model.modelId));
      const models = baseline.modelSnapshots.filter((model) => requested.has(model.modelId));
      if (models.length === 0) throw new Error("Select at least one enabled model for this measurement.");
      if (models.length !== requested.size) throw new Error("A requested model is not part of the current monitoring configuration.");
      const probesPerModel = this.plannedProbeCount(watchSet);
      const budget = { ...DEFAULT_BUDGET, ...input.budget };
      const planned = models.length * probesPerModel;
      if (planned > budget.requestLimit) throw new Error("The planned measurement exceeds its request limit.");
      const existing = await this.store.listRuns(projectId);
      if (input.idempotencyKey) {
        const duplicate = existing.find((run) => run.idempotencyKey === input.idempotencyKey);
        if (duplicate) return duplicate;
      }
      const run: MeasurementRun = {
        id: randomUUID(), projectId, baselineId: baseline.id, baselineVersion: baseline.version, watchSetId: watchSet.id, watchSetVersion: watchSet.version,
        source: input.source || "manual", modelScope: models.map((model) => model.modelId), plannedProbeCount: planned, completedProbeCount: 0, failedProbeCount: 0,
        status: "queued", budget, idempotencyKey: input.idempotencyKey, occurrenceId: input.occurrenceId, createdAt: now(),
      };
      await this.store.saveRun(run);
      const modelRuns = models.map((modelSnapshot) => ({ id: randomUUID(), projectId, runId: run.id, baselineId: baseline.id, modelSnapshot, probeRunIds: [], status: "queued" as const, createdAt: now() }));
      await Promise.all(modelRuns.map((row) => this.store.saveModelRun(row)));
      void this.execute(run, baseline, watchSet, modelRuns);
      return run;
    });
  }

  async startNewModels(projectId: string): Promise<MeasurementRun> {
    const project = await this.projects.get(projectId);
    if (!project.activeBaselineId) throw new Error("Save a monitoring configuration before starting a measurement.");
    const baseline = await this.baselines.get(projectId, project.activeBaselineId);
    const history = await this.store.listRuns(projectId);
    const previouslyObserved = new Set<string>();
    for (const run of history) for (const modelId of run.modelScope) previouslyObserved.add(modelId);
    const newModels = baseline.modelSnapshots.filter((model) => !previouslyObserved.has(model.modelId)).map((model) => model.modelId);
    if (newModels.length === 0) throw new Error("There are no newly added models to test.");
    return this.start(projectId, { modelIds: newModels, source: "manual" });
  }

  async list(projectId: string): Promise<MeasurementRun[]> { await this.projects.get(projectId); return this.store.listRuns(projectId); }

  async get(projectId: string, runId: string): Promise<{ run: MeasurementRun; modelRuns: MeasurementModelRun[] }> {
    await this.projects.get(projectId);
    const run = await this.store.readRun(projectId, runId);
    if (!run) throw new Error("Measurement run was not found.");
    return { run, modelRuns: await this.store.listModelRuns(projectId, runId) };
  }

  async getProbe(projectId: string, runId: string, modelRunId: string, probeRunId: string) {
    await this.get(projectId, runId);
    const detail = await this.store.probeDetail(projectId, runId, modelRunId, probeRunId);
    if (!detail) throw new Error("Measurement probe was not found.");
    return detail;
  }

  async retryProbe(projectId: string, runId: string, modelRunId: string, probeRunId: string): Promise<void> {
    const detail = await this.getProbe(projectId, runId, modelRunId, probeRunId);
    if (detail.probe.status !== "failed" && detail.probe.status !== "unsupported" && detail.probe.status !== "budget_blocked") throw new Error("Only failed, unsupported, or budget-blocked probes can be retried.");
    const parent = await this.get(projectId, runId);
    const baseline = await this.baselines.get(projectId, parent.run.baselineId);
    const watchSet = await this.watchSets.get(projectId, parent.run.watchSetId);
    const model = parent.modelRuns.find((item) => item.id === modelRunId);
    if (!model) throw new Error("Measurement model run was not found.");
    await this.executeProbe(parent.run, baseline, watchSet, model, detail.probe);
    await this.refreshStatuses(projectId, runId);
  }

  plannedProbeCount(watchSet: WatchSet): number {
    const independentDomains = watchSet.objects.filter((item) => item.domain !== null && item.identityState === "confirmed").length;
    const neutralKeywords = watchSet.keywords.filter((item) => item.neutralEligible).length;
    return watchSet.repetitions * (independentDomains + neutralKeywords);
  }

  private async withLock<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(projectId) || Promise.resolve();
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const queue = previous.then(() => hold);
    this.locks.set(projectId, queue);
    await previous;
    try { return await operation(); }
    finally { release?.(); if (this.locks.get(projectId) === queue) this.locks.delete(projectId); }
  }

  private async execute(run: MeasurementRun, baseline: ProductBaseline, watchSet: WatchSet, modelRuns: MeasurementModelRun[]): Promise<void> {
    await this.store.saveRun({ ...run, status: "running", startedAt: now() });
    await Promise.all(modelRuns.map((model) => this.executeModelRun(run, baseline, watchSet, model)));
    await this.refreshStatuses(run.projectId, run.id);
  }

  private async executeModelRun(run: MeasurementRun, baseline: ProductBaseline, watchSet: WatchSet, modelRun: MeasurementModelRun): Promise<void> {
    let current = { ...modelRun, status: "running" as const, startedAt: now() };
    await this.store.saveModelRun(current);
    const probes = this.planProbes(run, watchSet, current);
    current = { ...current, probeRunIds: probes.map((probe) => probe.id) };
    await this.store.saveModelRun(current);
    for (const probe of probes) {
      await this.store.saveProbe(probe);
      await this.executeProbe(run, baseline, watchSet, current, probe);
    }
    const stored = await this.store.listProbes(run.projectId, run.id, current.id);
    const failed = stored.filter((probe) => probe.status !== "completed").length;
    await this.store.saveModelRun({ ...current, status: failed === 0 ? "completed" : stored.some((probe) => probe.status === "completed") ? "partial" : "failed", completedAt: now() });
  }

  private planProbes(run: MeasurementRun, watchSet: WatchSet, modelRun: MeasurementModelRun): ProbeRun[] {
    const values: ProbeRun[] = [];
    const domains = watchSet.objects.filter((item) => item.domain !== null && item.identityState === "confirmed");
    const keywords = watchSet.keywords.filter((item) => item.neutralEligible);
    const keyHash = keywordSetHash(watchSet);
    for (let sample = 1; sample <= watchSet.repetitions; sample += 1) {
      for (const object of domains) {
        values.push({
          id: randomUUID(), projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, protocol: watchSet.domainProtocol,
          kind: object.role === "target" ? "target_domain" : "competitor_domain", subjectObjectId: object.id, subjectDomain: object.domain || undefined,
          sampleNumber: sample, fingerprint: fingerprint({ model: modelRun.modelSnapshot, protocol: watchSet.domainProtocol, subject: object.domain || "", repetitions: watchSet.repetitions, keywordSetHash: null }),
          status: "queued", attemptIds: [], plannedAt: now(),
        });
      }
      for (const keyword of keywords) {
        values.push({
          id: randomUUID(), projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, protocol: watchSet.keywordProtocol,
          kind: "keyword_discovery", keywordId: keyword.id, keyword: keyword.keyword, sampleNumber: sample,
          fingerprint: fingerprint({ model: modelRun.modelSnapshot, protocol: watchSet.keywordProtocol, subject: keyword.normalizedKeyword, repetitions: watchSet.repetitions, keywordSetHash: keyHash }),
          status: "queued", attemptIds: [], plannedAt: now(),
        });
      }
    }
    return values;
  }

  private async executeProbe(run: MeasurementRun, baseline: ProductBaseline, watchSet: WatchSet, modelRun: MeasurementModelRun, original: ProbeRun): Promise<void> {
    const attempts = await this.store.listAttempts(run.projectId, run.id, modelRun.id, original.id);
    const isDomain = original.protocol.id === DOMAIN_PROTOCOL_ID;
    const request = parameters(modelRun.modelSnapshot, isDomain ? DOMAIN_RECOGNITION_SCHEMA_NAME : KEYWORD_DISCOVERY_SCHEMA_NAME, isDomain ? original.protocol.responseSchemaHash : KEYWORD_DISCOVERY_SCHEMA_HASH);
    const prompt = isDomain
      ? domainRecognitionPrompt({ normalizedDomain: original.subjectDomain || "", language: original.protocol.language, protocol: { protocolId: "domain-recognition", protocolVersion: "v1", inputType: "domain_only", requestedFields: ["domainRecognition", "brandIdentity", "businessDescription", "productCategory", "competitors", "brandKeywords", "competitorKeywords", "citations", "unknowns"], promptTemplateHash: original.protocol.promptTemplateHash } })
      : keywordDiscoveryPrompt({ keyword: original.keyword || "", language: original.protocol.language });
    const attempt: ProbeAttempt = { id: randomUUID(), projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, probeRunId: original.id, attemptNumber: attempts.length + 1, status: "running", promptHash: sha256(prompt), requestParameters: request, providerId: "openrouter", costUsd: null, costState: "reserved", createdAt: now(), startedAt: now() };
    const probe = { ...original, status: "running" as const, attemptIds: [...original.attemptIds, attempt.id], firstAttemptId: original.firstAttemptId || attempt.id, latestAttemptId: attempt.id, startedAt: now(), completedAt: undefined };
    await Promise.all([this.store.saveAttempt(attempt), this.store.saveProbe(probe)]);
    if (modelRun.modelSnapshot.webSearchMode === "provider_native" && !modelRun.modelSnapshot.nativeWebSearchSupported) {
      await this.store.saveAttempt({ ...attempt, status: "unsupported", costState: "known", errorCode: "unsupported_capability", errorMessage: "The selected model does not support Provider-native web search.", completedAt: now() });
      await this.store.saveProbe({ ...probe, status: "unsupported", completedAt: now() });
      return;
    }
    try {
      const answer = await this.executor.execute({
        baseline, modelSnapshot: modelRun.modelSnapshot, prompt,
        requestParameters: request as import("../recognition/recognition-schema.js").RecognitionRequestParameters,
        executionContext: {
          projectId: run.projectId,
          runId: run.id,
          modelRunId: modelRun.id,
          probeRunId: probe.id,
          attemptId: attempt.id,
        },
        structuredOutput: isDomain
          ? { name: DOMAIN_RECOGNITION_SCHEMA_NAME, description: DOMAIN_RECOGNITION_TOOL_DESCRIPTION, schema: domainRecognitionResponseSchema }
          : { name: KEYWORD_DISCOVERY_SCHEMA_NAME, description: KEYWORD_DISCOVERY_TOOL_DESCRIPTION, schema: keywordDiscoveryResponseSchema },
      });
      const saved = { ...attempt, status: "completed" as const, rawProviderResponse: answer.rawProviderResponse === undefined ? null : answer.rawProviderResponse, rawAnswer: answer.text, providerModel: answer.model, providerModelVersion: answer.modelVersion, providerSearch: answer.search, tokenUsage: answer.tokenUsage, costUsd: answer.costUsd ?? null, costState: answer.costUsd === undefined || answer.costUsd === null ? "unknown" as const : "known" as const, latencyMs: answer.latencyMs };
      const parent = { projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, attemptId: attempt.id };
      const evidence: ProbeEvidenceArchive = { providerCitations: providerCitations(answer, parent), answerMentionedUrls: answerUrls(answer, parent) };
      await this.store.saveEvidence(run.projectId, run.id, modelRun.id, probe.id, evidence);
      try {
        if (!answer.structuredOutput) throw new Error("The provider did not return the requested structured output.");
        if (isDomain) {
          const result = domainResult({ answer, ...parent, probeRunId: probe.id });
          await this.store.saveResults({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, probeRunId: probe.id, domainResult: result, mentions: [] });
        } else {
          const output = keywordResult({ answer, ...parent, probeRunId: probe.id, objects: watchSet.objects });
          await this.store.saveResults({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, probeRunId: probe.id, keywordResult: output.result, mentions: output.mentions });
        }
        await Promise.all([this.store.saveAttempt({ ...saved, completedAt: now() }), this.store.saveProbe({ ...probe, status: "completed", completedAt: now() })]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isDomain) {
          await this.store.saveResults({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, probeRunId: probe.id, domainResult: { id: randomUUID(), ...parent, probeRunId: probe.id, domainRecognition: "unknown", analysisStatus: "analysis_failed", recognizedBrand: null, businessDescription: null, productCategory: null, associatedKeywords: [], unknowns: [message], createdAt: now() }, mentions: [] });
        } else {
          await this.store.saveResults({ projectId: run.projectId, runId: run.id, modelRunId: modelRun.id, probeRunId: probe.id, keywordResult: { id: randomUUID(), ...parent, probeRunId: probe.id, analysisStatus: "analysis_failed", mentionJudgment: "unknown", recommendationJudgment: "unknown", firstMentionJudgment: "unknown", firstRecommendationJudgment: "unknown", unknowns: [message], createdAt: now() }, mentions: [] });
        }
        await Promise.all([this.store.saveAttempt({ ...saved, status: "analysis_failed", errorCode: "analysis_failed", errorMessage: message, completedAt: now() }), this.store.saveProbe({ ...probe, status: "failed", exclusionReason: "analysis_failed", completedAt: now() })]);
      }
    } catch (error) {
      const code = providerFailureCode(error);
      await Promise.all([
        this.store.saveAttempt({ ...attempt, status: failureStatus(code), costState: "unknown", errorCode: code, errorMessage: error instanceof Error ? error.message : String(error), completedAt: now() }),
        this.store.saveProbe({ ...probe, status: code === "unsupported_capability" ? "unsupported" : "failed", exclusionReason: code, completedAt: now() }),
      ]);
    }
  }

  private async refreshStatuses(projectId: string, runId: string): Promise<void> {
    const run = await this.store.readRun(projectId, runId);
    if (!run) return;
    const modelRuns = await this.store.listModelRuns(projectId, runId);
    let completed = 0;
    let failed = 0;
    for (const model of modelRuns) {
      for (const probe of await this.store.listProbes(projectId, runId, model.id)) {
        if (probe.status === "completed") completed += 1;
        else failed += 1;
      }
    }
    const status = failed === 0 ? "completed" : completed > 0 ? "partial" : "failed";
    await this.store.saveRun({ ...run, completedProbeCount: completed, failedProbeCount: failed, status, completedAt: now() });
  }
}
