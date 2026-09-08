import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createProductServer } from "../src/product/product-server.js";
import type { ProductModelSelection } from "../src/product/configuration/model-selection-schema.js";
import { REAL_PROVIDER_COST_LIMIT_USD, REAL_PROVIDER_REQUEST_LIMIT, FrozenModelCatalog, LedgeredRecognitionExecutor, assertNativeSearchSmoke, createLedger, historicalProviderUsage, readJson, readOpenRouterCatalog, writeJson, type CatalogModel, type CycleCaseReference, type ProviderLedger, type ProviderLedgerEntry, upperBound } from "./real-provider-10-support.js";

type SeedCase = { caseId: string; domain: string; language: "zh" | "en" };
type SeedManifest = { schemaVersion: string; cases: SeedCase[] };
type HttpReply<T> = { status: number; body: T };
type ProjectReply = { project: { id: string; normalizedDomain: string; name: string } };
type RecognitionRunReply = { run: { id: string; status: string; modelRuns?: unknown[] }; modelRuns: Array<{ id: string; modelSnapshot: { modelId: string } }> };
type RecognitionDetail = { run: { id: string; status: string; completedAt?: string }; modelRuns: Array<{ id: string; status: string; currentAttemptId?: string; modelSnapshot: { modelId: string; webSearchMode: "off" | "provider_native" } }> };
type RecognitionModelDetail = {
  modelRun: { id: string; status: string; currentAttemptId?: string; modelSnapshot: { modelId: string; webSearchMode: "off" | "provider_native" } };
  attempts: Array<{
    id: string;
    rawAnswer?: string;
    rawProviderResponse?: unknown;
    tokenUsage?: { input: number; output: number; total: number };
    costUsd?: number | null;
    providerSearch?: {
      requested?: boolean;
      used?: boolean;
      usedMode?: string;
      executionMode?: string;
      citationCount?: number;
    };
  }>;
  archive?: {
    result: {
      id: string;
      competitors: Array<{ id: string; name: string; domain: string | null; evidence: { quote: string | null } }>;
      competitorKeywords: Array<{ id: string; competitorId: string; keyword: string; evidence: { quote: string | null } }>;
      brandKeywords: Array<{ id: string; keyword: string; evidence: { quote: string | null } }>;
      providerCitations: Array<{ id: string; url: string; providerPayloadPath: string }>;
      answerMentionedUrls: Array<{ id: string; url: string }>;
      domainRecognition: string;
      recognizedBrand: { value: string | null };
      businessDescription: { value: string | null };
      productCategory: { value: string | null };
    };
  };
};
type MeasurementRunReply = { run: { id: string; status: string; completedAt?: string; source: string } };
type MeasurementDetail = { run: { id: string; status: string; completedAt?: string; source: string }; modelRuns: Array<{ id: string; status: string; modelSnapshot: { modelId: string; webSearchMode: "off" | "provider_native" }; probeRunIds: string[] }> };
type WatchSuggestion = { suggestion: { target: { id: string; domain: string; name: string }; competitors: Array<{ id: string; domain: string | null; name: string; sourceRecordIds: string[]; identityState: string }>; keywords: Array<{ id: string; keyword: string; normalizedKeyword: string; sourceRecordIds: string[]; neutralEligible: boolean; neutralEligibilityReason: string }> } };
type WatchSetReply = { watchSet: { id: string; objects: Array<{ id: string; domain: string | null; role: string; sourceRecordIds: string[] }>; keywords: Array<{ id: string; keyword: string; normalizedKeyword: string; sourceRecordIds: string[] }> } };
type TaskReply = { task: { id: string; nextRunAt: string | null } };

const root = process.cwd();
const sourceManifestPath = join(root, "examples", "real-provider-10", "seed-manifest.json");
const examplesRoot = join(root, "examples", "real-provider-10");
const cycleId = process.env.NIUBIGEO_REAL_PROVIDER_CYCLE || "real-provider-10-2026-09-07-final";
const validationRoot = join(root, "validation", cycleId);
const productDataRoot = join(validationRoot, "product-data");
const ledgerPath = join(validationRoot, "provider-ledger.json");
const modelPolicyPath = join(examplesRoot, "model-policy.json");

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function now(): string { return new Date().toISOString(); }
function sleep(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function asObject(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function allFiles(path: string): Promise<string[]> {
  if (!(await exists(path))) return [];
  const current = await stat(path);
  if (current.isFile()) return [path];
  const values: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) values.push(...await allFiles(child));
    if (entry.isFile()) values.push(child);
  }
  return values.sort((left, right) => left.localeCompare(right));
}

async function fileHashes(paths: string[]): Promise<Array<{ path: string; sha256: string; bytes: number }>> {
  const files = (await Promise.all(paths.map(allFiles))).flat();
  const values: Array<{ path: string; sha256: string; bytes: number }> = [];
  for (const path of files) {
    const content = await readFile(path, "utf8");
    values.push({ path: relative(root, path), sha256: hash(content), bytes: Buffer.byteLength(content) });
  }
  return values.sort((left, right) => left.path.localeCompare(right.path));
}

async function captureBefore(): Promise<void> {
  const sourceFiles = await fileHashes([join(root, "src"), join(root, "test"), join(root, "e2e"), join(root, "scripts"), sourceManifestPath, modelPolicyPath]);
  await writeJson(join(validationRoot, "before.json"), {
    cycleId,
    capturedAt: now(),
    commit: await command("git", ["rev-parse", "HEAD"]),
    gitStatus: await command("git", ["status", "--short"]),
    sourceFileCount: sourceFiles.length,
    sourceHash: hash(JSON.stringify(sourceFiles)),
    sourceFiles,
    seedManifestHash: hash(await readFile(sourceManifestPath, "utf8")),
  });
}

function command(file: string, argumentsList: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, argumentsList, { cwd: root }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${file} failed: ${stderr || error.message}`));
      else resolve(stdout.trim());
    });
  });
}

async function cleanupManifest(): Promise<void> {
  const output = await command("ps", ["-ax", "-o", "pid=", "-o", "command="]);
  const processRows = output.split("\n").filter((line) => line.includes("test/fixtures/phase5-product-server.ts"));
  const entries = processRows.map((line) => {
    const trimmed = line.trim();
    const firstSpace = trimmed.indexOf(" ");
    const pid = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    return {
      path: `process:${pid}`,
      dataType: "confirmed_old_phase5_fixture_service",
      projectOrRunId: null,
      proof: "The command line explicitly references test/fixtures/phase5-product-server.ts.",
      plannedAction: "SIGTERM after this manifest is persisted",
      backupLocation: null,
      sha256Before: null,
      execution: "planned",
    };
  });
  const retained = [
    {
      path: "data/product-v2/projects/5123bc7a-c468-469c-a76c-f2d1b1778afa",
      dataType: "unverified_existing_product_project",
      projectOrRunId: "5123bc7a-c468-469c-a76c-f2d1b1778afa",
      proof: "No fixture marker or generated-cycle record proves that this is an old validation project.",
      plannedAction: "retain",
      backupLocation: null,
      sha256Before: null,
      execution: "not_deleted",
    },
  ];
  const manifest = { cycleId, generatedAt: now(), entries: [...entries, ...retained] };
  await writeJson(join(validationRoot, "cleanup-manifest.json"), manifest);
  for (const entry of entries) {
    const pid = Number(entry.path.slice("process:".length));
    if (!Number.isInteger(pid) || pid <= 1) {
      entry.execution = "invalid_pid_not_signaled";
      continue;
    }
    try {
      process.kill(pid, "SIGTERM");
      entry.execution = "SIGTERM_sent";
    } catch (error) {
      entry.execution = `SIGTERM_failed:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  await writeJson(join(validationRoot, "cleanup-manifest.json"), { cycleId, generatedAt: now(), entries: [...entries, ...retained] });
}

async function reply<T>(base: string, method: string, path: string, body?: unknown): Promise<HttpReply<T>> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const row = asObject(parsed);
    throw new Error(`${method} ${path} returned HTTP ${response.status}: ${typeof row?.error === "string" ? row.error : text}`);
  }
  return { status: response.status, body: parsed as T };
}

async function waitForRecognition(base: string, projectId: string, runId: string): Promise<RecognitionDetail> {
  for (let index = 0; index < 900; index += 1) {
    const detail = (await reply<RecognitionDetail>(base, "GET", `/api/projects/${encodeURIComponent(projectId)}/recognition-runs/${encodeURIComponent(runId)}`)).body;
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await sleep(400);
  }
  throw new Error(`Recognition run ${runId} did not settle within the timeout.`);
}

async function waitForMeasurement(base: string, projectId: string, runId: string): Promise<MeasurementDetail> {
  for (let index = 0; index < 900; index += 1) {
    const detail = (await reply<MeasurementDetail>(base, "GET", `/api/projects/${encodeURIComponent(projectId)}/measurement-runs/${encodeURIComponent(runId)}`)).body;
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await sleep(400);
  }
  throw new Error(`Measurement run ${runId} did not settle within the timeout.`);
}

function sortDomain(values: Array<{ domain: string; sources: string[] }>): Array<{ domain: string; sources: string[] }> {
  return values.sort((left, right) => right.sources.length - left.sources.length || left.domain.localeCompare(right.domain));
}

function identityText(value: string): string { return value.trim().toLocaleLowerCase(); }
function keywordCanBeNeutral(keyword: string, identities: string[]): boolean {
  const value = identityText(keyword);
  if (!value || value.includes("://")) return false;
  for (const identity of identities) if (identity && value.includes(identityText(identity))) return false;
  return true;
}

async function selectScope(base: string, projectId: string, targetDomain: string): Promise<{ watchSet: WatchSetReply["watchSet"]; selection: Record<string, unknown> }> {
  const suggestion = (await reply<WatchSuggestion>(base, "GET", `/api/projects/${encodeURIComponent(projectId)}/watch-sets/suggestion`)).body.suggestion;
  const competitorRows = new Map<string, { domain: string; sources: string[]; id: string }>();
  for (const row of suggestion.competitors) {
    if (!row.domain || row.identityState !== "confirmed" || identityText(row.domain) === identityText(targetDomain)) continue;
    const existing = competitorRows.get(identityText(row.domain));
    if (existing) existing.sources.push(...row.sourceRecordIds);
    else competitorRows.set(identityText(row.domain), { domain: row.domain, sources: [...row.sourceRecordIds], id: row.id });
  }
  const competitorCandidates = sortDomain([...competitorRows.values()]);
  const selectedCompetitor = competitorCandidates[0] || null;
  const identities = [suggestion.target.name, suggestion.target.domain];
  if (selectedCompetitor) identities.push(selectedCompetitor.domain);
  const keywordCandidates = suggestion.keywords
    .filter((item) => item.neutralEligible && keywordCanBeNeutral(item.keyword, identities))
    .sort((left, right) => right.sourceRecordIds.length - left.sourceRecordIds.length || left.normalizedKeyword.localeCompare(right.normalizedKeyword));
  const selectedKeyword = keywordCandidates[0] || null;
  const objectIds = selectedCompetitor ? [suggestion.target.id, selectedCompetitor.id] : [suggestion.target.id];
  const keywordIds = selectedKeyword ? [selectedKeyword.id] : [];
  const created = (await reply<WatchSetReply>(base, "POST", `/api/projects/${encodeURIComponent(projectId)}/watch-sets`, { objectIds, keywordIds, repetitions: 1 })).body.watchSet;
  const confirmed = (await reply<WatchSetReply>(base, "POST", `/api/projects/${encodeURIComponent(projectId)}/watch-sets/${encodeURIComponent(created.id)}/confirm`)).body.watchSet;
  return {
    watchSet: confirmed,
    selection: {
      targetDomain,
      competitorDomain: selectedCompetitor?.domain || null,
      competitorEvidenceRecordIds: selectedCompetitor?.sources || [],
      competitorMissingReason: selectedCompetitor ? null : "no_confirmed_competitor_with_returned_domain",
      keyword: selectedKeyword?.keyword || null,
      keywordEvidenceRecordIds: selectedKeyword?.sourceRecordIds || [],
      keywordMissingReason: selectedKeyword ? null : "no_neutral_keyword_returned_by_discovery",
      watchSetId: confirmed.id,
    },
  };
}

function isTerminal(status: string): boolean { return status !== "queued" && status !== "running"; }

function completedModel(detail: RecognitionDetail, modelId: string): { id: string; status: string; currentAttemptId?: string; modelSnapshot: { modelId: string; webSearchMode: "off" | "provider_native" } } {
  const modelRun = detail.modelRuns.find((candidate) => candidate.modelSnapshot.modelId === modelId);
  if (!modelRun) throw new Error(`Recognition run ${detail.run.id} has no model run for ${modelId}.`);
  if (modelRun.status !== "completed") throw new Error(`Recognition model ${modelId} ended as ${modelRun.status}.`);
  return modelRun;
}

async function modelDetail(base: string, projectId: string, runId: string, modelRunId: string): Promise<RecognitionModelDetail> {
  return (await reply<RecognitionModelDetail>(base, "GET", `/api/projects/${encodeURIComponent(projectId)}/recognition-runs/${encodeURIComponent(runId)}/model-runs/${encodeURIComponent(modelRunId)}`)).body;
}

async function requireOfflineSmoke(base: string, projectId: string, detail: RecognitionDetail, modelId: string): Promise<void> {
  const modelRun = completedModel(detail, modelId);
  const record = await modelDetail(base, projectId, detail.run.id, modelRun.id);
  const attempt = record.attempts.find((candidate) => candidate.id === modelRun.currentAttemptId);
  if (!attempt?.rawAnswer) throw new Error(`The offline smoke for ${modelId} did not persist a raw answer.`);
  if (attempt.providerSearch?.requested || attempt.providerSearch?.used) throw new Error(`The offline smoke for ${modelId} unexpectedly recorded web search.`);
}

async function requireNativeSearchSmoke(base: string, projectId: string, detail: RecognitionDetail, modelId: string): Promise<void> {
  const modelRun = completedModel(detail, modelId);
  const record = await modelDetail(base, projectId, detail.run.id, modelRun.id);
  const attempt = record.attempts.find((candidate) => candidate.id === modelRun.currentAttemptId);
  assertNativeSearchSmoke({
    modelId,
    modelRunStatus: modelRun.status,
    rawAnswer: attempt?.rawAnswer,
    search: attempt?.providerSearch,
  });
}

function requireCompletedMeasurement(detail: MeasurementDetail, modelId: string): void {
  if (detail.run.status !== "completed") throw new Error(`Measurement run ${detail.run.id} for ${modelId} ended as ${detail.run.status}.`);
  const modelRun = detail.modelRuns.find((candidate) => candidate.modelSnapshot.modelId === modelId);
  if (!modelRun) throw new Error(`Measurement run ${detail.run.id} has no model run for ${modelId}.`);
  if (modelRun.status !== "completed") throw new Error(`Measurement model ${modelId} ended as ${modelRun.status}.`);
}

async function serverFor(executor: LedgeredRecognitionExecutor, catalog: FrozenModelCatalog): Promise<{ base: string; close: () => Promise<void> }> {
  process.env.PRODUCT_DATA_DIR = productDataRoot;
  const server = createProductServer({ modelCatalog: catalog, recognitionExecutor: executor, measurementExecutor: executor });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${address.port}`, close: async () => { server.close(); await once(server, "close"); } };
}

async function modelInputs(): Promise<{ catalog: FrozenModelCatalog; models: Map<string, CatalogModel>; offline: CatalogModel; online: CatalogModel; freeze: Record<string, unknown> }> {
  const policy = await readJson<{ offline: { modelId: string; webSearchMode: "off" }; online: { modelId: string; webSearchMode: "provider_native" } }>(modelPolicyPath);
  const all = await readOpenRouterCatalog();
  const byId = new Map(all.map((model) => [model.modelId, model]));
  const offline = byId.get(policy.offline.modelId);
  const online = byId.get(policy.online.modelId);
  if (!offline) throw new Error(`Frozen offline model ${policy.offline.modelId} is not available in the OpenRouter catalog.`);
  if (!online) throw new Error(`Frozen online model ${policy.online.modelId} is not available in the OpenRouter catalog.`);
  if (!online.supportedParameters.includes("tools") || online.pricing.webSearchPerRequest <= 0) throw new Error(`Frozen online model ${online.modelId} does not have catalog evidence for priced tool search.`);
  return {
    catalog: new FrozenModelCatalog([offline, online]),
    models: new Map([[offline.modelId, offline], [online.modelId, online]]),
    offline,
    online,
    freeze: {
      catalogCheckedAt: now(),
      offline: { ...offline, webSearchMode: "off", maximumRequestUsd: upperBound(offline.pricing, "off") },
      online: { ...online, webSearchMode: "provider_native", actualSearchPath: "openrouter_hosted_provider_native", maximumRequestUsd: upperBound(online.pricing, "provider_native") },
    },
  };
}

async function startDiscovery(base: string, projectId: string, modelIds: string[]): Promise<RecognitionDetail> {
  const started = (await reply<RecognitionRunReply>(base, "POST", `/api/projects/${encodeURIComponent(projectId)}/recognition-runs`, { modelIds })).body;
  return waitForRecognition(base, projectId, started.run.id);
}

async function recordDiscovery(base: string, projectId: string, detail: RecognitionDetail): Promise<void> {
  await reply(base, "POST", `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(detail.run.id)}/reports`);
}

async function startManual(base: string, projectId: string, modelIds: string[]): Promise<MeasurementDetail> {
  const started = (await reply<MeasurementRunReply>(base, "POST", `/api/projects/${encodeURIComponent(projectId)}/measurement-runs`, { modelIds, idempotencyKey: `manual-${randomUUID()}`, budget: { requestLimit: 6 } })).body;
  return waitForMeasurement(base, projectId, started.run.id);
}

async function main(): Promise<void> {
  if (await exists(ledgerPath)) throw new Error(`The final cycle ledger already exists at ${ledgerPath}; this command refuses to reset or rerun paid validation.`);
  await mkdir(validationRoot, { recursive: true });
  await captureBefore();
  await cleanupManifest();
  const seed = await readJson<SeedManifest>(sourceManifestPath);
  if (seed.cases.length !== 10) throw new Error("The frozen seed manifest must contain exactly ten cases.");
  const historicalUsage = await historicalProviderUsage(join(root, "validation"), ledgerPath);
  const maximumRequestsForFrozenCycle = seed.cases.length * 2 + seed.cases.length * 2 * 3 * 2;
  const remainingRequestCapacity = REAL_PROVIDER_REQUEST_LIMIT - historicalUsage.requestCount;
  await writeJson(join(validationRoot, "global-budget-preflight.json"), {
    cycleId,
    generatedAt: now(),
    requestLimit: REAL_PROVIDER_REQUEST_LIMIT,
    costLimitUsd: REAL_PROVIDER_COST_LIMIT_USD,
    historicalUsage,
    maximumRequestsForFrozenCycle,
    remainingRequestCapacity,
    status: remainingRequestCapacity >= maximumRequestsForFrozenCycle ? "permitted" : "blocked",
    reason: remainingRequestCapacity >= maximumRequestsForFrozenCycle
      ? null
      : "The remaining cross-cycle request capacity cannot cover the frozen worst-case discovery and two-round measurement plan.",
  });
  if (remainingRequestCapacity < maximumRequestsForFrozenCycle) {
    throw new Error(`Global Provider request budget blocks this cycle: ${remainingRequestCapacity} requests remain, while the frozen plan permits up to ${maximumRequestsForFrozenCycle} requests.`);
  }
  await writeJson(ledgerPath, createLedger());
  const selectedModels = await modelInputs();
  await writeJson(join(validationRoot, "freeze-manifest.json"), {
    cycleId,
    frozenAt: now(),
    seedManifestPath: relative(root, sourceManifestPath),
    seedManifestHash: hash(await readFile(sourceManifestPath, "utf8")),
    modelPolicyPath: relative(root, modelPolicyPath),
    modelPolicyHash: hash(await readFile(modelPolicyPath, "utf8")),
    requestLimit: REAL_PROVIDER_REQUEST_LIMIT,
    costLimitUsd: REAL_PROVIDER_COST_LIMIT_USD,
    modelFreeze: selectedModels.freeze,
    selectionRule: "Competitor: confirmed returned domain, distinct supporting model records descending, standardized domain ascending. Keyword: returned brand or competitor keyword, excludes monitored identities and URLs, supporting records descending, normalized keyword ascending.",
  });

  const caseReferences = new Map<string, CycleCaseReference>();
  const purposeByProject = new Map<string, "discovery" | "manual_measurement" | "scheduled_measurement">();
  const executor = new LedgeredRecognitionExecutor(ledgerPath, selectedModels.models, caseReferences, purposeByProject, historicalUsage);
  const product = await serverFor(executor, selectedModels.catalog);
  const cases: Array<Record<string, unknown>> = [];
  try {
    for (const entry of seed.cases) {
      const created = (await reply<ProjectReply>(product.base, "POST", "/api/projects", { primaryDomain: entry.domain, defaultLanguage: entry.language })).body.project;
      caseReferences.set(created.id, { caseId: entry.caseId, projectId: created.id });
      purposeByProject.set(created.id, "discovery");
      const selections = [
        { modelId: selectedModels.offline.modelId, webSearchMode: "off" },
        { modelId: selectedModels.online.modelId, webSearchMode: "provider_native" },
      ];
      await reply<{ selections: ProductModelSelection[] }>(product.base, "PUT", `/api/projects/${encodeURIComponent(created.id)}/models`, { selections });
      const baseline = (await reply<{ baseline: { id: string; configHash: string } }>(product.base, "POST", `/api/projects/${encodeURIComponent(created.id)}/baselines`)).body.baseline;
      const offlineDiscovery = await startDiscovery(product.base, created.id, [selectedModels.offline.modelId]);
      if (!isTerminal(offlineDiscovery.run.status)) throw new Error(`Offline discovery ${offlineDiscovery.run.id} did not reach a terminal state.`);
      await requireOfflineSmoke(product.base, created.id, offlineDiscovery, selectedModels.offline.modelId);
      if (!(await exists(ledgerPath))) throw new Error("The first offline smoke did not persist ledger evidence.");
      await recordDiscovery(product.base, created.id, offlineDiscovery);
      const onlineDiscovery = await startDiscovery(product.base, created.id, [selectedModels.online.modelId]);
      await requireNativeSearchSmoke(product.base, created.id, onlineDiscovery, selectedModels.online.modelId);
      await recordDiscovery(product.base, created.id, onlineDiscovery);
      const scope = await selectScope(product.base, created.id, entry.domain);
      cases.push({ caseId: entry.caseId, domain: entry.domain, language: entry.language, projectId: created.id, baselineId: baseline.id, baselineConfigHash: baseline.configHash, discoveryRunIds: [offlineDiscovery.run.id, onlineDiscovery.run.id], ...scope.selection, watchSet: scope.watchSet });
    }
    await writeJson(join(validationRoot, "measurement-manifest.json"), { cycleId, frozenAt: now(), cases });

    for (const row of cases) {
      const projectId = String(row.projectId);
      purposeByProject.set(projectId, "manual_measurement");
      const offlineManual = await startManual(product.base, projectId, [selectedModels.offline.modelId]);
      requireCompletedMeasurement(offlineManual, selectedModels.offline.modelId);
      const onlineManual = await startManual(product.base, projectId, [selectedModels.online.modelId]);
      requireCompletedMeasurement(onlineManual, selectedModels.online.modelId);
      row.manualRunIds = [offlineManual.run.id, onlineManual.run.id];
      row.manualStatus = [offlineManual.run.status, onlineManual.run.status];
      row.manualCompletedAt = [offlineManual.run.completedAt || null, onlineManual.run.completedAt || null];
    }
    await writeJson(join(validationRoot, "case-index.json"), { cycleId, createdAt: now(), cases });
  } finally {
    await product.close();
  }
  const ledger = await readJson<ProviderLedger>(ledgerPath);
  const discoveryRequests = ledger.entries.filter((entry) => entry.purpose === "discovery").length;
  const manualRequests = ledger.entries.filter((entry) => entry.purpose === "manual_measurement").length;
  if (discoveryRequests === 0 || manualRequests === 0) throw new Error("The paid cycle stopped before both discovery and manual measurement produced ledger entries.");
  await writeJson(join(validationRoot, "manual-cycle.json"), { cycleId, completedAt: now(), discoveryRequests, manualRequests, scheduledRequests: 0, ledgerEntries: ledger.entries.length });
  process.stdout.write(`${JSON.stringify({ cycleId, phase: "discovery_and_manual_complete", discoveryRequests, manualRequests, reservedUsd: ledger.entries.reduce((sum, entry) => sum + entry.estimatedUpperBoundUsd, 0), next: "run real-provider-10-schedule-worker" }, null, 2)}\n`);
}

main().catch(async (error) => {
  await mkdir(validationRoot, { recursive: true });
  await writeJson(join(validationRoot, "execution-error.json"), { cycleId, failedAt: now(), error: error instanceof Error ? error.stack || error.message : String(error) });
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
