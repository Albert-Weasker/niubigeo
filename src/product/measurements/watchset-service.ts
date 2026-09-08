import { randomUUID } from "node:crypto";
import { sha256 } from "../../utils/hash.js";
import type { ProductBaseline } from "../configuration/baseline-schema.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductRecognitionFileStore } from "../recognition/recognition-store.js";
import { RecognitionReportFileStore } from "../reports/report-store.js";
import type { RecognitionReport } from "../reports/report-schema.js";
import { DOMAIN_PROTOCOL_ID, KEYWORD_PROTOCOL_ID, MATCHING_RULE_VERSION, type MeasurementProtocolSnapshot, type WatchKeyword, type WatchObject, type WatchSet } from "./measurement-schema.js";
import { KEYWORD_DISCOVERY_PROMPT_HASH, KEYWORD_DISCOVERY_SCHEMA_HASH } from "./keyword-discovery-protocol.js";
import { DOMAIN_RECOGNITION_SCHEMA_HASH } from "../recognition/recognition-prompt.js";

const DOMAIN_PROMPT_HASH = sha256("domain-recognition/v1");

function now(): string { return new Date().toISOString(); }
function normalized(value: string): string { return value.trim().toLocaleLowerCase(); }
function suggestedObjectId(projectId: string, name: string, domain: string | null): string {
  return `watch-object-${sha256(JSON.stringify({ projectId, name: normalized(name), domain: domain ? normalized(domain) : null })).slice(0, 24)}`;
}
function suggestedKeywordId(projectId: string, keyword: string): string {
  return `watch-keyword-${sha256(JSON.stringify({ projectId, keyword: normalized(keyword) })).slice(0, 24)}`;
}

function protocol(id: typeof DOMAIN_PROTOCOL_ID | typeof KEYWORD_PROTOCOL_ID, baseline: ProductBaseline): MeasurementProtocolSnapshot {
  if (id === DOMAIN_PROTOCOL_ID) {
    return { id, version: "v1", language: baseline.language, responseSchemaHash: DOMAIN_RECOGNITION_SCHEMA_HASH, promptTemplateHash: DOMAIN_PROMPT_HASH };
  }
  return {
    id,
    version: "v1",
    language: baseline.language,
    scenario: "neutral_product_selection",
    responseSchemaHash: KEYWORD_DISCOVERY_SCHEMA_HASH,
    promptTemplateHash: KEYWORD_DISCOVERY_PROMPT_HASH,
  };
}

function objectKey(name: string, domain: string | null): string { return `${normalized(name)}:${domain ? normalized(domain) : ""}`; }

function eligibleKeyword(keyword: string, objects: WatchObject[]): { eligible: boolean; reason: WatchKeyword["neutralEligibilityReason"] } {
  const candidate = normalized(keyword);
  for (const object of objects) {
    const identities = [object.name, ...object.aliases, object.domain || ""];
    if (identities.some((identity) => normalized(identity).length > 0 && candidate.includes(normalized(identity)))) {
      return { eligible: false, reason: "contains_monitored_identity" };
    }
  }
  return { eligible: true, reason: "eligible" };
}

export interface WatchSetSuggestion {
  target: WatchObject;
  competitors: WatchObject[];
  keywords: WatchKeyword[];
  sourceReportIds: string[];
}

export class ProductWatchSetService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly store: import("./measurement-store.js").ProductMeasurementFileStore,
    private readonly recognition: ProductRecognitionFileStore,
    private readonly reports: RecognitionReportFileStore,
  ) {}

  async list(projectId: string): Promise<WatchSet[]> {
    await this.projects.get(projectId);
    return this.store.listWatchSets(projectId);
  }

  async get(projectId: string, watchSetId: string): Promise<WatchSet> {
    await this.projects.get(projectId);
    const value = await this.store.readWatchSet(projectId, watchSetId);
    if (!value) throw new Error("Monitoring scope was not found.");
    return value;
  }

  async suggest(projectId: string): Promise<WatchSetSuggestion> {
    const project = await this.projects.get(projectId);
    const target: WatchObject = {
      id: suggestedObjectId(projectId, project.brandName, project.normalizedDomain), projectId, role: "target", name: project.brandName, domain: project.normalizedDomain, aliases: project.aliases,
      sourceRecordIds: [], selectedAt: now(), identityState: "confirmed",
    };
    const reportRows = await this.readLatestReports(projectId);
    const seenObjects = new Map<string, WatchObject>();
    const seenKeywords = new Map<string, WatchKeyword>();
    for (const report of reportRows) {
      for (const group of report.competitorGroups) {
        const competitor: WatchObject = {
          id: suggestedObjectId(projectId, group.name, group.host), projectId, role: group.host ? "competitor" : "pending_identity", name: group.name, domain: group.host, aliases: [],
          sourceRecordIds: [...group.sourceRecordIds], selectedAt: now(), identityState: group.host ? "confirmed" : "pending",
        };
        const key = objectKey(competitor.name, competitor.domain);
        const existing = seenObjects.get(key);
        if (existing) existing.sourceRecordIds.push(...competitor.sourceRecordIds);
        else seenObjects.set(key, competitor);
      }
      for (const group of report.brandKeywordGroups) {
        const keyword: WatchKeyword = {
          id: suggestedKeywordId(projectId, group.normalizedKeyword), projectId, keyword: group.keyword, normalizedKeyword: group.normalizedKeyword,
          sourceRecordIds: [...group.sourceRecordIds], selectedAt: now(), neutralEligible: true, neutralEligibilityReason: "eligible",
        };
        const existing = seenKeywords.get(keyword.normalizedKeyword);
        if (existing) existing.sourceRecordIds.push(...keyword.sourceRecordIds);
        else seenKeywords.set(keyword.normalizedKeyword, keyword);
      }
    }
    const objects = [target, ...seenObjects.values()];
    for (const keyword of seenKeywords.values()) {
      const eligibility = eligibleKeyword(keyword.keyword, objects);
      keyword.neutralEligible = eligibility.eligible;
      keyword.neutralEligibilityReason = eligibility.reason;
    }
    return { target, competitors: [...seenObjects.values()], keywords: [...seenKeywords.values()], sourceReportIds: reportRows.map((report) => report.reportId) };
  }

  async createFromSuggestion(projectId: string, input: { objectIds?: string[]; keywordIds?: string[]; repetitions?: number }): Promise<WatchSet> {
    const project = await this.projects.get(projectId);
    if (!project.activeBaselineId) throw new Error("Save a monitoring configuration before saving a monitoring scope.");
    const baseline = await this.baselines.get(projectId, project.activeBaselineId);
    const existing = await this.store.listWatchSets(projectId);
    const active = existing.find((item) => item.status === "active");
    let availableObjects: WatchObject[];
    let availableKeywords: WatchKeyword[];
    let target: WatchObject | undefined;
    if (active) {
      const copied = this.copyActiveScope(active, project);
      availableObjects = copied.objects;
      availableKeywords = copied.keywords;
      target = availableObjects.find((item) => item.role === "target");
    } else {
      const suggestion = await this.suggest(projectId);
      availableObjects = [suggestion.target, ...suggestion.competitors];
      availableKeywords = suggestion.keywords;
      target = suggestion.target;
    }
    if (!target) throw new Error("The monitoring scope does not have a target object.");
    const requestedObjectIds = new Set(input.objectIds || availableObjects.map((item) => item.id));
    const requestedKeywordIds = new Set(input.keywordIds || availableKeywords.map((item) => item.id));
    const objects = availableObjects.filter((item) => requestedObjectIds.has(item.id));
    if (!objects.some((item) => item.id === target.id)) objects.unshift(target);
    const keywords = availableKeywords.filter((item) => requestedKeywordIds.has(item.id));
    const repetitions = input.repetitions === undefined ? active?.repetitions || 1 : input.repetitions;
    if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("Sample repetitions must be a positive integer.");
    const watchSet: WatchSet = {
      id: randomUUID(), projectId, baselineId: baseline.id, version: existing.length + 1, status: "draft", targetObjectId: target.id,
      objects, keywords, domainProtocol: protocol(DOMAIN_PROTOCOL_ID, baseline), keywordProtocol: protocol(KEYWORD_PROTOCOL_ID, baseline),
      repetitions, matchingRuleVersion: MATCHING_RULE_VERSION, createdAt: now(),
    };
    await this.store.saveWatchSet(watchSet);
    return watchSet;
  }

  async confirm(projectId: string, watchSetId: string): Promise<WatchSet> {
    const source = await this.get(projectId, watchSetId);
    if (source.status === "active") return source;
    const active = (await this.store.listWatchSets(projectId)).find((item) => item.status === "active");
    if (active) await this.store.saveWatchSet({ ...active, status: "retired", retiredAt: now() });
    const confirmed = { ...source, status: "active" as const, confirmedAt: now() };
    await this.store.saveWatchSet(confirmed);
    return confirmed;
  }

  async current(projectId: string): Promise<WatchSet> {
    await this.projects.get(projectId);
    const active = (await this.store.listWatchSets(projectId)).find((item) => item.status === "active");
    if (!active) throw new Error("Save and confirm a monitoring scope before starting a measurement.");
    return active;
  }

  private async readLatestReports(projectId: string): Promise<RecognitionReport[]> {
    const reports: RecognitionReport[] = [];
    for (const run of await this.recognition.listRuns(projectId)) {
      const list = await this.reports.list(projectId, run.id);
      const latest = list.at(-1);
      if (latest) reports.push(latest);
    }
    return reports.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  }

  private copyActiveScope(active: WatchSet, project: { brandName: string; normalizedDomain: string; aliases: string[] }): { objects: WatchObject[]; keywords: WatchKeyword[] } {
    const objects = active.objects.map((object) => object.role === "target"
      ? { ...object, name: project.brandName, domain: project.normalizedDomain, aliases: [...project.aliases], selectedAt: now() }
      : { ...object, aliases: [...object.aliases], sourceRecordIds: [...object.sourceRecordIds], selectedAt: now() });
    const keywords = active.keywords.map((keyword) => ({ ...keyword, sourceRecordIds: [...keyword.sourceRecordIds], selectedAt: now() }));
    for (const keyword of keywords) {
      const eligibility = eligibleKeyword(keyword.keyword, objects);
      keyword.neutralEligible = eligibility.eligible;
      keyword.neutralEligibilityReason = eligibility.reason;
    }
    return { objects, keywords };
  }
}
