import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { loadDotEnv, hasProviderKey, productDataDir } from "../src/config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../src/providers/catalog.js";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { OpenRouterProductModelCatalog } from "../src/product/configuration/model-catalog.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductRecognitionRunService } from "../src/product/recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";

const runCommand = promisify(execFile);
const root = process.cwd();
const validationDir = resolve(root, "validation", "rebuild-phase-3-2026-09-06");
const manifestPath = join(validationDir, "test-manifest.json");
const beforePath = join(validationDir, "before.json");
const afterPath = join(validationDir, "after.json");
const deterministicPath = join(validationDir, "deterministic-results.json");
const realResultsPath = join(validationDir, "real-provider-results.json");

type WebSearchMode = "off" | "provider_native";

type StageDefinition = {
  id: "R3-01" | "R3-02" | "R3-03";
  models: Array<{ modelId: string; webSearchMode: WebSearchMode }>;
  requireNativeCitation: boolean;
};

type Manifest = {
  suiteId: string;
  frozen: boolean;
  provider: "openrouter";
  domain: string;
  language: "en" | "zh";
  limits: { maxProviderCalls: number; maxKnownCostUsd: number };
  stages: StageDefinition[];
};

type CommandRecord = {
  command: string;
  exitCode: number;
  passedCount: number | null;
  outputHash: string;
};

type Integrity = {
  codeHash: string;
  fileCount: number;
  manifestHash: string;
  productDataHash: string;
  commit: string | null;
};

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function occurrences(value: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= value.length - needle.length) {
    const position = value.indexOf(needle, offset);
    if (position < 0) break;
    count += 1;
    offset = position + needle.length;
  }
  return count;
}

async function directoryFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await directoryFiles(path));
      if (entry.isFile()) files.push(path);
    }
    return files;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function hashedDirectory(directory: string): Promise<{ hash: string; fileCount: number }> {
  const files = await directoryFiles(directory);
  files.sort((left, right) => left.localeCompare(right));
  const rows: string[] = [];
  for (const file of files) rows.push(`${relative(root, file)}\u0000${digest(await readFile(file))}`);
  return { hash: digest(rows.join("\n")), fileCount: files.length };
}

async function readCommit(): Promise<string | null> {
  try {
    const result = await runCommand("git", ["rev-parse", "HEAD"], { cwd: root });
    const value = result.stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}

async function integrity(manifestText: string): Promise<Integrity> {
  const codeRoots = ["src", "test", "e2e", "scripts"];
  const codeFiles: string[] = [];
  for (const directory of codeRoots) codeFiles.push(...await directoryFiles(join(root, directory)));
  for (const filename of ["package.json", "package-lock.json", "tsconfig.json", "playwright.phase3.config.ts"]) {
    try {
      await access(join(root, filename), constants.F_OK);
      codeFiles.push(join(root, filename));
    } catch {
      // Missing optional validation configuration is reflected by the file count.
    }
  }
  codeFiles.sort((left, right) => left.localeCompare(right));
  const records: string[] = [];
  for (const file of codeFiles) records.push(`${relative(root, file)}\u0000${digest(await readFile(file))}`);
  const product = await hashedDirectory(resolve(root, productDataDir()));
  return {
    codeHash: digest(records.join("\n")),
    fileCount: codeFiles.length,
    manifestHash: digest(manifestText),
    productDataHash: product.hash,
    commit: await readCommit(),
  };
}

function parseManifest(text: string): Manifest {
  const value = JSON.parse(text) as Partial<Manifest>;
  if (value.frozen !== true || value.provider !== "openrouter" || typeof value.domain !== "string" || !value.domain.trim()) {
    throw new Error("Phase 3 real-provider manifest is invalid or not frozen.");
  }
  if (value.language !== "en" && value.language !== "zh") throw new Error("Phase 3 manifest language must be en or zh.");
  if (!value.limits || !Number.isInteger(value.limits.maxProviderCalls) || typeof value.limits.maxKnownCostUsd !== "number") {
    throw new Error("Phase 3 manifest limits are invalid.");
  }
  if (!Array.isArray(value.stages) || value.stages.length !== 3) throw new Error("Phase 3 manifest must contain exactly three ordered stages.");
  const expectedIds = ["R3-01", "R3-02", "R3-03"];
  for (let index = 0; index < expectedIds.length; index += 1) {
    const stage = value.stages[index];
    if (!stage || stage.id !== expectedIds[index] || !Array.isArray(stage.models) || stage.models.length === 0 || stage.models.length > 4) {
      throw new Error("Phase 3 manifest stages are invalid.");
    }
    for (const model of stage.models) {
      if (!model || typeof model.modelId !== "string" || !model.modelId || (model.webSearchMode !== "off" && model.webSearchMode !== "provider_native")) {
        throw new Error("Phase 3 manifest contains an invalid model selection.");
      }
    }
  }
  return value as Manifest;
}

async function commandRecord(command: string, args: string[]): Promise<CommandRecord> {
  try {
    const result = await runCommand(command, args, { cwd: root, maxBuffer: 20 * 1024 * 1024 });
    const output = `${result.stdout}\n${result.stderr}`;
    return { command: [command, ...args].join(" "), exitCode: 0, passedCount: occurrences(output, "✔ "), outputHash: digest(output) };
  } catch (error) {
    const candidate = error as { stdout?: string; stderr?: string; code?: number };
    const output = `${candidate.stdout || ""}\n${candidate.stderr || ""}`;
    return { command: [command, ...args].join(" "), exitCode: typeof candidate.code === "number" ? candidate.code : 1, passedCount: occurrences(output, "✔ "), outputHash: digest(output) };
  }
}

async function settled(service: ProductRecognitionRunService, projectId: string, runId: string) {
  for (let index = 0; index < 120; index += 1) {
    const detail = await service.get(projectId, runId);
    if (detail.run.status !== "queued" && detail.run.status !== "running") return detail;
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("A Phase 3 real-provider run did not settle before its timeout.");
}

function valueAtProviderPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  let index = 0;
  while (index < path.length) {
    const dot = path.indexOf(".", index);
    const bracket = path.indexOf("[", index);
    const next = dot === -1 ? bracket : bracket === -1 ? dot : Math.min(dot, bracket);
    if (next === -1) {
      const key = path.slice(index);
      return current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>)[key] : undefined;
    }
    if (next > index) {
      const key = path.slice(index, next);
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    if (path[next] === ".") {
      index = next + 1;
      continue;
    }
    const close = path.indexOf("]", next + 1);
    if (close === -1 || !Array.isArray(current)) return undefined;
    const offset = Number(path.slice(next + 1, close));
    if (!Number.isInteger(offset)) return undefined;
    current = current[offset];
    index = close + 1;
    if (path[index] === ".") index += 1;
  }
  return current;
}

function providerNativeExecution(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const search = value as Record<string, unknown>;
  const executionMode = search.executionMode;
  return search.used === true && search.usedMode === "provider_native" && (executionMode === "native" || executionMode === "sdk" || executionMode === "provider_always_on");
}

async function runStage(input: {
  manifest: Manifest;
  stage: StageDefinition;
  dataDir: string;
}): Promise<{
  id: string;
  status: "passed" | "failed" | "inconclusive";
  runId: string | null;
  modelRuns: Array<Record<string, unknown>>;
  providerCalls: number;
  knownTokenUsage: { input: number; output: number; total: number };
  knownCostUsd: number;
  errors: string[];
}> {
  const projectStore = new ProductProjectFileStore(input.dataDir);
  const projects = new ProductProjectService(projectStore);
  const configurations = new ProductConfigurationFileStore(projectStore);
  const catalog = new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES);
  const selections = new ProductModelSelectionService(projects, configurations, catalog);
  const baselines = new ProductBaselineService(projects, selections, configurations);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const service = new ProductRecognitionRunService(projects, baselines, recognitionStore);
  const errors: string[] = [];
  const project = await projects.createDraft({
    primaryDomain: input.manifest.domain,
    name: `Phase 3 ${input.stage.id}`,
    defaultLanguage: input.manifest.language,
  });
  await selections.replace(project.id, input.stage.models);
  await baselines.create(project.id);
  const created = await service.start(project.id, `phase3-final-${input.stage.id}`);
  const complete = await settled(service, project.id, created.run.id);
  const modelRuns: Array<Record<string, unknown>> = [];
  let providerCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let knownCostUsd = 0;
  for (const modelRun of complete.modelRuns) {
    const detail = await service.getModelRun(project.id, created.run.id, modelRun.id);
    const attempt = detail.attempts[detail.attempts.length - 1];
    const archive = detail.archive;
    if (!attempt) errors.push(`${modelRun.modelSnapshot.modelId} has no persisted attempt.`);
    if (attempt) {
      providerCalls += 1;
      inputTokens += attempt.tokenUsage?.input || 0;
      outputTokens += attempt.tokenUsage?.output || 0;
      totalTokens += attempt.tokenUsage?.total || 0;
      if (typeof attempt.costUsd === "number") knownCostUsd += attempt.costUsd;
      if (attempt.rawAnswer === undefined || attempt.rawProviderResponse === undefined) errors.push(`${modelRun.modelSnapshot.modelId} did not persist raw Provider evidence.`);
    }
    if (modelRun.status !== "completed") errors.push(`${modelRun.modelSnapshot.modelId} finished as ${modelRun.status}.`);
    if (!archive) errors.push(`${modelRun.modelSnapshot.modelId} has no RecognitionResult archive.`);
    if (archive?.result.analysisStatus === "analysis_failed") errors.push(`${modelRun.modelSnapshot.modelId} did not produce a valid structured RecognitionResult.`);
    const citationChecks = archive?.providerCitations.map((citation) => ({
      url: citation.url,
      title: citation.title,
      providerPayloadPath: citation.providerPayloadPath,
      pathValue: attempt ? valueAtProviderPath(attempt.rawProviderResponse, citation.providerPayloadPath) : undefined,
      matchesPayload: attempt ? valueAtProviderPath(attempt.rawProviderResponse, citation.providerPayloadPath) === citation.url : false,
    })) || [];
    if (modelRun.recognitionMode === "unaided_domain_recognition" && (archive?.providerCitations.length || 0) !== 0) {
      errors.push(`${modelRun.modelSnapshot.modelId} stored Provider Citation for an offline observation.`);
    }
    modelRuns.push({
      modelId: modelRun.modelSnapshot.modelId,
      recognitionMode: modelRun.recognitionMode,
      status: modelRun.status,
      attemptId: attempt?.id || null,
      attemptStatus: attempt?.status || null,
      analysisStatus: archive?.result.analysisStatus || null,
      domainRecognition: archive?.result.domainRecognition || null,
      rawAnswerPersisted: attempt?.rawAnswer !== undefined,
      rawProviderResponsePersisted: attempt?.rawProviderResponse !== undefined,
      tokenUsage: attempt?.tokenUsage || null,
      costUsd: attempt?.costUsd ?? null,
      providerCitations: citationChecks,
      answerMentionedUrlCount: archive?.answerMentionedUrls.length || 0,
      competitorCount: archive?.competitors.length || 0,
      brandKeywordCount: archive?.brandKeywords.length || 0,
      competitorKeywordCount: archive?.competitorKeywords.length || 0,
      archivePath: join(input.dataDir, "projects", project.id, "recognition-runs", created.run.id, "model-runs", modelRun.id, "recognition-archives", `${attempt?.id || "missing"}.json`),
    });
  }
  if (complete.modelRuns.length !== input.stage.models.length) errors.push("The persisted ModelRun count does not match the frozen configuration.");
  if (input.stage.requireNativeCitation) {
    const nativeDetails = modelRuns.filter((row) => row.recognitionMode === "native_web_domain_discovery");
    const nativeCitation = nativeDetails.some((row) => {
      const citations = Array.isArray(row.providerCitations) ? row.providerCitations : [];
      return citations.some((citation) => citation && typeof citation === "object" && (citation as Record<string, unknown>).matchesPayload === true);
    });
    if (!nativeCitation) {
      return { id: input.stage.id, status: "inconclusive", runId: created.run.id, modelRuns, providerCalls, knownTokenUsage: { input: inputTokens, output: outputTokens, total: totalTokens }, knownCostUsd, errors: [...errors, "The native-web response did not return a traceable Provider Citation."] };
    }
    const matchingNative = complete.modelRuns.find((modelRun) => modelRun.recognitionMode === "native_web_domain_discovery");
    if (matchingNative) {
      const detail = await service.getModelRun(project.id, created.run.id, matchingNative.id);
      const latest = detail.attempts[detail.attempts.length - 1];
      if (!providerNativeExecution(latest?.providerSearch)) errors.push("The native-web request did not record Provider-native execution.");
    }
  }
  return {
    id: input.stage.id,
    status: errors.length === 0 ? "passed" : "failed",
    runId: created.run.id,
    modelRuns,
    providerCalls,
    knownTokenUsage: { input: inputTokens, output: outputTokens, total: totalTokens },
    knownCostUsd,
    errors,
  };
}

async function freeze(manifestText: string, manifest: Manifest): Promise<void> {
  await mkdir(validationDir, { recursive: true });
  const deterministic = await commandRecord("npm", ["test"]);
  const browser = await commandRecord("npm", ["run", "test:phase3-browser"]);
  await writeFile(deterministicPath, `${JSON.stringify({ deterministic, browser }, null, 2)}\n`, "utf8");
  if (deterministic.exitCode !== 0 || browser.exitCode !== 0) {
    throw new Error("The Phase 3 deterministic or browser verification failed; real Provider validation was not frozen.");
  }
  const current = await integrity(manifestText);
  const snapshot = {
    phase: "phase-3",
    frozenAt: new Date().toISOString(),
    manifest: { path: manifestPath, hash: current.manifestHash },
    code: { hash: current.codeHash, fileCount: current.fileCount, commit: current.commit },
    productData: { path: resolve(root, productDataDir()), hash: current.productDataHash },
    temporaryDataDirectory: join(validationDir, "real-provider-final-data"),
    maximumProviderCalls: manifest.limits.maxProviderCalls,
    maximumKnownCostUsd: manifest.limits.maxKnownCostUsd,
    domain: manifest.domain,
    offlineModel: manifest.stages[0]?.models[0]?.modelId || null,
    nativeModel: manifest.stages[1]?.models[0]?.modelId || null,
    deterministic,
    browser,
  };
  await writeFile(beforePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function execute(manifestText: string, manifest: Manifest): Promise<void> {
  const before = JSON.parse(await readFile(beforePath, "utf8")) as {
    code: { hash: string; fileCount: number };
    manifest: { hash: string };
    productData: { hash: string };
    maximumProviderCalls: number;
    maximumKnownCostUsd: number;
  };
  const initial = await integrity(manifestText);
  const preflightMatches = initial.codeHash === before.code.hash
    && initial.fileCount === before.code.fileCount
    && initial.manifestHash === before.manifest.hash
    && initial.productDataHash === before.productData.hash;
  const dataDir = join(validationDir, `real-provider-final-data-${Date.now()}`);
  const report: {
    phase: "phase-3";
    startedAt: string;
    status: "passed" | "failed" | "blocked" | "inconclusive";
    phase3Status: "passed" | "failed" | "blocked";
    phase4Allowed: "yes" | "no";
    isolation: { dataDir: string; productDataWasUsed: false };
    stages: Awaited<ReturnType<typeof runStage>>[];
    totalProviderCalls: number;
    totalKnownTokenUsage: { input: number; output: number; total: number };
    totalKnownCostUsd: number;
    errors: string[];
  } = {
    phase: "phase-3",
    startedAt: new Date().toISOString(),
    status: "failed",
    phase3Status: "failed",
    phase4Allowed: "no",
    isolation: { dataDir, productDataWasUsed: false },
    stages: [],
    totalProviderCalls: 0,
    totalKnownTokenUsage: { input: 0, output: 0, total: 0 },
    totalKnownCostUsd: 0,
    errors: [],
  };
  const writeAfter = async () => {
    const finalIntegrity = await integrity(manifestText);
    const after = {
      phase: "phase-3",
      capturedAt: new Date().toISOString(),
      code: { hash: finalIntegrity.codeHash, fileCount: finalIntegrity.fileCount, commit: finalIntegrity.commit },
      manifest: { hash: finalIntegrity.manifestHash },
      productData: { path: resolve(root, productDataDir()), hash: finalIntegrity.productDataHash },
      matchesFrozenBefore: finalIntegrity.codeHash === before.code.hash
        && finalIntegrity.fileCount === before.code.fileCount
        && finalIntegrity.manifestHash === before.manifest.hash
        && finalIntegrity.productDataHash === before.productData.hash,
    };
    await writeFile(afterPath, `${JSON.stringify(after, null, 2)}\n`, "utf8");
    return after;
  };
  if (!preflightMatches) {
    report.status = "blocked";
    report.phase3Status = "blocked";
    report.errors.push("Code, manifest, or product data changed after the final real-provider cycle was frozen.");
    await writeAfter();
    await writeFile(realResultsPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.exitCode = 1;
    return;
  }
  if (!hasProviderKey("openrouter")) {
    report.status = "blocked";
    report.phase3Status = "blocked";
    report.errors.push("OPENROUTER_API_KEY or OPENROUTER_KEY is unavailable.");
    await writeAfter();
    await writeFile(realResultsPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.exitCode = 1;
    return;
  }
  for (const stage of manifest.stages) {
    const plannedCalls = report.totalProviderCalls + stage.models.length;
    if (plannedCalls > before.maximumProviderCalls) {
      report.errors.push(`The frozen maximum of ${before.maximumProviderCalls} provider calls would be exceeded before ${stage.id}.`);
      break;
    }
    let result: Awaited<ReturnType<typeof runStage>>;
    try {
      result = await runStage({ manifest, stage, dataDir: join(dataDir, stage.id) });
    } catch (error) {
      result = {
        id: stage.id,
        status: "failed",
        runId: null,
        modelRuns: [],
        providerCalls: 0,
        knownTokenUsage: { input: 0, output: 0, total: 0 },
        knownCostUsd: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
    report.stages.push(result);
    report.totalProviderCalls += result.providerCalls;
    report.totalKnownTokenUsage.input += result.knownTokenUsage.input;
    report.totalKnownTokenUsage.output += result.knownTokenUsage.output;
    report.totalKnownTokenUsage.total += result.knownTokenUsage.total;
    report.totalKnownCostUsd += result.knownCostUsd;
    if (report.totalKnownCostUsd > before.maximumKnownCostUsd) {
      report.errors.push(`The frozen known-cost cap of ${before.maximumKnownCostUsd} was exceeded.`);
      break;
    }
    if (result.status !== "passed") {
      report.errors.push(`${stage.id} ${result.status}; later real-provider stages were not executed.`);
      break;
    }
  }
  const after = await writeAfter();
  if (!after.matchesFrozenBefore) report.errors.push("Code, manifest, or product data changed during real-provider execution.");
  const allStagesPassed = report.stages.length === manifest.stages.length && report.stages.every((stage) => stage.status === "passed");
  if (allStagesPassed && report.errors.length === 0) {
    report.status = "passed";
    report.phase3Status = "passed";
    report.phase4Allowed = "yes";
  } else if (report.stages.some((stage) => stage.status === "inconclusive")) {
    report.status = "inconclusive";
  }
  await writeFile(realResultsPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.phase3Status !== "passed") process.exitCode = 1;
}

async function main(): Promise<void> {
  loadDotEnv();
  await mkdir(validationDir, { recursive: true });
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = parseManifest(manifestText);
  if (process.argv.includes("--freeze")) {
    await freeze(manifestText, manifest);
    return;
  }
  await execute(manifestText, manifest);
}

main().catch(async (error) => {
  await mkdir(validationDir, { recursive: true });
  const message = error instanceof Error ? error.message : String(error);
  await writeFile(realResultsPath, `${JSON.stringify({ phase: "phase-3", status: "failed", phase3Status: "failed", phase4Allowed: "no", error: message }, null, 2)}\n`, "utf8");
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
