import { randomUUID } from "node:crypto";
import { sha256 } from "../../utils/hash.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductMeasurementFileStore } from "./measurement-store.js";
import type {
  MeasurementMetricId,
  MeasurementMetricPoint,
  MeasurementModelRun,
  MeasurementRun,
  MeasurementStatsSnapshot,
  MetricPointSample,
  ProbeRun,
  WatchObject,
  WatchSet,
} from "./measurement-schema.js";

function now(): string { return new Date().toISOString(); }

type ProbeMaterial = {
  probe: ProbeRun;
  model: MeasurementModelRun;
  attempt: import("./measurement-schema.js").ProbeAttempt | null;
  domain: import("./measurement-schema.js").DomainProbeResult | undefined;
  keyword: import("./measurement-schema.js").KeywordDiscoveryResult | undefined;
  mentions: import("./measurement-schema.js").KeywordDiscoveryMention[];
  citations: import("../recognition/recognition-schema.js").ProviderCitation[];
};

export function measurementPoint(input: {
  projectId: string;
  metric: MeasurementMetricId;
  objectId: string | null;
  comparisonObjectId?: string | null;
  keywordId: string | null;
  model: MeasurementModelRun;
  run: MeasurementRun;
  fingerprint: string;
  samples: MetricPointSample[];
  value?: number | null;
  valueUnit?: MeasurementMetricPoint["valueUnit"];
  comparisonNumerator?: number | null;
  comparisonDenominator?: number | null;
}): MeasurementMetricPoint {
  const denominator = input.samples.filter((item) => item.included).length;
  const numerator = input.samples.filter((item) => item.included && item.numerator).length;
  const planned = input.samples.length;
  const failed = input.samples.filter((item) => !item.included).length;
  const complete = planned > 0 && failed === 0;
  const value = input.value === undefined ? denominator === 0 ? null : (numerator / denominator) * 100 : input.value;
  return {
    id: `point-${sha256(JSON.stringify({ metric: input.metric, objectId: input.objectId, comparisonObjectId: input.comparisonObjectId || null, keywordId: input.keywordId, model: input.model.modelSnapshot.modelId, run: input.run.id, fingerprint: input.fingerprint })).slice(0, 24)}`,
    projectId: input.projectId, metric: input.metric, objectId: input.objectId, comparisonObjectId: input.comparisonObjectId || null, keywordId: input.keywordId,
    modelId: input.model.modelSnapshot.modelId, modelDisplayName: input.model.modelSnapshot.displayName,
    webSearchMode: input.model.modelSnapshot.webSearchMode, fingerprint: input.fingerprint, runId: input.run.id,
    observedAt: input.run.startedAt || input.run.createdAt, numerator, denominator,
    comparisonNumerator: input.comparisonNumerator === undefined ? null : input.comparisonNumerator,
    comparisonDenominator: input.comparisonDenominator === undefined ? null : input.comparisonDenominator,
    planned, failed, value, valueUnit: input.valueUnit || "percentage",
    complete, pointState: denominator === 0 ? "no_data" : complete ? "complete" : "partial",
    sampleIds: input.samples.map((item) => item.probeRunId), samples: input.samples,
  };
}

function sample(probe: ProbeMaterial, included: boolean, numerator: boolean, exclusionReason: string | null): MetricPointSample {
  return { probeRunId: probe.probe.id, attemptId: probe.attempt?.id || null, included, numerator, exclusionReason };
}

function firstAttempt(detail: import("./measurement-schema.js").MeasurementProbeDetail): import("./measurement-schema.js").ProbeAttempt | null {
  if (!detail.probe.firstAttemptId) return null;
  return detail.attempts.find((attempt) => attempt.id === detail.probe.firstAttemptId) || null;
}

function simpleKey(parts: string[]): string { return parts.join("|"); }

export class ProductMeasurementStatsService {
  constructor(private readonly projects: ProductProjectService, private readonly store: ProductMeasurementFileStore) {}

  async build(projectId: string): Promise<MeasurementStatsSnapshot> {
    await this.projects.get(projectId);
    const runs = (await this.store.listRuns(projectId)).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const source = await Promise.all(runs.map((run) => this.materialForRun(run)));
    const sourceRuns = source.filter((entry) => entry.material.length > 0);
    const snapshotId = `stats-${sha256(JSON.stringify(sourceRuns.map((entry) => ({ runId: entry.run.id, probeIds: entry.material.map((item) => ({ probe: item.probe.id, attempt: item.attempt?.id || null })) })))).slice(0, 24)}`;
    const previous = await this.store.readSnapshot(projectId, snapshotId);
    if (previous) return previous;
    const points: MeasurementMetricPoint[] = [];
    for (const entry of sourceRuns) points.push(...this.pointsForRun(entry.run, entry.watchSet, entry.models, entry.material));
    const snapshot: MeasurementStatsSnapshot = { id: snapshotId, projectId, generatedAt: now(), sourceRunIds: sourceRuns.map((entry) => entry.run.id), points };
    await this.store.saveSnapshot(snapshot);
    return snapshot;
  }

  async get(projectId: string, snapshotId: string): Promise<MeasurementStatsSnapshot> {
    await this.projects.get(projectId);
    const value = await this.store.readSnapshot(projectId, snapshotId);
    if (!value) throw new Error("Measurement statistics snapshot was not found.");
    return value;
  }

  async pointSamples(projectId: string, snapshotId: string, pointId: string): Promise<{ point: MeasurementMetricPoint; samples: Array<{ sample: MetricPointSample; detail: import("./measurement-schema.js").MeasurementProbeDetail | null }> }> {
    const snapshot = await this.get(projectId, snapshotId);
    const point = snapshot.points.find((item) => item.id === pointId);
    if (!point) throw new Error("Measurement point was not found.");
    const samples = [];
    for (const source of point.samples) {
      const detail = await this.findProbe(projectId, point.runId, source.probeRunId);
      samples.push({ sample: source, detail });
    }
    return { point, samples };
  }

  private async materialForRun(run: MeasurementRun): Promise<{ run: MeasurementRun; watchSet: WatchSet; models: MeasurementModelRun[]; material: ProbeMaterial[] }> {
    const watchSet = await this.store.readWatchSet(run.projectId, run.watchSetId);
    if (!watchSet) throw new Error("Measurement run refers to a missing monitoring scope.");
    const models = await this.store.listModelRuns(run.projectId, run.id);
    const material: ProbeMaterial[] = [];
    for (const model of models) {
      for (const probe of await this.store.listProbes(run.projectId, run.id, model.id)) {
        const detail = await this.store.probeDetail(run.projectId, run.id, model.id, probe.id);
        if (!detail) continue;
        material.push({ probe, model, attempt: firstAttempt(detail), domain: detail.domainResult, keyword: detail.keywordResult, mentions: detail.mentions, citations: detail.evidence.providerCitations });
      }
    }
    return { run, watchSet, models, material };
  }

  private pointsForRun(run: MeasurementRun, watchSet: WatchSet, models: MeasurementModelRun[], material: ProbeMaterial[]): MeasurementMetricPoint[] {
    const points: MeasurementMetricPoint[] = [];
    for (const model of models) {
      const modelMaterial = material.filter((item) => item.model.id === model.id);
      const domainByObject = new Map<string, ProbeMaterial[]>();
      const keywordByKeyword = new Map<string, ProbeMaterial[]>();
      for (const item of modelMaterial) {
        if (item.probe.kind === "keyword_discovery" && item.probe.keywordId) {
          const values = keywordByKeyword.get(item.probe.keywordId) || [];
          values.push(item);
          keywordByKeyword.set(item.probe.keywordId, values);
        }
        if (item.probe.protocol.id === "domain-recognition/v1" && item.probe.subjectObjectId) {
          const values = domainByObject.get(item.probe.subjectObjectId) || [];
          values.push(item);
          domainByObject.set(item.probe.subjectObjectId, values);
        }
      }
      for (const object of watchSet.objects) {
        const domains = domainByObject.get(object.id) || [];
        if (domains.length) points.push(this.domainRecognitionPoint(run, model, object, domains));
        for (const watchedKeyword of watchSet.keywords) {
          if (domains.length) points.push(...this.keywordAssociationPoints(run, model, object, watchedKeyword, watchSet, domains));
        }
      }
      for (const watchedKeyword of watchSet.keywords.filter((item) => item.neutralEligible)) {
        const keywords = keywordByKeyword.get(watchedKeyword.id) || [];
        if (!keywords.length) continue;
        for (const object of watchSet.objects) points.push(...this.keywordDiscoveryPoints(run, model, object, watchedKeyword, keywords));
        points.push(...this.recommendationGapPoints(run, model, watchSet, watchedKeyword, points));
      }
    }
    return points;
  }

  private domainRecognitionPoint(run: MeasurementRun, model: MeasurementModelRun, object: WatchObject, material: ProbeMaterial[]): MeasurementMetricPoint {
    const samples = material.map((item) => {
      const included = Boolean(item.domain && item.domain.analysisStatus !== "analysis_failed");
      return sample(item, included, item.domain?.domainRecognition === "recognized", included ? null : item.probe.exclusionReason || "recognition_not_adjudicable");
    });
    return measurementPoint({ projectId: run.projectId, metric: "domain_recognition", objectId: object.id, keywordId: null, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples });
  }

  private keywordAssociationPoints(run: MeasurementRun, model: MeasurementModelRun, object: WatchObject, keyword: WatchSet["keywords"][number], watchSet: WatchSet, material: ProbeMaterial[]): MeasurementMetricPoint[] {
    const selected = material.map((item) => {
      const included = Boolean(item.domain && item.domain.analysisStatus !== "analysis_failed");
      const names = new Set((item.domain?.associatedKeywords || []).map((entry) => entry.keyword.trim().toLocaleLowerCase()));
      return sample(item, included, names.has(keyword.normalizedKeyword), included ? null : item.probe.exclusionReason || "keyword_not_adjudicable");
    });
    const countPoint = measurementPoint({ projectId: run.projectId, metric: "keyword_association_count", objectId: object.id, keywordId: keyword.id, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples: selected, value: selected.filter((item) => item.included && item.numerator).length, valueUnit: "count" });
    const coveragePoint = measurementPoint({ projectId: run.projectId, metric: "keyword_association_coverage", objectId: object.id, keywordId: keyword.id, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples: selected });
    const allKeywords = watchSet.keywords.map((candidate) => {
      let hits = 0;
      for (const item of material) {
        const names = new Set((item.domain?.associatedKeywords || []).map((entry) => entry.keyword.trim().toLocaleLowerCase()));
        if (names.has(candidate.normalizedKeyword)) hits += 1;
      }
      return hits;
    });
    const total = allKeywords.reduce((sum, value) => sum + value, 0);
    const weight = relativeKeywordWeight(countPoint.numerator, total);
    return [countPoint, coveragePoint, { ...countPoint, id: `point-${sha256(`${countPoint.id}:weight`).slice(0, 24)}`, metric: "keyword_relative_weight", value: weight, valueUnit: "percentage", numerator: countPoint.numerator, denominator: total, pointState: total === 0 ? "no_data" : countPoint.complete ? "complete" : "partial" }];
  }

  private keywordDiscoveryPoints(run: MeasurementRun, model: MeasurementModelRun, object: WatchObject, keyword: WatchSet["keywords"][number], material: ProbeMaterial[]): MeasurementMetricPoint[] {
    const basic = (metric: MeasurementMetricId, judge: (mentions: import("./measurement-schema.js").KeywordDiscoveryMention[]) => boolean, applicable: (entry: ProbeMaterial) => boolean): MeasurementMetricPoint => {
      const samples = material.map((item) => {
        const included = applicable(item);
        return sample(item, included, included && judge(item.mentions), included ? null : item.probe.exclusionReason || "keyword_not_adjudicable");
      });
      return measurementPoint({ projectId: run.projectId, metric, objectId: object.id, keywordId: keyword.id, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples });
    };
    const mentioned = (mentions: import("./measurement-schema.js").KeywordDiscoveryMention[]) => mentions.some((item) => item.matchedObjectId === object.id);
    const positive = (mentions: import("./measurement-schema.js").KeywordDiscoveryMention[]) => mentions.some((item) => item.matchedObjectId === object.id && item.recommendation === "positive");
    const firstMention = (mentions: import("./measurement-schema.js").KeywordDiscoveryMention[]) => mentions.filter((item) => item.firstMentionState === "unique").length === 1 && mentions.some((item) => item.matchedObjectId === object.id && item.firstMentionState === "unique");
    const firstRecommendation = (mentions: import("./measurement-schema.js").KeywordDiscoveryMention[]) => mentions.filter((item) => item.firstRecommendationState === "unique").length === 1 && mentions.some((item) => item.matchedObjectId === object.id && item.recommendation === "positive" && item.firstRecommendationState === "unique");
    const known = (entry: ProbeMaterial) => entry.keyword?.mentionJudgment === "adjudicable";
    const recommendationKnown = (entry: ProbeMaterial) => entry.keyword?.recommendationJudgment === "adjudicable";
    const firstMentionKnown = (entry: ProbeMaterial) => entry.keyword?.firstMentionJudgment === "adjudicable";
    const firstRecommendationKnown = (entry: ProbeMaterial) => entry.keyword?.firstRecommendationJudgment === "adjudicable";
    const result = [
      basic("brand_name_mention", mentioned, known),
      basic("positive_recommendation", positive, recommendationKnown),
      basic("first_mention", firstMention, firstMentionKnown),
      basic("first_recommendation", firstRecommendation, firstRecommendationKnown),
    ];
    const domainSamples = material.map((item) => {
      const included = known(item);
      const answer = item.attempt?.rawAnswer || "";
      const host = object.domain || "";
      return sample(item, included, host.length > 0 && answer.includes(host), included ? null : item.probe.exclusionReason || "keyword_not_adjudicable");
    });
    result.push(measurementPoint({ projectId: run.projectId, metric: "domain_body_mention", objectId: object.id, keywordId: keyword.id, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples: domainSamples }));
    const citationSamples = material.map((item) => {
      const online = item.model.modelSnapshot.webSearchMode === "provider_native";
      const included = online && known(item);
      const host = object.domain || "";
      return sample(item, included, host.length > 0 && item.citations.some((citation) => citation.domain === host), included ? null : online ? item.probe.exclusionReason || "citation_not_adjudicable" : "offline_not_applicable");
    });
    result.push(measurementPoint({ projectId: run.projectId, metric: "provider_citation", objectId: object.id, keywordId: keyword.id, model, run, fingerprint: material[0]?.probe.fingerprint.value || "", samples: citationSamples }));
    return result;
  }

  private recommendationGapPoints(run: MeasurementRun, model: MeasurementModelRun, watchSet: WatchSet, keyword: WatchSet["keywords"][number], points: MeasurementMetricPoint[]): MeasurementMetricPoint[] {
    const target = watchSet.objects.find((item) => item.id === watchSet.targetObjectId);
    if (!target) return [];
    const targetPoint = points.find((item) => item.runId === run.id && item.modelId === model.modelSnapshot.modelId && item.metric === "positive_recommendation" && item.objectId === target.id && item.keywordId === keyword.id);
    if (!targetPoint) return [];
    const rows: MeasurementMetricPoint[] = [];
    for (const competitor of watchSet.objects.filter((item) => item.role === "competitor" && item.identityState === "confirmed")) {
      const competitorPoint = points.find((item) => item.runId === run.id && item.modelId === model.modelSnapshot.modelId && item.metric === "positive_recommendation" && item.objectId === competitor.id && item.keywordId === keyword.id);
      if (!competitorPoint) continue;
      const gap = pairedRecommendationGap({ target: targetPoint, competitor: competitorPoint });
      rows.push(measurementPoint({ projectId: run.projectId, metric: "recommendation_gap", objectId: target.id, comparisonObjectId: competitor.id, keywordId: keyword.id, model, run, fingerprint: targetPoint.fingerprint, samples: targetPoint.samples, value: gap, valueUnit: "percentage_points", comparisonNumerator: competitorPoint.numerator, comparisonDenominator: competitorPoint.denominator }));
    }
    return rows;
  }

  private async findProbe(projectId: string, runId: string, probeId: string): Promise<import("./measurement-schema.js").MeasurementProbeDetail | null> {
    for (const model of await this.store.listModelRuns(projectId, runId)) {
      const detail = await this.store.probeDetail(projectId, runId, model.id, probeId);
      if (detail) return detail;
    }
    return null;
  }
}

export function pairedRecommendationGap(input: { target: MeasurementMetricPoint; competitor: MeasurementMetricPoint }): number | null {
  if (input.target.metric !== "positive_recommendation" || input.competitor.metric !== "positive_recommendation") return null;
  if (input.target.runId !== input.competitor.runId || input.target.modelId !== input.competitor.modelId || input.target.webSearchMode !== input.competitor.webSearchMode || input.target.keywordId !== input.competitor.keywordId) return null;
  if (input.target.denominator === 0 || input.competitor.denominator === 0 || input.target.denominator !== input.competitor.denominator) return null;
  if (input.target.samples.length !== input.competitor.samples.length) return null;
  for (let index = 0; index < input.target.samples.length; index += 1) {
    if (input.target.samples[index]?.probeRunId !== input.competitor.samples[index]?.probeRunId) return null;
  }
  return (input.target.value || 0) - (input.competitor.value || 0);
}

export function relativeKeywordWeight(numerator: number, totalAssociations: number): number | null {
  if (totalAssociations === 0) return null;
  return (numerator / totalAssociations) * 100;
}
