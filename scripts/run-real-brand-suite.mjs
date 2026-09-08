import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditRunner } from "../dist/src/runner/audit-runner.js";
import { loadDotEnv, resolveProviderKey } from "../dist/src/config/env.js";
import { entityFromInput } from "../dist/src/utils/domain.js";
import { DeterministicPlanBuilder } from "../dist/src/planning/deterministic-plan-builder.js";
import { ProjectFileStore } from "../dist/src/projects/project-store.js";
import { ProjectService } from "../dist/src/projects/project-service.js";
import { RunOrchestrator } from "../dist/src/monitoring/run-orchestrator.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(repositoryRoot);
loadDotEnv();

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function filesUnder(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    if (entry.isFile()) output.push(path);
  }
  return output;
}

async function codeIntegrity() {
  const roots = ["src", "test", "scripts"];
  const files = [];
  for (const root of roots) files.push(...await filesUnder(join(repositoryRoot, root)));
  for (const rootFile of ["package.json", "package-lock.json", "tsconfig.json"]) files.push(join(repositoryRoot, rootFile));
  files.sort((left, right) => left.localeCompare(right));
  const records = [];
  for (const file of files) {
    const content = await readFile(file);
    records.push(`${relative(repositoryRoot, file)}\u0000${digest(content)}`);
  }
  return { codeHash: digest(records.join("\n")), fileCount: files.length };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function openRouterUsage(apiKey) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return { verified: false, error: `HTTP ${response.status}` };
    const payload = await response.json();
    const usage = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
      ? Number(payload.data.usage)
      : Number.NaN;
    return Number.isFinite(usage) ? { verified: true, usage } : { verified: false, error: "Usage value missing" };
  } catch (error) {
    return { verified: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function productArtifacts(paths) {
  return {
    auditJson: paths?.auditJson || null,
    reportHtml: paths?.reportHtml || null,
    reportMarkdown: paths?.reportMd || null,
  };
}

function actualIntents(providerRun) {
  if (providerRun?.intentAnalysis?.status !== "completed") return [];
  const values = [
    providerRun.intentAnalysis.promptIntent.primaryIntent,
    ...providerRun.intentAnalysis.promptIntent.secondaryIntents,
  ];
  return [...new Set(values.filter((value) => value && value !== "unclear"))];
}

function providerCallsByPurpose(records) {
  const summary = {};
  for (const record of records || []) {
    const current = summary[record.purpose] || { attempts: 0, completed: 0, empty: 0, failed: 0, costUsd: 0 };
    current.attempts += 1;
    current[record.outcome] += 1;
    if (typeof record.costUsd === "number") current.costUsd += record.costUsd;
    summary[record.purpose] = current;
  }
  return summary;
}

async function executeCase(testCase, cycleDirectory) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const caseRunsRoot = join(cycleDirectory, "runs", testCase.id);
  await mkdir(caseRunsRoot, { recursive: true });
  let plan = null;
  let project = null;
  try {
    const target = entityFromInput({ type: "target", domain: testCase.domain, name: testCase.brand });
    plan = new DeterministicPlanBuilder().build({
      target,
      competitors: [],
      questions: [{ id: `${testCase.id}-question`, text: testCase.question }],
      providerTargets: [{
        providerId: "openrouter",
        model: testCase.model,
        webSearchEnabled: testCase.webSearch,
        webSearchMode: testCase.webSearch ? "provider_native" : "auto",
      }],
      language: testCase.language,
      runCountPerQuestion: 1,
      scopeConfirmed: true,
    }, {
      planId: `plan-${testCase.id}`,
      plannedAt: startedAt,
    });
    const monitoringStore = new ProjectFileStore(process.env.MONITORING_DATA_DIR);
    const projectService = new ProjectService();
    project = projectService.projectFromAuditPlan(plan);
    await monitoringStore.saveProject(project);
    const output = await new AuditRunner().run({
      confirmedPlan: plan,
      maxTokens: 600,
      runsRoot: caseRunsRoot,
    });
    const materialized = await new RunOrchestrator(monitoringStore).recordAuditOutput(output.audit, output.paths);
    const prompt = output.audit.prompts[0];
    const providerRun = output.audit.runs[0];
    const classifiedIntents = actualIntents(providerRun);
    const missingExpectedIntents = testCase.expectedIntents.filter((intent) => !classifiedIntents.includes(intent));
    const artifacts = productArtifacts(output.paths);
    const artifactChecks = {
      auditJson: artifacts.auditJson ? await exists(artifacts.auditJson) : false,
      reportHtml: artifacts.reportHtml ? await exists(artifacts.reportHtml) : false,
      reportMarkdown: artifacts.reportMarkdown ? await exists(artifacts.reportMarkdown) : false,
    };
    const errors = [];
    if (output.audit.prompts.length !== 1) errors.push(`Expected one prompt, received ${output.audit.prompts.length}.`);
    if (prompt?.text !== testCase.question) errors.push("The executed prompt does not equal the frozen question.");
    if (!plan || plan.prompts.length !== 1) errors.push("Deterministic plan was not created.");
    if (!materialized.project || materialized.project.id !== project.id) errors.push("Isolated project was not materialized.");
    for (const intent of missingExpectedIntents) errors.push(`Expected intent was not classified: ${intent}.`);
    if (output.audit.runs.length !== 1) errors.push(`Expected one provider run, received ${output.audit.runs.length}.`);
    if (providerRun?.status !== "completed") errors.push(`Provider run failed: ${providerRun?.error || "unknown error"}.`);
    if (!providerRun?.result?.text.trim()) errors.push("Provider returned no usable answer text.");
    if (providerRun?.intentAnalysis?.status !== "completed") errors.push(`Intent analysis failed: ${providerRun?.intentAnalysis?.error || "unknown error"}.`);
    if (testCase.webSearch && providerRun?.search?.requested !== true) errors.push("Provider-native web search was not requested.");
    if (testCase.webSearch && providerRun?.search?.requestMode !== "provider_native") errors.push("Provider-native web search mode was not preserved.");
    if (testCase.webSearch && providerRun?.search?.usedMode !== "provider_native") errors.push("Provider-native web search execution was not confirmed.");
    if (testCase.webSearch && !providerRun?.search?.toolName) errors.push("Provider-native search mechanism was not recorded.");
    if (testCase.webSearch && providerRun?.search?.executionMode !== "native" && providerRun?.search?.executionMode !== "provider_always_on") {
      errors.push(`Provider-native execution mode was not confirmed: ${providerRun?.search?.executionMode || "missing"}.`);
    }
    if (!artifactChecks.auditJson || !artifactChecks.reportHtml || !artifactChecks.reportMarkdown) errors.push("One or more product report artifacts are missing.");
    const status = errors.length === 0 ? "passed" : "failed";
    return {
      id: testCase.id,
      status,
      input: {
        domain: testCase.domain,
        brand: testCase.brand,
        question: testCase.question,
        language: testCase.language,
        model: testCase.model,
        webSearch: testCase.webSearch,
        expectedIntents: testCase.expectedIntents,
      },
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      admission: {
        accepted: true,
        scopeConfirmed: true,
        sitePreparationStatus: "not_requested",
      },
      plan: {
        id: plan.id,
        promptSetHash: plan.promptSetHash,
        plannedObservationCount: plan.estimate.providerRunCount,
        providerTargets: plan.providerTargets,
      },
      project: {
        id: materialized.project.id,
        domain: materialized.project.domain,
      },
      run: {
        id: materialized.run.id,
        status: materialized.run.status,
      },
      classification: providerRun?.intentAnalysis?.promptIntent || null,
      actualIntents: classifiedIntents,
      missingExpectedIntents,
      providerRun: providerRun ? {
        status: providerRun.status,
        error: providerRun.error || null,
        answerNonEmpty: Boolean(providerRun.result?.text.trim()),
        answerLength: providerRun.result?.text.length || 0,
        citationCount: providerRun.analysis?.citations.length || 0,
        intentAnalysisStatus: providerRun.intentAnalysis?.status || null,
        intentAnalysisError: providerRun.intentAnalysis?.error || null,
        searchUsed: providerRun.search?.used ?? false,
        searchMode: providerRun.search?.usedMode || "none",
        searchRequestMode: providerRun.search?.requestMode || null,
        searchToolName: providerRun.search?.toolName || null,
        searchExecutionMode: providerRun.search?.executionMode || null,
        tokenUsage: providerRun.result?.tokenUsage || null,
        costUsd: providerRun.result?.costUsd ?? null,
      } : null,
      productArtifacts: artifacts,
      providerCallsByPurpose: providerCallsByPurpose(output.audit.providerCalls),
      artifactChecks,
      errors,
      failureClass: status === "failed" ? "acceptance_failed" : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: testCase.id,
      status: "failed",
      input: {
        domain: testCase.domain,
        brand: testCase.brand,
        question: testCase.question,
        language: testCase.language,
        model: testCase.model,
        webSearch: testCase.webSearch,
        expectedIntents: testCase.expectedIntents,
      },
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      admission: null,
      plan: plan ? { id: plan.id, promptSetHash: plan.promptSetHash, plannedObservationCount: plan.estimate.providerRunCount } : null,
      project: project ? { id: project.id, domain: project.domain } : null,
      run: null,
      classification: null,
      actualIntents: [],
      missingExpectedIntents: [...testCase.expectedIntents],
      providerRun: null,
      productArtifacts: productArtifacts(undefined),
      providerCallsByPurpose: {},
      artifactChecks: { auditJson: false, reportHtml: false, reportMarkdown: false },
      errors: [message],
      failureClass: "execution_failed",
    };
  }
}

const manifestArgument = process.argv[2];
const cycleArgument = process.argv[3];
if (!manifestArgument || !cycleArgument) {
  throw new Error("Usage: node scripts/run-real-brand-suite.mjs <manifest.json> <cycle-directory>");
}

const manifestPath = resolve(repositoryRoot, manifestArgument);
const cycleDirectory = resolve(repositoryRoot, cycleArgument);
const isolatedMonitoringDataDirectory = join(cycleDirectory, "product-data");
process.env.MONITORING_DATA_DIR = isolatedMonitoringDataDirectory;
await mkdir(join(cycleDirectory, "cases"), { recursive: true });
await mkdir(isolatedMonitoringDataDirectory, { recursive: true });
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
if (!manifest.frozen || !Array.isArray(manifest.cases) || manifest.cases.length === 0) {
  throw new Error("The real-provider manifest must be frozen and contain at least one case.");
}

const selectedCaseIds = new Set((process.argv[4] || "").split(",").map((value) => value.trim()).filter(Boolean));
const selectedCases = selectedCaseIds.size > 0 ? manifest.cases.filter((testCase) => selectedCaseIds.has(testCase.id)) : manifest.cases;
if (selectedCases.length === 0) throw new Error("No manifest cases matched the requested selection.");

const apiKey = resolveProviderKey("openrouter");
const integrityBefore = {
  capturedAt: new Date().toISOString(),
  ...await codeIntegrity(),
  manifestHash: digest(manifestText),
  caseCount: selectedCases.length,
};
await writeFile(join(cycleDirectory, "integrity-before.json"), `${JSON.stringify(integrityBefore, null, 2)}\n`);
await writeFile(join(cycleDirectory, "test-manifest.json"), manifestText);
const usageBefore = await openRouterUsage(apiKey);
const startedAt = new Date().toISOString();
const cases = [];

for (const testCase of selectedCases) {
  const result = await executeCase(testCase, cycleDirectory);
  cases.push(result);
  await writeFile(join(cycleDirectory, "cases", `${testCase.id}.json`), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${testCase.id}: ${result.status}\n`);
}

const finishedAt = new Date().toISOString();
const usageAfter = await openRouterUsage(apiKey);
const integrityAfter = {
  capturedAt: new Date().toISOString(),
  ...await codeIntegrity(),
  manifestHash: digest(await readFile(manifestPath, "utf8")),
  caseCount: selectedCases.length,
};
await writeFile(join(cycleDirectory, "integrity-after.json"), `${JSON.stringify(integrityAfter, null, 2)}\n`);

const passed = cases.filter((item) => item.status === "passed").length;
const report = {
  suiteId: manifest.suiteId,
  cycleId: basename(cycleDirectory),
  status: passed === cases.length ? "passed" : "failed",
  provider: "OpenRouter API",
  startedAt,
  finishedAt,
  frozenManifest: manifestPath,
  isolation: {
    monitoringDataDirectory: isolatedMonitoringDataDirectory,
    auditRunsDirectory: join(cycleDirectory, "runs"),
    writesToWorkspaceProductData: false,
  },
  integrity: {
    codeUnchanged: integrityBefore.codeHash === integrityAfter.codeHash,
    manifestUnchanged: integrityBefore.manifestHash === integrityAfter.manifestHash,
    before: integrityBefore,
    after: integrityAfter,
  },
  actualProviderUsage: {
    before: usageBefore,
    after: usageAfter,
    usageDelta: usageBefore.verified && usageAfter.verified ? usageAfter.usage - usageBefore.usage : null,
    currency: "USD",
  },
  totals: {
    cases: cases.length,
    passed,
    failed: cases.length - passed,
    productReportsGenerated: cases.filter((item) => item.artifactChecks.reportHtml).length,
  },
  failureClasses: cases.reduce((counts, item) => {
    if (!item.failureClass) return counts;
    counts[item.failureClass] = (counts[item.failureClass] || 0) + 1;
    return counts;
  }, {}),
  cases,
};
await writeFile(join(cycleDirectory, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`validation-report: ${join(cycleDirectory, "validation-report.json")}\n`);
if (report.status !== "passed" || !report.integrity.codeUnchanged || !report.integrity.manifestUnchanged) process.exitCode = 1;
