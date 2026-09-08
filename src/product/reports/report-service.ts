import { sha256 } from "../../utils/hash.js";
import type { ProductBaseline } from "../configuration/baseline-schema.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductProjectService } from "../projects/project-service.js";
import type {
  AnswerEvidenceLocation,
  RecognitionArchive,
  RecognitionModelRun,
  RecognitionModelRunAttempt,
  RecognitionRun,
} from "../recognition/recognition-schema.js";
import { ProductRecognitionFileStore } from "../recognition/recognition-store.js";
import {
  REPORT_GROUPING_RULE_VERSION,
  REPORT_SCHEMA_VERSION,
  type RecognitionReport,
  type ReportAnswerUrl,
  type ReportClaim,
  type ReportCompetitorGroup,
  type ReportCompetitorRecord,
  type ReportContentStatus,
  type ReportEvidence,
  type ReportFieldState,
  type ReportKeywordGroup,
  type ReportKeywordRecord,
  type ReportMatrixCell,
  type ReportModelObservation,
  type ReportModelState,
  type ReportProviderCitation,
  type ReportSourceAttempt,
  type ReportSourceRecordHash,
} from "./report-schema.js";
import { RecognitionReportEvidenceIntegrityError, RecognitionReportInputError, RecognitionReportNotFoundError, RecognitionReportSnapshotChangedError } from "./report-errors.js";
import { RecognitionReportFileStore } from "./report-store.js";

type SourceModel = {
  modelRun: RecognitionModelRun;
  attempt: RecognitionModelRunAttempt | null;
  archive: RecognitionArchive | null;
  archiveError: string | null;
};

type FrozenSnapshot = {
  run: RecognitionRun;
  baseline: ProductBaseline;
  models: SourceModel[];
};

function recordHash(source: ReportSourceRecordHash["source"], id: string, value: unknown): ReportSourceRecordHash {
  return { source, id, sha256: sha256(JSON.stringify(value)) };
}

function reportId(fingerprint: string): string {
  return `recognition-report-${fingerprint.slice(0, 20)}`;
}

function isTerminalRun(run: RecognitionRun): boolean {
  return run.status !== "queued" && run.status !== "running";
}

function sameSnapshot(left: FrozenSnapshot, right: FrozenSnapshot): boolean {
  if (left.run.id !== right.run.id || left.run.status !== right.run.status || left.run.baselineId !== right.run.baselineId) return false;
  if (left.models.length !== right.models.length) return false;
  for (let index = 0; index < left.models.length; index += 1) {
    const before = left.models[index];
    const after = right.models[index];
    if (!before || !after) return false;
    if (before.modelRun.id !== after.modelRun.id || before.modelRun.status !== after.modelRun.status || before.modelRun.currentAttemptId !== after.modelRun.currentAttemptId) return false;
  }
  return true;
}

function evidenceFor(answer: string | null, evidence: AnswerEvidenceLocation | null): ReportEvidence {
  if (!evidence) return { evidence: null, integrity: "missing" };
  if (!answer || evidence.start < 0 || evidence.end < evidence.start || evidence.end > answer.length) return { evidence, integrity: "invalid" };
  return answer.slice(evidence.start, evidence.end) === evidence.quote
    ? { evidence, integrity: "valid" }
    : { evidence, integrity: "invalid" };
}

function reportClaim(answer: string | null, value: string | null, evidence: AnswerEvidenceLocation | null): ReportClaim {
  return { value, evidence: evidenceFor(answer, evidence) };
}

function titleFor(model: RecognitionModelRun): string {
  return model.modelSnapshot.displayName || model.modelSnapshot.modelId;
}

function modelState(source: SourceModel): ReportModelState {
  if (source.modelRun.status === "unsupported") return "unsupported";
  if (source.modelRun.status === "failed") return "provider_failed";
  if (source.archiveError) return "evidence_integrity_error";
  if (!source.archive) return "evidence_integrity_error";
  if (source.archive.result.analysisStatus === "analysis_failed") return "analysis_failed";
  if (source.archive.result.domainRecognition === "not_recognized") return "not_recognized";
  return source.archive.result.analysisStatus;
}

function unavailableReason(source: SourceModel, state: ReportModelState): string | null {
  if (source.archiveError) return source.archiveError;
  if (state === "provider_failed" || state === "unsupported") return source.attempt?.errorMessage || source.modelRun.errorMessage || null;
  if (state === "analysis_failed") return source.archive?.result.unknowns[0] || source.attempt?.errorMessage || null;
  return null;
}

function requestedSearch(source: SourceModel): boolean | null {
  return source.attempt?.requestParameters.webSearchEnabled ?? null;
}

function actualSearch(source: SourceModel): { used: boolean | null; usedMode: string | null; executionMode: string | null; label: string } {
  const sourceSearch = source.attempt?.providerSearch;
  if (!sourceSearch || typeof sourceSearch !== "object") {
    if (source.modelRun.recognitionMode === "unaided_domain_recognition") {
      return { used: false, usedMode: "none", executionMode: "offline", label: "未联网" };
    }
    return { used: null, usedMode: null, executionMode: null, label: "联网执行路径未确认" };
  }
  const search = sourceSearch as Record<string, unknown>;
  const used = typeof search.used === "boolean" ? search.used : null;
  const usedMode = typeof search.usedMode === "string" ? search.usedMode : null;
  const executionMode = typeof search.executionMode === "string" ? search.executionMode : null;
  if (used === true && usedMode === "provider_native") {
    return { used, usedMode, executionMode, label: "Provider 原生联网" };
  }
  if (used === false) return { used, usedMode, executionMode, label: "未联网" };
  return { used, usedMode, executionMode, label: "联网执行路径未确认" };
}

function safeProviderResponse(value: unknown): unknown {
  const secretKeys = new Set(["authorization", "api_key", "apikey", "token", "secret", "password"]);
  const visit = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== "object") return entry;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(entry as Record<string, unknown>)) {
      output[key] = secretKeys.has(key.toLocaleLowerCase()) ? "[redacted]" : visit(nested);
    }
    return output;
  };
  return visit(value);
}

function payloadValueAtPath(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  let cursor = 0;
  while (cursor < path.length) {
    const character = path[cursor];
    if (character === ".") {
      cursor += 1;
      continue;
    }
    if (character === "[") {
      const end = path.indexOf("]", cursor + 1);
      if (end === -1) return undefined;
      const numberText = path.slice(cursor + 1, end);
      if (!numberText || [...numberText].some((entry) => entry < "0" || entry > "9")) return undefined;
      if (!Array.isArray(current)) return undefined;
      const index = Number(numberText);
      current = current[index];
      cursor = end + 1;
      continue;
    }
    const nextDot = path.indexOf(".", cursor);
    const nextBracket = path.indexOf("[", cursor);
    const candidates = [nextDot, nextBracket].filter((value) => value !== -1);
    const end = candidates.length ? Math.min(...candidates) : path.length;
    const key = path.slice(cursor, end);
    if (!key || !current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
    cursor = end;
  }
  return current;
}

function citationPathsAreValid(attempt: RecognitionModelRunAttempt | null, archive: RecognitionArchive): boolean {
  if (archive.providerCitations.length === 0) return true;
  if (!attempt || !attempt.rawProviderResponse) return false;
  for (const citation of archive.providerCitations) {
    if (payloadValueAtPath(attempt.rawProviderResponse, citation.providerPayloadPath) !== citation.url) return false;
  }
  return true;
}

function makeCompetitors(source: SourceModel, answer: string | null): ReportCompetitorRecord[] {
  const archive = source.archive;
  if (!archive) return [];
  const keywordsByCompetitor = new Map<string, string[]>();
  for (const keyword of archive.competitorKeywords) {
    const values = keywordsByCompetitor.get(keyword.competitorRecognitionId) || [];
    values.push(keyword.id);
    keywordsByCompetitor.set(keyword.competitorRecognitionId, values);
  }
  return archive.competitors.map((competitor) => ({
    id: competitor.id,
    name: competitor.name,
    domain: competitor.domain,
    businessDescription: reportClaim(answer, competitor.businessDescription.value, competitor.businessDescription.evidence),
    productCategory: reportClaim(answer, competitor.productCategory.value, competitor.productCategory.evidence),
    evidence: evidenceFor(answer, competitor.evidence),
    keywordIds: keywordsByCompetitor.get(competitor.id) || [],
  }));
}

function makeBrandKeywords(source: SourceModel, answer: string | null): ReportKeywordRecord[] {
  return (source.archive?.brandKeywords || []).map((keyword) => ({
    id: keyword.id,
    keyword: keyword.keyword,
    normalizedKeyword: keyword.normalizedKeyword,
    evidence: evidenceFor(answer, keyword.evidence),
  }));
}

function makeCompetitorKeywords(source: SourceModel, answer: string | null): ReportKeywordRecord[] {
  return (source.archive?.competitorKeywords || []).map((keyword) => ({
    id: keyword.id,
    keyword: keyword.keyword,
    normalizedKeyword: keyword.normalizedKeyword,
    competitorRecordId: keyword.competitorRecognitionId,
    evidence: evidenceFor(answer, keyword.evidence),
  }));
}

function makeCitations(source: SourceModel): ReportProviderCitation[] {
  return (source.archive?.providerCitations || []).map((citation) => ({
    id: citation.id,
    url: citation.url,
    domain: citation.domain,
    title: citation.title,
    providerPayloadPath: citation.providerPayloadPath,
    providerCitationSource: citation.providerCitationSource,
  }));
}

function makeAnswerUrls(source: SourceModel, answer: string | null): ReportAnswerUrl[] {
  return (source.archive?.answerMentionedUrls || []).map((url) => ({
    id: url.id,
    url: url.url,
    domain: url.domain,
    evidence: evidenceFor(answer, url.evidence),
  }));
}

function sourceHashes(source: SourceModel): ReportSourceRecordHash[] {
  const hashes = [recordHash("model_run", source.modelRun.id, source.modelRun)];
  if (source.attempt) hashes.push(recordHash("attempt", source.attempt.id, source.attempt));
  if (source.archive) hashes.push(recordHash("archive", source.archive.result.id, source.archive));
  return hashes;
}

function observation(source: SourceModel): ReportModelObservation {
  const state = modelState(source);
  const answer = source.attempt?.rawAnswer || null;
  const archive = source.archive;
  const dataUsable = Boolean(archive) && state !== "analysis_failed" && state !== "evidence_integrity_error";
  const search = actualSearch(source);
  return {
    modelRunId: source.modelRun.id,
    modelId: source.modelRun.modelSnapshot.modelId,
    displayName: titleFor(source.modelRun),
    recognitionMode: source.modelRun.recognitionMode,
    webSearch: {
      requested: requestedSearch(source),
      used: search.used,
      usedMode: search.usedMode,
      executionMode: search.executionMode,
      label: search.label,
    },
    modelRunStatus: source.modelRun.status,
    attemptStatus: source.attempt?.status || null,
    state,
    sourceAttemptId: source.attempt?.id || null,
    rawAnswer: answer,
    rawProviderResponse: source.attempt ? safeProviderResponse(source.attempt.rawProviderResponse) : null,
    recognizedBrand: dataUsable ? reportClaim(answer, archive?.result.recognizedBrand.value || null, archive?.result.recognizedBrand.evidence || null) : null,
    businessDescription: dataUsable ? reportClaim(answer, archive?.result.businessDescription.value || null, archive?.result.businessDescription.evidence || null) : null,
    productCategory: dataUsable ? reportClaim(answer, archive?.result.productCategory.value || null, archive?.result.productCategory.evidence || null) : null,
    unknowns: archive?.result.unknowns || [],
    competitors: dataUsable ? makeCompetitors(source, answer) : null,
    brandKeywords: dataUsable ? makeBrandKeywords(source, answer) : null,
    competitorKeywords: dataUsable ? makeCompetitorKeywords(source, answer) : null,
    providerCitations: dataUsable ? makeCitations(source) : null,
    answerMentionedUrls: dataUsable ? makeAnswerUrls(source, answer) : null,
    claimCitationLinks: dataUsable ? archive?.claimCitationLinks || [] : null,
    unavailableReason: unavailableReason(source, state),
    sourceHashes: sourceHashes(source),
  };
}

function fieldState(model: ReportModelObservation): ReportFieldState {
  if (model.state === "analysis_failed") return "analysis_failed";
  if (model.state === "provider_failed") return "provider_failed";
  if (model.state === "unsupported") return "unsupported";
  if (model.state === "evidence_integrity_error") return "field_unavailable";
  return "not_reported";
}

function hostFor(domain: string | null): string | null {
  if (!domain) return null;
  try {
    return new URL(`https://${domain}`).host.toLocaleLowerCase();
  } catch {
    return null;
  }
}

function groupIdentity(name: string, host: string | null, recordId: string): string {
  return host ? `exact:${name.trim().toLocaleLowerCase()}:${host}` : `unresolved:${recordId}`;
}

function groupsForCompetitors(models: ReportModelObservation[]): ReportCompetitorGroup[] {
  const groups = new Map<string, ReportCompetitorGroup>();
  for (const model of models) {
    const records = model.competitors;
    if (!records) continue;
    for (const record of records) {
      const host = hostFor(record.domain);
      const identity = groupIdentity(record.name, host, record.id);
      const existing = groups.get(identity);
      const cell: ReportMatrixCell = { modelRunId: model.modelRunId, state: "reported", recordIds: [record.id], keywordRecordIds: record.keywordIds };
      if (existing) {
        const existingCell = existing.cells.find((entry) => entry.modelRunId === model.modelRunId);
        if (existingCell) {
          existingCell.recordIds.push(record.id);
          existingCell.keywordRecordIds.push(...record.keywordIds);
        } else {
          existing.cells.push(cell);
        }
        existing.sourceRecordIds.push(record.id);
      } else {
        groups.set(identity, {
          id: `competitor-${sha256(identity).slice(0, 16)}`,
          name: record.name,
          host,
          identity: host ? "confirmed_exact" : "unresolved",
          groupingRule: REPORT_GROUPING_RULE_VERSION,
          sourceRecordIds: [record.id],
          cells: [cell],
        });
      }
    }
  }
  for (const group of groups.values()) {
    for (const model of models) {
      if (group.cells.some((cell) => cell.modelRunId === model.modelRunId)) continue;
      group.cells.push({ modelRunId: model.modelRunId, state: fieldState(model), recordIds: [], keywordRecordIds: [] });
    }
    group.cells.sort((left, right) => left.modelRunId.localeCompare(right.modelRunId));
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name) || (left.host || "").localeCompare(right.host || ""));
}

function groupsForBrandKeywords(models: ReportModelObservation[]): ReportKeywordGroup[] {
  const groups = new Map<string, ReportKeywordGroup>();
  for (const model of models) {
    const records = model.brandKeywords;
    if (!records) continue;
    for (const record of records) {
      const identity = record.normalizedKeyword;
      const existing = groups.get(identity);
      const cell: ReportMatrixCell = { modelRunId: model.modelRunId, state: "reported", recordIds: [record.id], keywordRecordIds: [record.id] };
      if (existing) {
        const existingCell = existing.cells.find((entry) => entry.modelRunId === model.modelRunId);
        if (existingCell) {
          existingCell.recordIds.push(record.id);
          existingCell.keywordRecordIds.push(record.id);
        } else {
          existing.cells.push(cell);
        }
        existing.sourceRecordIds.push(record.id);
      } else {
        groups.set(identity, {
          id: `brand-keyword-${sha256(identity).slice(0, 16)}`,
          keyword: record.keyword,
          normalizedKeyword: record.normalizedKeyword,
          sourceRecordIds: [record.id],
          cells: [cell],
        });
      }
    }
  }
  for (const group of groups.values()) {
    for (const model of models) {
      if (group.cells.some((cell) => cell.modelRunId === model.modelRunId)) continue;
      group.cells.push({ modelRunId: model.modelRunId, state: fieldState(model), recordIds: [], keywordRecordIds: [] });
    }
    group.cells.sort((left, right) => left.modelRunId.localeCompare(right.modelRunId));
  }
  return [...groups.values()].sort((left, right) => left.normalizedKeyword.localeCompare(right.normalizedKeyword));
}

function reportContentStatus(models: ReportModelObservation[]): ReportContentStatus {
  const usable = models.filter((model) => model.state !== "analysis_failed" && model.state !== "provider_failed" && model.state !== "unsupported" && model.state !== "evidence_integrity_error");
  if (usable.length === 0) return "no_usable_results";
  return usable.length === models.length ? "ready" : "partial";
}

function fingerprint(snapshot: FrozenSnapshot): string {
  const activeAttempts = snapshot.models.map((source) => ({
    modelRunId: source.modelRun.id,
    status: source.modelRun.status,
    attemptId: source.attempt?.id || null,
    attemptHash: source.attempt ? sha256(JSON.stringify(source.attempt)) : null,
    archiveHash: source.archive ? sha256(JSON.stringify(source.archive)) : null,
    archiveError: source.archiveError,
  }));
  return sha256(JSON.stringify({
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    groupingRuleVersion: REPORT_GROUPING_RULE_VERSION,
    run: snapshot.run,
    baseline: snapshot.baseline,
    activeAttempts,
  }));
}

function sourceAttemptMap(models: SourceModel[]): ReportSourceAttempt[] {
  return models.map((source) => ({
    modelRunId: source.modelRun.id,
    attemptId: source.attempt?.id || null,
    archiveAttemptId: source.archive?.result.attemptId || null,
  }));
}

function sourceRecordHashes(snapshot: FrozenSnapshot): ReportSourceRecordHash[] {
  const hashes = [recordHash("run", snapshot.run.id, snapshot.run), recordHash("baseline", snapshot.baseline.id, snapshot.baseline)];
  for (const source of snapshot.models) hashes.push(...sourceHashes(source));
  return hashes;
}

export class RecognitionReportService {
  private readonly reportLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly recognition: ProductRecognitionFileStore,
    private readonly reports: RecognitionReportFileStore,
  ) {}

  async create(projectId: string, runId: string): Promise<RecognitionReport> {
    const lockKey = `${projectId}:${runId}`;
    return this.withLock(lockKey, async () => {
      const snapshot = await this.stableSnapshot(projectId, runId);
      const sourceFingerprint = fingerprint(snapshot);
      const existing = (await this.reports.list(projectId, runId)).find((report) => report.sourceFingerprint === sourceFingerprint && report.reportSchemaVersion === REPORT_SCHEMA_VERSION && report.groupingRuleVersion === REPORT_GROUPING_RULE_VERSION);
      if (existing) return existing;
      const previous = await this.reports.list(projectId, runId);
      const models = snapshot.models.map(observation);
      const report: RecognitionReport = {
        reportId: reportId(sourceFingerprint),
        projectId,
        runId,
        baselineId: snapshot.baseline.id,
        reportRevision: previous.length + 1,
        sourceFingerprint,
        sourceAttemptMap: sourceAttemptMap(snapshot.models),
        sourceRecordHashes: sourceRecordHashes(snapshot),
        reportSchemaVersion: REPORT_SCHEMA_VERSION,
        groupingRuleVersion: REPORT_GROUPING_RULE_VERSION,
        generatedAt: new Date().toISOString(),
        contentStatus: reportContentStatus(models),
        runStatus: snapshot.run.status,
        domain: snapshot.baseline.normalizedDomain,
        language: snapshot.baseline.language,
        monitoringConfigurationVersion: snapshot.baseline.version,
        protocol: { id: snapshot.baseline.recognitionProtocol.protocolId, version: snapshot.baseline.recognitionProtocol.protocolVersion },
        models,
        competitorGroups: groupsForCompetitors(models),
        brandKeywordGroups: groupsForBrandKeywords(models),
      };
      await this.reports.save(report);
      return report;
    });
  }

  async list(projectId: string, runId: string): Promise<RecognitionReport[]> {
    await this.requireRun(projectId, runId);
    return this.reports.list(projectId, runId);
  }

  async get(projectId: string, runId: string, reportId: string): Promise<RecognitionReport> {
    await this.requireRun(projectId, runId);
    const report = await this.reports.read(projectId, runId, reportId);
    if (!report) throw new RecognitionReportNotFoundError(reportId);
    return report;
  }

  async getModel(projectId: string, runId: string, reportId: string, modelRunId: string): Promise<ReportModelObservation> {
    const report = await this.get(projectId, runId, reportId);
    const model = report.models.find((entry) => entry.modelRunId === modelRunId);
    if (!model) throw new RecognitionReportNotFoundError(modelRunId);
    return model;
  }

  private async stableSnapshot(projectId: string, runId: string): Promise<FrozenSnapshot> {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const before = await this.snapshot(projectId, runId);
      const after = await this.snapshot(projectId, runId);
      if (sameSnapshot(before, after)) return after;
    }
    throw new RecognitionReportSnapshotChangedError();
  }

  private async snapshot(projectId: string, runId: string): Promise<FrozenSnapshot> {
    await this.projects.get(projectId);
    const run = await this.recognition.readRun(projectId, runId);
    if (!run) throw new RecognitionReportNotFoundError(runId);
    if (!isTerminalRun(run)) throw new RecognitionReportInputError("This recognition run is still executing. Wait for it to finish before preparing a report.");
    const baseline = await this.baselines.get(projectId, run.baselineId);
    const modelRuns = await this.recognition.listModelRuns(projectId, runId);
    const models: SourceModel[] = [];
    for (const modelRun of modelRuns) {
      const attemptId = modelRun.currentAttemptId;
      const attempt = attemptId ? await this.recognition.readAttempt(projectId, runId, modelRun.id, attemptId) : null;
      let archive: RecognitionArchive | null = null;
      let archiveError: string | null = null;
      if (attemptId) {
        try {
          archive = await this.recognition.readArchive(projectId, runId, modelRun.id, attemptId);
        } catch (error) {
          archiveError = error instanceof Error ? error.message : String(error);
        }
      }
      if (attemptId && !attempt) archiveError = "The current attempt record is missing.";
      if (modelRun.status === "completed" && !archive && !archiveError) archiveError = "The current recognition archive is missing.";
      if (archive && !archiveError && !citationPathsAreValid(attempt, archive)) archiveError = "A Provider Citation cannot be traced to the saved provider response.";
      models.push({ modelRun, attempt, archive, archiveError });
    }
    return { run, baseline, models };
  }

  private async requireRun(projectId: string, runId: string): Promise<void> {
    await this.projects.get(projectId);
    const run = await this.recognition.readRun(projectId, runId);
    if (!run) throw new RecognitionReportNotFoundError(runId);
  }

  private async withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.reportLocks.get(key) || Promise.resolve();
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = previous.then(() => hold);
    this.reportLocks.set(key, queue);
    await previous;
    try {
      return await task();
    } finally {
      release?.();
      if (this.reportLocks.get(key) === queue) this.reportLocks.delete(key);
    }
  }
}
