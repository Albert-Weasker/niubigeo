import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { hasProviderKey, loadDotEnv, monitoringDataDir, productDataDir, runsDir } from "./config/env.js";
import { ProviderCatalog, PROVIDER_MODEL_CAPABILITIES } from "./providers/catalog.js";
import { AuditRunner } from "./runner/audit-runner.js";
import { AuditPlanner } from "./runner/audit-planner.js";
import { entityFromInput } from "./utils/domain.js";
import type { AuditPlan, Entity, KeywordMode, MonitoringPrompt, PromptAuditCategory, PromptType, ProviderTarget, WebSearchRequestMode } from "./core/types.js";
import { renderAppHtml } from "./ui/app-html.js";
import { sha256 } from "./utils/hash.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "./core/version.js";
import { ProjectFileStore } from "./projects/project-store.js";
import { ObservationReanalysisService } from "./observations/observation-reanalysis-service.js";
import { BaselineIntentService } from "./baselines/baseline-intent-service.js";
import { RunOrchestrator } from "./monitoring/run-orchestrator.js";
import { MonitoringService } from "./monitoring/monitoring-service.js";
import { LegacyRunImporter } from "./projects/legacy-run-importer.js";
import type {
  MonitoringNotificationChannel,
  MonitoringNotificationChannelType,
  MonitoringNotificationCondition,
  MonitoringNotificationPolicy,
  MonitoringSchedule,
} from "./monitoring/monitoring-task-schema.js";
import { ProjectService } from "./projects/project-service.js";
import { BaselineService } from "./baselines/baseline-service.js";
import { splitByCharacters } from "./utils/text.js";
import { WorkbenchReadModelBuilder } from "./dashboard/workbench-read-model.js";
import type { TrendFilter, TrendRange } from "./timeseries/timeseries-schema.js";
import { RunSnapshotBuilder } from "./dashboard/run-snapshot-model.js";
import { parseStoredBrandQuestionClassification } from "./prompts/brand-question.js";
import { AsyncJobRegistry } from "./jobs/async-job-registry.js";
import { emptyAuditProgress, type AuditProgressListener, type AuditProgressSnapshot } from "./runner/audit-progress.js";
import { ProductProjectFileStore } from "./product/projects/project-store.js";
import { ProductProjectService } from "./product/projects/project-service.js";
import { handleProductProjectApi } from "./product/projects/project-http.js";
import { renderProductPhase2AppHtml } from "./ui/product-phase2-app.js";
import { ProductConfigurationFileStore } from "./product/configuration/configuration-store.js";
import { OpenRouterProductModelCatalog } from "./product/configuration/model-catalog.js";
import { ProductModelSelectionService } from "./product/configuration/model-selection-service.js";
import { ProductBaselineService } from "./product/configuration/baseline-service.js";
import { handleProductConfigurationApi } from "./product/configuration/configuration-http.js";
import { ProductRecognitionFileStore } from "./product/recognition/recognition-store.js";
import { ProductRecognitionRunService } from "./product/recognition/recognition-service.js";
import type { RecognitionAnswerExecutor } from "./product/recognition/recognition-service.js";
import { handleProductRecognitionApi, handleProductRecognitionRetryApi } from "./product/recognition/recognition-http.js";
import type { ProductModelCatalog } from "./product/configuration/model-selection-schema.js";

loadDotEnv();

type AuditJobResult = {
  auditId: string;
  projectId: string;
  baselineId: string;
  projectRunId: string;
  metrics: unknown;
  gaps: unknown;
  paths: unknown;
};

const auditJobs = new AsyncJobRegistry<AuditProgressSnapshot, AuditJobResult>();
const defaultProductModelCatalog = new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES);

export interface ProductServerDependencies {
  modelCatalog?: ProductModelCatalog | undefined;
  recognitionExecutor?: RecognitionAnswerExecutor | undefined;
}

function send(res: ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(contentType === "application/json" ? JSON.stringify(body, null, 2) : String(body));
}

function assetContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function sendAsset(res: ServerResponse, path: string): Promise<void> {
  res.writeHead(200, {
    "Content-Type": assetContentType(path),
    "Cache-Control": "public, max-age=3600",
  });
  res.end(await readFile(path));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function providerTargetsFromBody(body: Record<string, unknown>): ProviderTarget[] {
  const webSearchEnabled = typeof body.webSearchEnabled === "boolean" ? body.webSearchEnabled : undefined;
  const webSearchMode = webSearchEnabled ? "provider_native" : webSearchModeFromBody(body.webSearchMode);
  if (Array.isArray(body.providerTargets)) {
    return body.providerTargets.map((item) => {
      const row = item as Record<string, unknown>;
      const rowWebSearchEnabled = typeof row.webSearchEnabled === "boolean" ? row.webSearchEnabled : webSearchEnabled;
      return {
        providerId: String(row.providerId),
        model: String(row.model),
        webSearchEnabled: rowWebSearchEnabled,
        webSearchMode: rowWebSearchEnabled ? "provider_native" : webSearchModeFromBody(row.webSearchMode) || webSearchMode,
      };
    });
  }
  const providerId = String(body.provider || "openrouter");
  if (Array.isArray(body.models)) {
    return body.models.map((model) => ({ providerId, model: String(model), webSearchEnabled, webSearchMode }));
  }
  if (typeof body.models === "string") {
    return body.models
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
      .map((model) => ({ providerId, model, webSearchEnabled, webSearchMode }));
  }
  return [{ providerId, model: String(body.model || "openai/gpt-4o-mini"), webSearchEnabled, webSearchMode }];
}

function webSearchModeFromBody(value: unknown): WebSearchRequestMode | undefined {
  if (value === "auto" || value === "provider_native") return value;
  return undefined;
}

function stringListFromBody(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return splitByCharacters(value, new Set(["\n", ",", "，", ";", "；", "|"]))
    .map((item) => item.trim())
    .filter(Boolean);
}

function keywordModeFromBody(value: unknown): KeywordMode | undefined {
  if (value === "site_plus_user" || value === "user_only" || value === "site_only") return value;
  return undefined;
}

function promptTypeFromBody(value: unknown): PromptType | null {
  const text = typeof value === "string" ? value : "";
  const allowed = new Set<PromptType>([
    "brand",
    "category",
    "recommendation",
    "comparison",
    "alternative",
    "scenario",
    "keyword_category",
    "keyword_recommendation",
    "keyword_comparison",
    "keyword_alternative",
    "keyword_scenario",
    "keyword_source",
  ]);
  return allowed.has(text as PromptType) ? (text as PromptType) : null;
}

function promptAuditCategoryFromBody(value: unknown): PromptAuditCategory | undefined {
  if (value === "brand_awareness" || value === "organic_discovery" || value === "comparison" || value === "other") return value;
  return undefined;
}

function monitoringScheduleFromBody(value: unknown): MonitoringSchedule {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const kind = row.kind;
  if (kind !== "manual" && kind !== "daily" && kind !== "weekly" && kind !== "monthly" && kind !== "cron") {
    throw new Error("schedule.kind must be manual, daily, weekly, monthly, or cron");
  }
  const schedule: MonitoringSchedule = {
    kind,
    timezone: typeof row.timezone === "string" && row.timezone.trim() ? row.timezone.trim() : "UTC",
  };
  if (typeof row.cron === "string") schedule.cron = row.cron;
  if (typeof row.hour === "number") schedule.hour = row.hour;
  if (typeof row.minute === "number") schedule.minute = row.minute;
  if (typeof row.dayOfWeek === "number") schedule.dayOfWeek = row.dayOfWeek;
  if (typeof row.dayOfMonth === "number") schedule.dayOfMonth = row.dayOfMonth;
  return schedule;
}

const NOTIFICATION_CONDITIONS = new Set<MonitoringNotificationCondition>([
  "brand_disappeared",
  "competitor_appeared",
  "official_citation_added",
  "recommendation_changed",
  "run_completed",
  "run_failed",
]);

const NOTIFICATION_CHANNEL_TYPES = new Set<MonitoringNotificationChannelType>([
  "email",
  "webhook",
  "slack",
  "discord",
  "wecom",
  "lark",
]);

function notificationPolicyFromBody(value: unknown): MonitoringNotificationPolicy {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const conditions = Array.isArray(row.conditions)
    ? row.conditions.map(String).filter((item): item is MonitoringNotificationCondition => NOTIFICATION_CONDITIONS.has(item as MonitoringNotificationCondition))
    : [];
  const channels: MonitoringNotificationChannel[] = [];
  if (Array.isArray(row.channels)) {
    for (const item of row.channels) {
      if (typeof item !== "object" || item === null) continue;
      const channel = item as Record<string, unknown>;
      const type = String(channel.type || "");
      const target = String(channel.target || "").trim();
      if (!NOTIFICATION_CHANNEL_TYPES.has(type as MonitoringNotificationChannelType) || !target) continue;
      channels.push({
        id: typeof channel.id === "string" && channel.id.trim() ? channel.id.trim() : `channel-${channels.length + 1}`,
        type: type as MonitoringNotificationChannelType,
        target,
        enabled: channel.enabled !== false,
      });
    }
  }
  return { conditions: [...new Set(conditions)], channels };
}

function taskBaselineConfigurationFromBody(value: unknown): {
  selectedPromptIds?: string[] | undefined;
  providerTargets?: ProviderTarget[] | undefined;
  language?: string | undefined;
  runCountPerPrompt?: number | undefined;
} | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const selectedPromptIds = Array.isArray(row.selectedPromptIds)
    ? [...new Set(row.selectedPromptIds.map(String).map((item) => item.trim()).filter(Boolean))]
    : undefined;
  const providerTargets = Array.isArray(row.providerTargets)
    ? providerTargetsFromBody({ providerTargets: row.providerTargets })
    : undefined;
  const language = typeof row.language === "string" && row.language.trim() ? row.language.trim() : undefined;
  const runCountPerPrompt = typeof row.runCountPerPrompt === "number" && Number.isInteger(row.runCountPerPrompt) && row.runCountPerPrompt > 0
    ? row.runCountPerPrompt
    : undefined;
  if (!selectedPromptIds && !providerTargets && !language && !runCountPerPrompt) return undefined;
  return { selectedPromptIds, providerTargets, language, runCountPerPrompt };
}

function trendFilterFromUrl(url: URL): TrendFilter {
  const requestedRange = url.searchParams.get("range");
  const allowedRanges = new Set<TrendRange>(["24h", "7d", "30d", "90d", "all"]);
  const range = allowedRanges.has(requestedRange as TrendRange) ? (requestedRange as TrendRange) : "30d";
  const timezone = url.searchParams.get("timezone")?.trim() || "UTC";
  const model = url.searchParams.get("model")?.trim();
  const requestedSearch = url.searchParams.get("searchUsed");
  const filter: TrendFilter = { range, timezone };
  if (model) filter.model = model;
  if (requestedSearch === "true") filter.searchUsed = true;
  if (requestedSearch === "false") filter.searchUsed = false;
  return filter;
}

function entityFromPlanRow(value: unknown, fallbackType: Entity["type"], fallbackDomain = ""): Entity {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return entityFromInput({
    type: row.type === "target" || row.type === "competitor" ? row.type : fallbackType,
    domain: typeof row.domain === "string" && row.domain.trim() ? row.domain : fallbackDomain,
    name: typeof row.name === "string" ? row.name : undefined,
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
    githubRepo: typeof row.githubRepo === "string" ? row.githubRepo : undefined,
  });
}

function promptFromPlanRow(value: unknown, index: number, language: string): MonitoringPrompt | null {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  const type = promptTypeFromBody(row.type);
  const auditCategory = promptAuditCategoryFromBody(row.auditCategory);
  if (!type || !auditCategory || typeof row.targetIncluded !== "boolean") {
    throw new Error(`confirmedPlan question ${index + 1} requires Provider-classified type, auditCategory, and targetIncluded.`);
  }
  const prompt: MonitoringPrompt = {
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `prompt-${index + 1}`,
    type,
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : type,
    language: typeof row.language === "string" && row.language.trim() ? row.language.trim() : language,
    text,
    enabled: row.enabled !== false,
    auditCategory,
    targetIncluded: row.targetIncluded,
    keywordIds: Array.isArray(row.keywordIds) ? row.keywordIds.map(String).filter(Boolean) : undefined,
    keywordClusterId: typeof row.keywordClusterId === "string" ? row.keywordClusterId : undefined,
    keywordIntent:
      row.keywordIntent === "category" ||
      row.keywordIntent === "recommendation" ||
      row.keywordIntent === "comparison" ||
      row.keywordIntent === "alternative" ||
      row.keywordIntent === "scenario" ||
      row.keywordIntent === "source"
        ? row.keywordIntent
        : undefined,
    seedSource:
      row.seedSource === "user_keyword" ||
      row.seedSource === "site_keyword" ||
      row.seedSource === "github_keyword" ||
      row.seedSource === "provider_generated"
        ? row.seedSource
        : undefined,
  };
  const brandQuestion = parseStoredBrandQuestionClassification(row.brandQuestion);
  if (brandQuestion) prompt.brandQuestion = brandQuestion;
  return prompt;
}

function confirmedPromptSetHash(input: { prompts: MonitoringPrompt[]; providerTargets: ProviderTarget[]; language: string }): string {
  return sha256(
    JSON.stringify({
      language: input.language,
      providerTargets: input.providerTargets.map((target) => ({
        providerId: target.providerId,
        model: target.model,
        webSearchEnabled: Boolean(target.webSearchEnabled),
        webSearchMode: target.webSearchEnabled ? "provider_native" : target.webSearchMode || "auto",
      })),
      prompts: input.prompts.map((prompt) => ({
        type: prompt.type,
        auditCategory: prompt.auditCategory,
        text: prompt.text,
        enabled: prompt.enabled,
        keywordIds: prompt.keywordIds || [],
        brandQuestion: prompt.brandQuestion,
      })),
    }),
  ).slice(0, 12);
}

function auditPlanFromBody(value: unknown): AuditPlan {
  if (typeof value !== "object" || value === null) throw new Error("confirmedPlan is required.");
  const row = value as Record<string, unknown>;
  const language = typeof row.language === "string" && row.language.trim() ? row.language.trim() : "en";
  const target = entityFromPlanRow(row.target, "target", typeof row.submittedDomain === "string" ? row.submittedDomain : "");
  const prompts = Array.isArray(row.prompts)
    ? row.prompts.map((item, index) => promptFromPlanRow(item, index, language)).filter((item): item is MonitoringPrompt => Boolean(item))
    : [];
  const providerTargets = Array.isArray(row.providerTargets)
    ? providerTargetsFromBody({ providerTargets: row.providerTargets })
    : [];
  if (!target.domain) throw new Error("confirmedPlan.target.domain is required.");
  if (prompts.length === 0) throw new Error("confirmedPlan.prompts must contain at least one prompt.");
  if (providerTargets.length === 0) throw new Error("confirmedPlan.providerTargets must contain at least one provider/model.");
  const hash = confirmedPromptSetHash({ prompts, providerTargets, language });
  const promptSetVersion = typeof row.promptSetVersion === "string" && row.promptSetVersion !== "custom" ? row.promptSetVersion : PROMPT_SET_VERSION;
  return {
    ...(row as Partial<AuditPlan>),
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `plan-${Date.now()}`,
    submittedDomain: typeof row.submittedDomain === "string" && row.submittedDomain.trim() ? row.submittedDomain.trim() : target.domain,
    target,
    competitors: Array.isArray(row.competitors)
      ? row.competitors.map((item) => entityFromPlanRow(item, "competitor")).filter((item) => Boolean(item.domain))
      : [],
    prompts,
    providerTargets,
    language,
    autoDiscover: Boolean(row.autoDiscover),
    promptSetId: `${promptSetVersion}-${hash}`,
    promptSetHash: hash,
    promptSetVersion,
    analysisRulesVersion: typeof row.analysisRulesVersion === "string" && row.analysisRulesVersion !== "custom" ? row.analysisRulesVersion : ANALYSIS_RULES_VERSION,
    runCountPerPrompt: typeof row.runCountPerPrompt === "number" ? row.runCountPerPrompt : 1,
    plannedAt: typeof row.plannedAt === "string" ? row.plannedAt : new Date().toISOString(),
    estimate:
      typeof row.estimate === "object" && row.estimate !== null
        ? (row.estimate as AuditPlan["estimate"])
        : {
            enabledPromptCount: prompts.filter((prompt) => prompt.enabled).length,
            disabledPromptCount: prompts.filter((prompt) => !prompt.enabled).length,
            providerTargetCount: providerTargets.length,
            providerRunCount: prompts.filter((prompt) => prompt.enabled).length * providerTargets.length,
          },
  };
}

function auditInputFromBody(body: Record<string, unknown>) {
  const domain = typeof body.domain === "string" ? body.domain : "";
  const competitors = stringListFromBody(body.competitors).map((domainValue) =>
    entityFromInput({ type: "competitor", domain: domainValue }),
  );
  return {
    domain,
    target: entityFromInput({
      type: "target",
      domain,
      name: typeof body.name === "string" ? body.name : undefined,
      aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : [],
      githubRepo: typeof body.githubRepo === "string" ? body.githubRepo : undefined,
    }),
    competitors,
    providerTargets: providerTargetsFromBody(body),
    language: typeof body.language === "string" ? body.language : "en",
    promptCount: typeof body.promptCount === "number" ? body.promptCount : 8,
    manualPrompts: Array.isArray(body.prompts) ? body.prompts.map(String) : undefined,
    keywords: stringListFromBody(body.keywords),
    keywordMode: keywordModeFromBody(body.keywordMode) || "site_plus_user",
    keywordLimit: typeof body.keywordLimit === "number" ? body.keywordLimit : 6,
    promptsPerKeyword: typeof body.promptsPerKeyword === "number" ? body.promptsPerKeyword : 2,
    autoDiscover: body.autoDiscover !== false,
    targetNameExplicit: typeof body.name === "string" && Boolean(body.name.trim()),
  };
}

function initialProgressForPlan(
  plan: Pick<AuditPlan, "prompts" | "providerTargets" | "runCountPerPrompt">,
): AuditProgressSnapshot {
  const enabledPromptCount = plan.prompts.filter((prompt) => prompt.enabled).length;
  const repeatCount = plan.runCountPerPrompt || 1;
  return {
    ...emptyAuditProgress(),
    plannedObservationCount: enabledPromptCount * plan.providerTargets.length * repeatCount,
    models: plan.providerTargets.map((target) => ({
      providerId: target.providerId,
      model: target.model,
      planned: enabledPromptCount * repeatCount,
      completed: 0,
      failed: 0,
    })),
  };
}

async function runConfirmedAudit(
  body: Record<string, unknown>,
  projectStore: ProjectFileStore,
  onProgress?: AuditProgressListener,
): Promise<AuditJobResult> {
  const confirmedPlan = auditPlanFromBody(body.confirmedPlan);
  const projectService = new ProjectService();
  const candidate = projectService.projectFromAuditPlan(confirmedPlan);
  const existing = await projectStore.readProject(candidate.id);
  const project = projectService.projectFromAuditPlan(confirmedPlan, existing || undefined);
  await projectStore.saveProject(project);
  const baseline = await new BaselineService(projectStore).createFromConfirmedPlan(project.id, confirmedPlan);
  const monitored = await new RunOrchestrator(projectStore).runBaseline({
    project,
    baseline,
    maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    onProgress,
  });
  const output = monitored.runnerOutput;
  return {
    auditId: output.audit.id,
    projectId: monitored.materialized.project.id,
    baselineId: monitored.materialized.baseline.id,
    projectRunId: monitored.materialized.run.id,
    metrics: output.metrics,
    gaps: output.gaps,
    paths: output.paths,
  };
}

function conditionSignature(report: any): string {
  const audit = report.audit || {};
  const promptHash = audit.promptSetHash || "";
  const providerModels = (audit.providerTargets || [])
    .map((target: any) => `${target.providerId}:${target.model}:${Boolean(target.webSearchEnabled)}:${target.webSearchEnabled ? "provider_native" : target.webSearchMode || "auto"}`)
    .sort()
    .join("|");
  const language = audit.prompts?.[0]?.language || "";
  return [
    audit.target?.domain || "",
    promptHash,
    providerModels,
    language,
    audit.promptSetVersion || "",
    audit.analysisRulesVersion || "",
    audit.runCountPerPrompt || 1,
  ].join("::");
}

async function listRunSummaries(): Promise<any[]> {
  const root = resolve(runsDir());
  if (!existsSync(root)) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const summaries: any[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const auditId = entry.name;
    const file = join(root, auditId, "report.json");
    if (!existsSync(file)) continue;
    try {
      const report = JSON.parse(await readFile(file, "utf8")) as any;
      summaries.push({
        auditId,
        targetName: report.audit?.target?.name,
        domain: report.audit?.target?.domain,
        generatedAt: report.generatedAt,
        providerModels: (report.audit?.providerTargets || []).map((target: any) => `${target.providerId}/${target.model}`),
        promptSetId: report.audit?.promptSetId,
        promptSetHash: report.audit?.promptSetHash,
        promptSetVersion: report.audit?.promptSetVersion,
        analysisRulesVersion: report.audit?.analysisRulesVersion,
        language: report.audit?.prompts?.[0]?.language,
        runCountPerPrompt: report.audit?.runCountPerPrompt || 1,
        webSearchEnabled: (report.audit?.providerTargets || []).some((target: any) => Boolean(target.webSearchEnabled)),
        brandAwarenessRate: report.metrics?.brandAwarenessRate,
        naturalDiscoveryRate: report.metrics?.naturalDiscoveryRate,
        organicRecommendationRate: report.metrics?.organicRecommendationRate,
        officialCitationRate: report.metrics?.officialCitationRate,
        mentionRate: report.metrics?.mentionRate,
        citationRate: report.metrics?.citationRate,
        recommendationRate: report.metrics?.recommendationRate,
        shareOfVoice: report.metrics?.shareOfVoice,
        keywordSummary: report.metrics?.keywordSummary,
        conditionSignature: conditionSignature(report),
      });
    } catch {
      continue;
    }
  }

  const sorted = summaries.sort((a: any, b: any) => String(b.auditId).localeCompare(String(a.auditId))).slice(0, 25);
  return sorted.map((row: any, index) => {
    const previous = sorted.slice(index + 1).find((item: any) => item.domain === row.domain);
    if (!previous) return { ...row, comparisonNote: "first run" };
    return {
      ...row,
      comparisonNote:
        previous.conditionSignature === row.conditionSignature
          ? "comparable with previous run"
          : "conditions changed; do not compare directly",
    };
  });
}

async function handle(req: IncomingMessage, res: ServerResponse, dependencies: ProductServerDependencies = {}): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const projectStore = new ProjectFileStore(monitoringDataDir());
  const productProjectStore = new ProductProjectFileStore(productDataDir());
  const productProjectService = new ProductProjectService(productProjectStore);
  const productConfigurationStore = new ProductConfigurationFileStore(productProjectStore);
  const productModelCatalog = dependencies.modelCatalog || defaultProductModelCatalog;
  const productModelSelections = new ProductModelSelectionService(productProjectService, productConfigurationStore, productModelCatalog);
  const productBaselines = new ProductBaselineService(productProjectService, productModelSelections, productConfigurationStore);
  const productRecognitionStore = new ProductRecognitionFileStore(productProjectStore);
  const productRecognitionRuns = new ProductRecognitionRunService(productProjectService, productBaselines, productRecognitionStore, dependencies.recognitionExecutor);

  if (method === "GET" && url.pathname === "/") return send(res, 200, renderProductPhase2AppHtml(), "text/html; charset=utf-8");
  if (method === "GET" && route[0] === "assets" && route.length > 1) {
    const root = resolve("assets");
    const path = resolve(root, route.slice(1).join("/"));
    if (path !== root && !path.startsWith(root + sep)) return send(res, 404, { error: "asset not found" });
    if (!existsSync(path)) return send(res, 404, { error: "asset not found" });
    if (!(await stat(path)).isFile()) return send(res, 404, { error: "asset not found" });
    return sendAsset(res, path);
  }
  if (method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (method === "GET" && url.pathname === "/providers") {
    return send(
      res,
      200,
      new ProviderCatalog().list().map((provider) => ({ ...provider, keyConfigured: hasProviderKey(provider.id) })),
    );
  }
  if (method === "GET" && url.pathname === "/provider-models") {
    return send(res, 200, await PROVIDER_MODEL_CAPABILITIES.list());
  }
  if (method === "GET" && url.pathname === "/runs") return send(res, 200, await listRunSummaries());
  if (method === "GET" && route.length === 2 && route[0] === "audit-jobs") {
    const job = auditJobs.read(route[1] || "");
    return job ? send(res, 200, job) : send(res, 404, { error: "audit job not found" });
  }

  if (
    await handleProductConfigurationApi({
      method,
      route,
      projects: productProjectService,
      selections: productModelSelections,
      baselines: productBaselines,
      catalog: productModelCatalog,
      readJson: () => readJson(req),
      send: (status, body) => send(res, status, body),
    })
  ) {
    return;
  }

  if (
    await handleProductRecognitionRetryApi({
      method,
      route,
      service: productRecognitionRuns,
      send: (status, body) => send(res, status, body),
    })
  ) {
    return;
  }

  if (
    await handleProductRecognitionApi({
      method,
      route,
      service: productRecognitionRuns,
      idempotencyKey: typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : undefined,
      send: (status, body) => send(res, status, body),
    })
  ) {
    return;
  }

  if (
    await handleProductProjectApi({
      method,
      url,
      route,
      service: productProjectService,
      readJson: () => readJson(req),
      send: (status, body) => send(res, status, body),
    })
  ) {
    return;
  }

  if (method === "POST" && route.length === 1 && route[0] === "audit-jobs") {
    const body = await readJson(req);
    const plan = auditPlanFromBody(body.confirmedPlan);
    const job = auditJobs.create(initialProgressForPlan(plan), (update) => runConfirmedAudit(body, projectStore, update));
    return send(res, 202, job);
  }

  if (method === "GET" && route.length === 1 && route[0] === "projects") {
    const projects = await projectStore.listProjects();
    const rows = await Promise.all(
      projects.map(async (project) => ({ project, dashboard: await projectStore.readDashboard(project.id) })),
    );
    return send(res, 200, rows);
  }


  if (method === "POST" && route.length === 1 && route[0] === "projects") {
    const body = await readJson(req);
    if (!body.confirmedPlan) return send(res, 400, { error: "confirmedPlan is required" });
    const plan = auditPlanFromBody(body.confirmedPlan);
    const projectService = new ProjectService();
    const candidate = projectService.projectFromAuditPlan(plan);
    const existing = await projectStore.readProject(candidate.id);
    const project = projectService.projectFromAuditPlan(plan, existing || undefined);
    await projectStore.saveProject(project);
    const baseline = await new BaselineService(projectStore).createFromConfirmedPlan(project.id, plan);
    return send(res, 201, { project, baseline });
  }

  if (method === "POST" && route.length === 2 && route[0] === "projects" && route[1] === "import-runs") {
    return send(res, 201, await new LegacyRunImporter(projectStore).importRuns(runsDir()));
  }

  if (route[0] === "projects" && route[1]) {
    const projectId = route[1];
    const project = await projectStore.readProject(projectId);
    if (!project) return send(res, 404, { error: "project not found" });
    if (method === "GET" && route.length === 2) {
      return send(res, 200, { project, dashboard: await projectStore.readDashboard(projectId) });
    }
    if (method === "GET" && route.length === 3 && route[2] === "baselines") {
      return send(res, 200, await projectStore.listBaselines(projectId));
    }
    if (method === "GET" && route.length === 3 && route[2] === "tasks") {
      return send(res, 200, await projectStore.listTasks(projectId));
    }
    if (method === "GET" && route.length === 3 && route[2] === "runs") {
      return send(res, 200, await projectStore.listRuns(projectId));
    }
    if (method === "GET" && route.length === 3 && route[2] === "observations") {
      return send(res, 200, await projectStore.listObservations(projectId));
    }
    if (method === "GET" && route.length === 3 && route[2] === "events") {
      return send(res, 200, await projectStore.listMonitoringEvents(projectId));
    }
    if (method === "GET" && route.length === 3 && route[2] === "workbench") {
      const [baselines, tasks, runs, observations, events] = await Promise.all([
        projectStore.listBaselines(projectId),
        projectStore.listTasks(projectId),
        projectStore.listRuns(projectId),
        projectStore.listObservations(projectId),
        projectStore.listMonitoringEvents(projectId),
      ]);
      return send(
        res,
        200,
        new WorkbenchReadModelBuilder().build({
          project,
          baselines,
          tasks,
          runs,
          observations,
          events,
          filter: trendFilterFromUrl(url),
          baselineId: url.searchParams.get("baselineId") || undefined,
        }),
      );
    }
    if (method === "GET" && route.length === 4 && route[2] === "observations") {
      const observation = (await projectStore.listObservations(projectId)).find((item) => item.id === route[3]);
      if (!observation) return send(res, 404, { error: "observation not found" });
      return send(res, 200, observation);
    }
    if (method === "GET" && route.length === 5 && route[2] === "runs" && route[4] === "snapshot") {
      const run = await projectStore.readRun(projectId, route[3] || "");
      if (!run) return send(res, 404, { error: "run not found" });
      const baseline = await projectStore.readBaseline(projectId, run.baselineId);
      if (!baseline) return send(res, 404, { error: "baseline not found" });
      const observations = await projectStore.listObservations(projectId, run.id);
      return send(res, 200, new RunSnapshotBuilder().build({ project, baseline, run, observations }));
    }
    if (method === "POST" && route.length === 5 && route[2] === "runs" && route[4] === "reanalyze") {
      const output = await new ObservationReanalysisService(projectStore).reanalyze(projectId, route[3] || "");
      await new RunOrchestrator(projectStore).refreshDashboard(projectId);
      return send(res, 200, { run: output.run, analysisCoverage: output.run.analysisCoverage });
    }
    if (method === "POST" && route.length === 3 && route[2] === "tasks") {
      const body = await readJson(req);
      const sourceBaselineId = typeof body.baselineId === "string" ? body.baselineId : "";
      if (!sourceBaselineId) return send(res, 400, { error: "baselineId is required" });
      const configuration = taskBaselineConfigurationFromBody(body.configuration);
      const baseline = configuration
        ? await new BaselineService(projectStore).derive(projectId, sourceBaselineId, configuration)
        : await projectStore.readBaseline(projectId, sourceBaselineId);
      if (!baseline) return send(res, 404, { error: "baseline not found" });
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      const task = await service.createTask({
        name: typeof body.name === "string" ? body.name : undefined,
        projectId,
        baselineId: baseline.id,
        schedule: monitoringScheduleFromBody(body.schedule),
        notifications: notificationPolicyFromBody(body.notifications),
        enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      });
      return send(res, 201, task);
    }
    if (method === "POST" && route.length === 4 && route[2] === "tasks" && route[3] === "preview") {
      const body = await readJson(req);
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      const after = typeof body.after === "string" ? new Date(body.after) : new Date();
      const count = typeof body.count === "number" ? body.count : 3;
      return send(res, 200, { occurrences: service.previewSchedule(monitoringScheduleFromBody(body.schedule), after, count) });
    }
    if ((method === "PATCH" || method === "PUT") && route.length === 4 && route[2] === "tasks") {
      const body = await readJson(req);
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      const existingTask = await projectStore.readTask(projectId, route[3] || "");
      if (!existingTask) return send(res, 404, { error: "monitoring task not found" });
      const configuration = taskBaselineConfigurationFromBody(body.configuration);
      const baseline = configuration
        ? await new BaselineService(projectStore).derive(projectId, existingTask.baselineId, configuration)
        : undefined;
      const task = await service.updateTask(projectId, route[3] || "", {
        name: typeof body.name === "string" ? body.name : undefined,
        baselineId: baseline?.id,
        schedule: body.schedule ? monitoringScheduleFromBody(body.schedule) : undefined,
        notifications: body.notifications ? notificationPolicyFromBody(body.notifications) : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      });
      return send(res, 200, task);
    }
    if (method === "DELETE" && route.length === 4 && route[2] === "tasks") {
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      await service.deleteTask(projectId, route[3] || "");
      return send(res, 204, "", "text/plain; charset=utf-8");
    }
    if (method === "POST" && route.length === 5 && route[2] === "tasks" && route[4] === "duplicate") {
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      return send(res, 201, await service.duplicateTask(projectId, route[3] || ""));
    }
    if (method === "POST" && route.length === 5 && route[2] === "baselines" && route[4] === "run") {
      const baseline = await projectStore.readBaseline(projectId, route[3] || "");
      if (!baseline) return send(res, 404, { error: "baseline not found" });
      const output = await new RunOrchestrator(projectStore).runBaseline({ project, baseline });
      return send(res, 201, { run: output.materialized.run, paths: output.runnerOutput.paths });
    }
    if (method === "POST" && route.length === 5 && route[2] === "baselines" && route[4] === "run-job") {
      const baseline = await projectStore.readBaseline(projectId, route[3] || "");
      if (!baseline) return send(res, 404, { error: "baseline not found" });
      const plan = {
        prompts: baseline.prompts,
        providerTargets: baseline.providerTargets,
        runCountPerPrompt: baseline.runCountPerPrompt,
      };
      const job = auditJobs.create(initialProgressForPlan(plan), async (update) => {
        const output = await new RunOrchestrator(projectStore).runBaseline({ project, baseline, onProgress: update });
        return {
          auditId: output.runnerOutput.audit.id,
          projectId,
          baselineId: baseline.id,
          projectRunId: output.materialized.run.id,
          metrics: output.runnerOutput.metrics,
          gaps: output.runnerOutput.gaps,
          paths: output.runnerOutput.paths,
        };
      });
      return send(res, 202, job);
    }
    if (method === "POST" && route.length === 5 && route[2] === "baselines" && route[4] === "classify-intents") {
      const baseline = await new BaselineIntentService(projectStore).classify(projectId, route[3] || "");
      await new RunOrchestrator(projectStore).refreshDashboard(projectId);
      return send(res, 201, { baseline });
    }
    if (method === "POST" && route.length === 5 && route[2] === "tasks" && route[4] === "run") {
      const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
      const output = await service.runTask(projectId, route[3] || "");
      return send(res, 201, { run: output.materialized.run, paths: output.runnerOutput.paths });
    }
    if (method === "POST" && route.length === 5 && route[2] === "tasks" && route[4] === "run-job") {
      const task = await projectStore.readTask(projectId, route[3] || "");
      if (!task) return send(res, 404, { error: "monitoring task not found" });
      const baseline = await projectStore.readBaseline(projectId, task.baselineId);
      if (!baseline) return send(res, 404, { error: "baseline not found" });
      const plan = {
        prompts: baseline.prompts,
        providerTargets: baseline.providerTargets,
        runCountPerPrompt: baseline.runCountPerPrompt,
      };
      const job = auditJobs.create(initialProgressForPlan(plan), async (update) => {
        const output = await new MonitoringService(projectStore, new RunOrchestrator(projectStore)).runTask(
          projectId,
          task.id,
          new Date(),
          update,
        );
        return {
          auditId: output.runnerOutput.audit.id,
          projectId,
          baselineId: output.materialized.baseline.id,
          projectRunId: output.materialized.run.id,
          metrics: output.runnerOutput.metrics,
          gaps: output.runnerOutput.gaps,
          paths: output.runnerOutput.paths,
        };
      });
      return send(res, 202, job);
    }
  }

  if (method === "POST" && route.length === 2 && route[0] === "monitoring" && route[1] === "run-due") {
    const service = new MonitoringService(projectStore, new RunOrchestrator(projectStore));
    const results = await service.runDue();
    return send(
      res,
      200,
      results.map((result) => ({ taskId: result.task.id, runId: result.output?.materialized.run.id, error: result.error })),
    );
  }

  if (method === "POST" && url.pathname === "/audit-plan") {
    const body = await readJson(req);
    const input = auditInputFromBody(body);
    if (!input.domain) return send(res, 400, { error: "domain is required" });
    const plan = await new AuditPlanner().plan({
      target: input.target,
      submittedDomain: input.domain,
      competitors: input.competitors,
      providerTargets: input.providerTargets,
      language: input.language,
      promptCount: input.promptCount,
      manualPrompts: input.manualPrompts,
      keywords: input.keywords,
      keywordMode: input.keywordMode,
      keywordLimit: input.keywordLimit,
      promptsPerKeyword: input.promptsPerKeyword,
      autoDiscover: input.autoDiscover,
      targetNameExplicit: input.targetNameExplicit,
    });
    return send(res, 201, { plan });
  }

  if (method === "POST" && url.pathname === "/audit-plan/reclassify") {
    const body = await readJson(req);
    const plan = auditPlanFromBody(body.confirmedPlan);
    const classifiedPlan = await new AuditPlanner().reclassifyPrompts(plan);
    return send(res, 200, { plan: classifiedPlan });
  }

  if (method === "POST" && url.pathname === "/audits") {
    const body = await readJson(req);
    const confirmedPlan = body.confirmedPlan ? auditPlanFromBody(body.confirmedPlan) : undefined;
    const domain = confirmedPlan?.submittedDomain || (typeof body.domain === "string" ? body.domain : "");
    if (!domain) return send(res, 400, { error: "domain is required" });
    const input = confirmedPlan ? undefined : auditInputFromBody(body);
    let output;
    let materialized;
    if (confirmedPlan) {
      const projectService = new ProjectService();
      const candidate = projectService.projectFromAuditPlan(confirmedPlan);
      const existing = await projectStore.readProject(candidate.id);
      const project = projectService.projectFromAuditPlan(confirmedPlan, existing || undefined);
      await projectStore.saveProject(project);
      const baseline = await new BaselineService(projectStore).createFromConfirmedPlan(project.id, confirmedPlan);
      const monitored = await new RunOrchestrator(projectStore).runBaseline({
        project,
        baseline,
        maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      });
      output = monitored.runnerOutput;
      materialized = monitored.materialized;
    } else {
      const plan = await new AuditPlanner().plan({
        target: input!.target,
        submittedDomain: domain,
        competitors: input!.competitors,
        providerTargets: input!.providerTargets,
        language: input!.language,
        promptCount: input!.promptCount,
        manualPrompts: input!.manualPrompts,
        keywords: input!.keywords,
        keywordMode: input!.keywordMode,
        keywordLimit: input!.keywordLimit,
        promptsPerKeyword: input!.promptsPerKeyword,
        autoDiscover: input!.autoDiscover,
        targetNameExplicit: input!.targetNameExplicit,
      });
      output = await new AuditRunner().run({
        confirmedPlan: plan,
        maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      });
      materialized = await new RunOrchestrator(projectStore).recordAuditOutput(output.audit, output.paths);
    }
    return send(res, 201, {
      auditId: output.audit.id,
      projectId: materialized.project.id,
      baselineId: materialized.baseline.id,
      projectRunId: materialized.run.id,
      metrics: output.metrics,
      gaps: output.gaps,
      paths: output.paths,
    });
  }

  if (method === "GET" && route.length === 2 && route[0] === "audits" && route[1]) {
    const file = join(resolve(runsDir()), route[1], "report.json");
    if (!existsSync(file)) return send(res, 404, { error: "audit not found" });
    return send(res, 200, JSON.parse(await readFile(file, "utf8")));
  }

  if (method === "GET" && route.length === 2 && route[0] === "reports" && route[1]) {
    const file = join(resolve(runsDir()), route[1], "report.html");
    if (!existsSync(file)) return send(res, 404, { error: "report not found" });
    return send(res, 200, await readFile(file, "utf8"), "text/html; charset=utf-8");
  }

  return send(res, 404, { error: "not found" });
}

export function createProductServer(dependencies: ProductServerDependencies = {}) {
  return createServer((req, res) => {
    handle(req, res, dependencies).catch((error) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const port = Number(process.env.PORT || 8787);
  createProductServer().listen(port, () => {
    console.log(`niubigeo OSS server listening on http://localhost:${port}`);
  });
}
