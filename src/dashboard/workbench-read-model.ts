import type { MonitoringBaseline } from "../baselines/baseline-schema.js";
import { EvidenceChangeBuilder } from "../changes/evidence-change-builder.js";
import type { EvidenceBackedChangeSet, ObservationChange } from "../changes/change-schema.js";
import { EntityRegistryBuilder } from "../entities/entity-registry-builder.js";
import type { EntityRegistry } from "../entities/entity-schema.js";
import { CitationLandscapeBuilder } from "../insights/citation-landscape.js";
import type { CitationLandscape } from "../insights/insight-schema.js";
import { MonitoringMetricCalculator, MONITORING_METRIC_IDS, type MonitoringMetricId, type MonitoringMetricResult } from "../metrics/monitoring-metrics.js";
import type { MonitoringTask, ProjectRunRecord, RunAnalysisCoverage } from "../monitoring/monitoring-task-schema.js";
import type { MonitoringEvent } from "../monitoring/monitoring-event-schema.js";
import type { Observation } from "../observations/observation-schema.js";
import { buildRunAnalysisCoverage } from "../observations/analysis-qualification.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import { MetricSeriesBuilder } from "../timeseries/metric-series-builder.js";
import { BrandComparisonSeriesBuilder } from "../timeseries/brand-comparison-series.js";
import type { BrandComparisonSeries, MetricSeries, TrendFilter } from "../timeseries/timeseries-schema.js";
import { scopeToProject } from "../projects/project-scope.js";
import { isCompleteRun, isCurrentDataRun, RunSelector, type RunSelection } from "./run-selection.js";

export type QuestionObservationResult = "recommended" | "candidate" | "mentioned" | "absent" | "failed";

export interface QuestionModelResult {
  observationId: string;
  providerId: string;
  model: string;
  result: QuestionObservationResult;
  citationUrls: string[];
}

export interface WorkbenchQuestion {
  promptId: string;
  promptText: string;
  auditCategory: Observation["promptAuditCategory"];
  total: number;
  completed: number;
  mentioned: number;
  candidate: number;
  recommended: number;
  officiallyCited: number;
  modelResults: QuestionModelResult[];
}

export interface WorkbenchAttentionItem {
  id: string;
  kind: ObservationChange["kind"];
  observationIds: string[];
  previousObservationIds: string[];
  promptIds: string[];
  models: string[];
  entities: string[];
  sourceUrls: string[];
  comparable: true;
  status: "changed";
  summary: string;
  evidence: {
    currentObservationIds: string[];
    previousObservationIds: string[];
  };
}

export interface MonitoringTaskSummary {
  task: MonitoringTask;
  baselineName: string;
  questionCount: number;
  modelCount: number;
  requestsPerRun: number;
  estimatedMonthlyRequests: number | null;
  lastRun?: ProjectRunRecord | undefined;
}

export interface WorkbenchMetricChange {
  metricId: MonitoringMetricId;
  comparable: boolean;
  delta: number | null;
  summary: string;
  evidence: {
    currentObservationIds: string[];
    previousObservationIds: string[];
  };
}

export interface WorkbenchScope {
  range: TrendFilter["range"];
  from?: string | undefined;
  to?: string | undefined;
  runCount: number;
  completeRunCount: number;
  observationCount: number;
  completedAnswerCount: number;
  promptCount: number;
  modelCount: number;
}

export interface WorkbenchReadModel {
  project: MonitoringProject;
  generatedAt: string;
  selectedBaseline?: MonitoringBaseline | undefined;
  runSelection: RunSelection;
  latestRun: ProjectRunRecord | null;
  latestCompleteRun: ProjectRunRecord | null;
  currentDataRun: ProjectRunRecord | null;
  comparisonCurrentRun: ProjectRunRecord | null;
  comparisonPreviousRun: ProjectRunRecord | null;
  latestProviderCompleteRun: ProjectRunRecord | null;
  analysisCoverage: RunAnalysisCoverage | null;
  latestRunComplete: boolean;
  scope: WorkbenchScope;
  latestMetrics: MonitoringMetricResult[];
  previousMetrics: MonitoringMetricResult[];
  metricChanges: WorkbenchMetricChange[];
  changes: EvidenceBackedChangeSet;
  attention: WorkbenchAttentionItem[];
  series: MetricSeries[];
  brandComparisons: BrandComparisonSeries[];
  questions: WorkbenchQuestion[];
  entities: EntityRegistry;
  citations: CitationLandscape;
  tasks: MonitoringTaskSummary[];
  runs: ProjectRunRecord[];
  events: MonitoringEvent[];
  observationIds: string[];
}

function finishedAt(run: ProjectRunRecord): string {
  return run.finishedAt || run.startedAt;
}

function observationResult(observation: Observation): QuestionObservationResult {
  if (observation.status !== "completed" || !observation.evidence.hasAnswer || observation.analysisStatus !== "completed") return "failed";
  if (observation.analysisResult?.brandRecommended === true) return "recommended";
  if (observation.analysisResult?.brandCandidate === true) return "candidate";
  if (observation.analysisResult?.brandMentioned !== true) return "absent";
  return "mentioned";
}

function inRange(value: string, filter: TrendFilter): boolean {
  if (filter.range === "all") return true;
  const now = new Date(filter.now || new Date().toISOString()).getTime();
  const hours = filter.range === "24h" ? 24 : filter.range === "7d" ? 24 * 7 : filter.range === "30d" ? 24 * 30 : 24 * 90;
  return new Date(value).getTime() >= now - hours * 60 * 60 * 1000;
}

function filteredObservations(observations: Observation[], filter: TrendFilter): Observation[] {
  return observations.filter((observation) => {
    if (!inRange(observation.finishedAt, filter)) return false;
    if (filter.model && observation.model !== filter.model) return false;
    if (filter.searchUsed !== undefined && observation.search?.used !== filter.searchUsed) return false;
    return true;
  });
}

function facetObservations(observations: Observation[], filter: TrendFilter): Observation[] {
  return observations.filter((observation) => {
    if (filter.model && observation.model !== filter.model) return false;
    if (filter.searchUsed !== undefined && observation.search?.used !== filter.searchUsed) return false;
    return true;
  });
}

function taskMonthlyMultiplier(task: MonitoringTask): number | null {
  if (task.schedule.kind === "daily") return 30;
  if (task.schedule.kind === "weekly") return 4;
  if (task.schedule.kind === "monthly") return 1;
  if (task.schedule.kind === "manual") return 0;
  return null;
}

function metricRows(calculator: MonitoringMetricCalculator, observations: Observation[], projectId: string, run: ProjectRunRecord | undefined): MonitoringMetricResult[] {
  return calculator.calculateAll(observations, {
    projectId,
    baselineId: run?.baselineId,
    runId: run?.id,
  });
}

function changeSummary(project: MonitoringProject, change: ObservationChange, observations: Observation[]): string {
  const evidenceIds = [...change.currentObservationIds, ...change.previousObservationIds];
  const observation = observations.find((row) => evidenceIds.includes(row.id));
  const question = observation?.promptText || "";
  const chinese = project.defaultLanguage.toLocaleLowerCase().split("-")[0] === "zh";
  const subject = question ? `“${question}”` : chinese ? "一个监测问题" : "a monitored question";
  if (chinese) {
    if (change.kind === "brand_appeared") return `${project.name} 开始出现在${subject}的回答中。`;
    if (change.kind === "brand_disappeared") return `${project.name} 不再出现在${subject}的回答中。`;
    if (change.kind === "candidate_entered") return `${project.name} 在${subject}中进入候选。`;
    if (change.kind === "candidate_left") return `${project.name} 在${subject}中退出候选。`;
    if (change.kind === "recommendation_gained") return `${project.name} 开始在${subject}中被明确推荐。`;
    if (change.kind === "recommendation_lost") return `${project.name} 不再在${subject}中被明确推荐。`;
    if (change.kind === "official_citation_added") return `${subject}新增了目标官网引用。`;
    if (change.kind === "official_citation_removed") return `${subject}不再引用目标官网。`;
    if (change.kind === "competitor_appeared_without_target") return `${change.entityNames.join("、") || "竞争对象"}出现在${subject}中，而目标品牌没有出现。`;
    return `${subject}中的竞争对象不再替代目标品牌出现。`;
  }
  if (change.kind === "brand_appeared") return `${project.name} started appearing for ${subject}.`;
  if (change.kind === "brand_disappeared") return `${project.name} stopped appearing for ${subject}.`;
  if (change.kind === "candidate_entered") return `${project.name} entered the candidate set for ${subject}.`;
  if (change.kind === "candidate_left") return `${project.name} left the candidate set for ${subject}.`;
  if (change.kind === "recommendation_gained") return `${project.name} is now explicitly recommended for ${subject}.`;
  if (change.kind === "recommendation_lost") return `${project.name} is no longer explicitly recommended for ${subject}.`;
  if (change.kind === "official_citation_added") return `${subject} gained an official-site citation.`;
  if (change.kind === "official_citation_removed") return `${subject} lost an official-site citation.`;
  if (change.kind === "competitor_appeared_without_target") return `${change.entityNames.join(", ") || "A competitor"} appeared for ${subject} while the target did not.`;
  return `A competing entity stopped replacing the target for ${subject}.`;
}

function metricChangeKinds(metricId: MonitoringMetricId): ObservationChange["kind"][] {
  if (metricId === "brand_discovery") return ["brand_appeared", "brand_disappeared"];
  if (metricId === "candidate_inclusion") return ["candidate_entered", "candidate_left"];
  if (metricId === "explicit_recommendation") return ["recommendation_gained", "recommendation_lost"];
  return ["official_citation_added", "official_citation_removed"];
}

function metricChangeSummary(delta: number | null, comparable: boolean, language: string): string {
  const chinese = language.toLocaleLowerCase().split("-")[0] === "zh";
  if (!comparable || delta === null) return chinese ? "暂无可比变化" : "No comparable change";
  if (delta === 0) return chinese ? "无变化" : "No change";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export class WorkbenchReadModelBuilder {
  private readonly metrics = new MonitoringMetricCalculator();
  private readonly changes = new EvidenceChangeBuilder();
  private readonly series = new MetricSeriesBuilder();
  private readonly brandComparisons = new BrandComparisonSeriesBuilder();
  private readonly entities = new EntityRegistryBuilder();
  private readonly citations = new CitationLandscapeBuilder();
  private readonly runSelector = new RunSelector();

  build(input: {
    project: MonitoringProject;
    baselines: MonitoringBaseline[];
    tasks: MonitoringTask[];
    runs: ProjectRunRecord[];
    observations: Observation[];
    events?: MonitoringEvent[] | undefined;
    filter: TrendFilter;
    baselineId?: string | undefined;
  }): WorkbenchReadModel {
    const projectId = input.project.id;
    const projectBaselines = scopeToProject(projectId, input.baselines);
    const projectTasks = scopeToProject(projectId, input.tasks);
    const projectRuns = scopeToProject(projectId, input.runs);
    const projectObservations = scopeToProject(projectId, input.observations);
    const projectEvents = scopeToProject(projectId, input.events || []);
    const runs = [...projectRuns].sort((a, b) => finishedAt(b).localeCompare(finishedAt(a)));
    const decision = this.runSelector.select({
      projectId,
      baselines: projectBaselines,
      runs,
      requestedBaselineId: input.baselineId,
    });
    const runSelection = decision.selection;
    const selectedBaseline = projectBaselines.find((baseline) => baseline.id === decision.baselineId);
    const providerCompleteObservations = runSelection.latestProviderCompleteRun
      ? projectObservations.filter((observation) => observation.runId === runSelection.latestProviderCompleteRun?.id)
      : [];
    const analysisCoverage = runSelection.latestProviderCompleteRun
      ? runSelection.latestProviderCompleteRun.analysisCoverage || buildRunAnalysisCoverage(providerCompleteObservations)
      : null;
    const scopedObservations = filteredObservations(projectObservations, input.filter);
    const scopedRuns = runs.filter((run) => inRange(finishedAt(run), input.filter));
    const allLatestObservations = runSelection.currentDataRun
      ? projectObservations.filter((observation) => observation.runId === runSelection.currentDataRun?.id)
      : [];
    const latestObservations = facetObservations(allLatestObservations, input.filter);
    const allPreviousObservations = runSelection.comparisonPreviousRun
      ? projectObservations.filter((observation) => observation.runId === runSelection.comparisonPreviousRun?.id)
      : [];
    const previousObservations = facetObservations(allPreviousObservations, input.filter);
    const changeSet = selectedBaseline
      ? this.changes.build({
          baselineId: selectedBaseline.id,
          currentRun: runSelection.comparisonCurrentRun,
          previousRun: runSelection.comparisonPreviousRun,
          observations: [...latestObservations, ...previousObservations],
        })
      : { comparable: false, reasonKey: "changes.noBaseline", changes: [] };
    const questions = new Map<string, WorkbenchQuestion>();
    for (const observation of latestObservations) {
      const current = questions.get(observation.promptId) || {
        promptId: observation.promptId,
        promptText: observation.promptText,
        auditCategory: observation.promptAuditCategory,
        total: 0,
        completed: 0,
        mentioned: 0,
        candidate: 0,
        recommended: 0,
        officiallyCited: 0,
        modelResults: [],
      };
      const result = observationResult(observation);
      const modelResult: QuestionModelResult = {
        observationId: observation.id,
        providerId: observation.providerId,
        model: observation.model,
        result,
        citationUrls: observation.citations.map((citation) => citation.url),
      };
      current.total += 1;
      if (result !== "failed") current.completed += 1;
      if (result === "mentioned" || result === "candidate" || result === "recommended") current.mentioned += 1;
      if (result === "candidate" || result === "recommended") current.candidate += 1;
      if (result === "recommended") current.recommended += 1;
      if (observation.evidence.officialCitationCount > 0) current.officiallyCited += 1;
      current.modelResults.push(modelResult);
      questions.set(observation.promptId, current);
    }
    const scopedTimes = scopedObservations.map((observation) => observation.finishedAt).sort((a, b) => a.localeCompare(b));
    const series = selectedBaseline
      ? MONITORING_METRIC_IDS.map((metricId: MonitoringMetricId) =>
          this.series.build({
            projectId,
            baselineId: selectedBaseline.id,
            metricId,
            runs,
            observations: projectObservations,
            filter: input.filter,
          }),
        )
      : [];
    const brandComparisons = selectedBaseline
      ? MONITORING_METRIC_IDS.map((metricId: MonitoringMetricId) =>
          this.brandComparisons.build({
            projectId,
            projectName: input.project.name,
            baselineId: selectedBaseline.id,
            metricId,
            runs,
            observations: projectObservations,
            filter: input.filter,
          }),
        )
      : [];
    const baselineMap = new Map(projectBaselines.map((baseline) => [baseline.id, baseline]));
    const runMap = new Map(runs.map((run) => [run.id, run]));
    const taskSummaries = projectTasks.map((task) => {
      const baseline = baselineMap.get(task.baselineId);
      const questionCount = baseline?.prompts.filter((prompt) => prompt.enabled).length || 0;
      const modelCount = baseline?.providerTargets.length || 0;
      const requestsPerRun = questionCount * modelCount * (baseline?.runCountPerPrompt || 1);
      const multiplier = taskMonthlyMultiplier(task);
      const summary: MonitoringTaskSummary = {
        task: {
          ...task,
          name: task.name || baseline?.name || task.id,
          notifications: task.notifications || { conditions: [], channels: [] },
        },
        baselineName: baseline?.name || "",
        questionCount,
        modelCount,
        requestsPerRun,
        estimatedMonthlyRequests: multiplier === null ? null : requestsPerRun * multiplier,
      };
      const lastRun = task.lastRunId ? runMap.get(task.lastRunId) : undefined;
      if (lastRun) summary.lastRun = lastRun;
      return summary;
    });
    const visibleChanges = changeSet.changes;
    const latestMetrics = metricRows(this.metrics, latestObservations, projectId, runSelection.currentDataRun || undefined);
    const previousMetrics = changeSet.comparable
      ? metricRows(this.metrics, previousObservations, projectId, runSelection.comparisonPreviousRun || undefined)
      : [];
    const metricChanges = MONITORING_METRIC_IDS.map((metricId): WorkbenchMetricChange => {
      const current = latestMetrics.find((metric) => metric.metricId === metricId);
      const previous = previousMetrics.find((metric) => metric.metricId === metricId);
      const comparable = Boolean(
        changeSet.comparable &&
        current &&
        previous &&
        current.denominator > 0 &&
        current.denominator === previous.denominator,
      );
      const delta = comparable && current && previous ? current.numerator - previous.numerator : null;
      const kinds = metricChangeKinds(metricId);
      const evidenceChanges = visibleChanges.filter((change) => kinds.includes(change.kind));
      return {
        metricId,
        comparable,
        delta,
        summary: metricChangeSummary(delta, comparable, input.project.defaultLanguage),
        evidence: {
          currentObservationIds: uniqueStrings(evidenceChanges.flatMap((change) => change.currentObservationIds)),
          previousObservationIds: uniqueStrings(evidenceChanges.flatMap((change) => change.previousObservationIds)),
        },
      };
    });
    const model: WorkbenchReadModel = {
      project: input.project,
      generatedAt: new Date().toISOString(),
      runSelection,
      latestRun: runSelection.latestRun,
      latestCompleteRun: runSelection.latestCompleteRun,
      currentDataRun: runSelection.currentDataRun,
      comparisonCurrentRun: runSelection.comparisonCurrentRun,
      comparisonPreviousRun: runSelection.comparisonPreviousRun,
      latestProviderCompleteRun: runSelection.latestProviderCompleteRun,
      analysisCoverage,
      latestRunComplete: Boolean(runSelection.latestRun && isCompleteRun(runSelection.latestRun)),
      scope: {
        range: input.filter.range,
        from: scopedTimes[0],
        to: scopedTimes[scopedTimes.length - 1],
        runCount: scopedRuns.length,
        completeRunCount: scopedRuns.filter(isCurrentDataRun).length,
        observationCount: scopedObservations.length,
        completedAnswerCount: scopedObservations.filter((observation) => observation.status === "completed" && observation.evidence.hasAnswer).length,
        promptCount: new Set(scopedObservations.map((observation) => observation.promptId)).size,
        modelCount: new Set(scopedObservations.map((observation) => observation.model)).size,
      },
      latestMetrics,
      previousMetrics,
      metricChanges,
      changes: { ...changeSet, changes: visibleChanges },
      attention: visibleChanges.slice(0, 3).map((change) => ({
        id: change.id,
        kind: change.kind,
        observationIds: change.currentObservationIds,
        previousObservationIds: change.previousObservationIds,
        promptIds: change.promptIds,
        models: change.models,
        entities: change.entityNames,
        sourceUrls: change.citationUrls,
        comparable: true,
        status: "changed",
        summary: changeSummary(input.project, change, projectObservations),
        evidence: {
          currentObservationIds: change.currentObservationIds,
          previousObservationIds: change.previousObservationIds,
        },
      })),
      series,
      brandComparisons,
      questions: [...questions.values()],
      entities: this.entities.build(latestObservations),
      citations: this.citations.build(latestObservations),
      tasks: taskSummaries,
      runs,
      events: projectEvents.filter((event) => inRange(event.createdAt, input.filter)).slice(0, 20),
      observationIds: latestObservations.map((observation) => observation.id),
    };
    if (selectedBaseline) model.selectedBaseline = selectedBaseline;
    return model;
  }
}
