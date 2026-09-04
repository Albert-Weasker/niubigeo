import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { hasProviderKey, loadDotEnv, runsDir } from "./config/env.js";
import { ProviderCatalog } from "./providers/catalog.js";
import { AuditRunner } from "./runner/audit-runner.js";
import { AuditPlanner } from "./runner/audit-planner.js";
import { entityFromInput } from "./utils/domain.js";
import type { AuditPlan, Entity, KeywordMode, MonitoringPrompt, PromptAuditCategory, PromptType, ProviderTarget, WebSearchRequestMode } from "./core/types.js";
import { renderAppHtml } from "./ui/app-html.js";
import { sha256 } from "./utils/hash.js";
import { ANALYSIS_RULES_VERSION, PROMPT_SET_VERSION } from "./core/version.js";

loadDotEnv();

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
  const webSearchMode = webSearchModeFromBody(body.webSearchMode);
  if (Array.isArray(body.providerTargets)) {
    return body.providerTargets.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        providerId: String(row.providerId),
        model: String(row.model),
        webSearchEnabled: typeof row.webSearchEnabled === "boolean" ? row.webSearchEnabled : webSearchEnabled,
        webSearchMode: webSearchModeFromBody(row.webSearchMode) || webSearchMode,
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
  return value
    .split(/[\n,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function keywordModeFromBody(value: unknown): KeywordMode | undefined {
  if (value === "site_plus_user" || value === "user_only" || value === "site_only") return value;
  return undefined;
}

function promptTypeFromBody(value: unknown): PromptType {
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
  return allowed.has(text as PromptType) ? (text as PromptType) : "scenario";
}

function promptAuditCategoryFromBody(value: unknown): PromptAuditCategory | undefined {
  if (value === "brand_awareness" || value === "organic_discovery" || value === "comparison" || value === "other") return value;
  return undefined;
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
  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `prompt-${index + 1}`,
    type: promptTypeFromBody(row.type),
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : "custom",
    language: typeof row.language === "string" && row.language.trim() ? row.language.trim() : language,
    text,
    enabled: row.enabled !== false,
    auditCategory: promptAuditCategoryFromBody(row.auditCategory),
    targetIncluded: typeof row.targetIncluded === "boolean" ? row.targetIncluded : undefined,
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
}

function confirmedPromptSetHash(input: { prompts: MonitoringPrompt[]; providerTargets: ProviderTarget[]; language: string }): string {
  return sha256(
    JSON.stringify({
      language: input.language,
      providerTargets: input.providerTargets.map((target) => ({
        providerId: target.providerId,
        model: target.model,
        webSearchEnabled: Boolean(target.webSearchEnabled),
        webSearchMode: target.webSearchMode || "auto",
      })),
      prompts: input.prompts.map((prompt) => ({
        type: prompt.type,
        auditCategory: prompt.auditCategory,
        text: prompt.text,
        enabled: prompt.enabled,
        keywordIds: prompt.keywordIds || [],
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

function conditionSignature(report: any): string {
  const audit = report.audit || {};
  const promptHash = audit.promptSetHash || "";
  const providerModels = (audit.providerTargets || [])
    .map((target: any) => `${target.providerId}:${target.model}:${Boolean(target.webSearchEnabled)}:${target.webSearchMode || "auto"}`)
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

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");

  if (method === "GET" && url.pathname === "/") return send(res, 200, renderAppHtml(), "text/html; charset=utf-8");
  const assetMatch = url.pathname.match(/^\/assets\/(.+)$/);
  if (method === "GET" && assetMatch?.[1]) {
    const root = resolve("assets");
    const path = resolve(root, decodeURIComponent(assetMatch[1]));
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
  if (method === "GET" && url.pathname === "/runs") return send(res, 200, await listRunSummaries());

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

  if (method === "POST" && url.pathname === "/audits") {
    const body = await readJson(req);
    const confirmedPlan = body.confirmedPlan ? auditPlanFromBody(body.confirmedPlan) : undefined;
    const domain = confirmedPlan?.submittedDomain || (typeof body.domain === "string" ? body.domain : "");
    if (!domain) return send(res, 400, { error: "domain is required" });
    const input = confirmedPlan ? undefined : auditInputFromBody(body);
    const output = await new AuditRunner().run({
      target: confirmedPlan?.target || input!.target,
      confirmedPlan,
      submittedDomain: domain,
      competitors: confirmedPlan?.competitors || input!.competitors,
      providerTargets: confirmedPlan?.providerTargets || input!.providerTargets,
      language: confirmedPlan?.language || input!.language,
      promptCount: confirmedPlan?.prompts.length || input!.promptCount,
      manualPrompts: input?.manualPrompts,
      keywords: input?.keywords,
      keywordMode: input?.keywordMode,
      keywordLimit: input?.keywordLimit,
      promptsPerKeyword: input?.promptsPerKeyword,
      autoDiscover: input?.autoDiscover,
      targetNameExplicit: input?.targetNameExplicit,
      maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    });
    return send(res, 201, {
      auditId: output.audit.id,
      metrics: output.metrics,
      gaps: output.gaps,
      paths: output.paths,
    });
  }

  const auditMatch = url.pathname.match(/^\/audits\/([^/]+)$/);
  if (method === "GET" && auditMatch?.[1]) {
    const file = join(resolve(runsDir()), auditMatch[1], "report.json");
    if (!existsSync(file)) return send(res, 404, { error: "audit not found" });
    return send(res, 200, JSON.parse(await readFile(file, "utf8")));
  }

  const reportMatch = url.pathname.match(/^\/reports\/([^/]+)$/);
  if (method === "GET" && reportMatch?.[1]) {
    const file = join(resolve(runsDir()), reportMatch[1], "report.html");
    if (!existsSync(file)) return send(res, 404, { error: "report not found" });
    return send(res, 200, await readFile(file, "utf8"), "text/html; charset=utf-8");
  }

  return send(res, 404, { error: "not found" });
}

const port = Number(process.env.PORT || 8787);
createServer((req, res) => {
  handle(req, res).catch((error) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
}).listen(port, () => {
  console.log(`niubigeo OSS server listening on http://localhost:${port}`);
});
