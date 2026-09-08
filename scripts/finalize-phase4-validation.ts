import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const validationRoot = join(root, "validation", "rebuild-phase-4-2026-09-07");

type Execution = {
  id: string;
  command: string;
  exitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function json<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(validationRoot, name), "utf8")) as T;
}

function numberAfter(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) return null;
  const value = line.slice(prefix.length).trim();
  if (!value || [...value].some((character) => character < "0" || character > "9")) return null;
  return Number(value);
}

function tapTotals(output: string): { tests: number | null; passed: number | null; failed: number | null; skipped: number | null } {
  const result = { tests: null as number | null, passed: null as number | null, failed: null as number | null, skipped: null as number | null };
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    result.tests = numberAfter(line, "# tests ") ?? numberAfter(line, "ℹ tests ") ?? result.tests;
    result.passed = numberAfter(line, "# pass ") ?? numberAfter(line, "ℹ pass ") ?? result.passed;
    result.failed = numberAfter(line, "# fail ") ?? numberAfter(line, "ℹ fail ") ?? result.failed;
    result.skipped = numberAfter(line, "# skipped ") ?? numberAfter(line, "ℹ skipped ") ?? result.skipped;
  }
  return result;
}

function playwrightTotals(output: string): { passed: number | null; failed: number | null; skipped: number | null } {
  const result = { passed: null as number | null, failed: null as number | null, skipped: null as number | null };
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    for (const key of ["passed", "failed", "skipped"] as const) {
      const marker = ` ${key}`;
      const markerAt = line.indexOf(marker);
      if (markerAt <= 0) continue;
      const candidate = line.slice(0, markerAt).trim();
      if (!candidate || [...candidate].some((character) => character < "0" || character > "9")) continue;
      result[key] = Number(candidate);
    }
  }
  return result;
}

async function sourceCounts(path: string): Promise<{ tests: number; expects: number }> {
  const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
  let tests = 0;
  let expects = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "test") tests += 1;
      if (node.expression.text === "expect") expects += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { tests, expects };
}

async function outputFor(execution: Execution): Promise<string> {
  return readFile(execution.stdoutPath, "utf8");
}

async function main(): Promise<void> {
  const executionFile = await json<{ executions: Execution[] }>("test-executions.json");
  const executions = new Map(executionFile.executions.map((entry) => [entry.id, entry]));
  const npmExecution = executions.get("npm-test");
  if (!npmExecution) throw new Error("npm test execution is missing.");
  const browserIds = ["phase1-browser", "phase2-browser", "phase3-browser", "phase4-browser"];
  const testResults: Record<string, unknown> = {
    npmTest: { ...npmExecution, totals: tapTotals(await outputFor(npmExecution)) },
    browser: {},
  };
  const browserResults = testResults.browser as Record<string, unknown>;
  const browserSources = new Map([
    ["phase1-browser", join(root, "e2e", "phase1-projects.spec.ts")],
    ["phase2-browser", join(root, "e2e", "phase2-configuration.spec.ts")],
    ["phase3-browser", join(root, "e2e", "phase3-recognition.spec.ts")],
    ["phase4-browser", join(root, "e2e", "phase4-reports.spec.ts")],
  ]);
  for (const id of browserIds) {
    const execution = executions.get(id);
    const path = browserSources.get(id);
    if (!execution || !path) throw new Error(`Browser execution ${id} is missing.`);
    browserResults[id] = { ...execution, totals: playwrightTotals(await outputFor(execution)), source: await sourceCounts(path) };
  }

  const before = await json<{ sourceFiles: unknown[]; realProviderEvidenceFiles: unknown[] }>("before.json");
  const after = await json<{ sourceUnchanged: boolean; realEvidenceUnchanged: boolean; sourceScan: { regexFindings: unknown[]; targetFindings: unknown[] }; preexistingScope: { passed: boolean } }>("after.json");
  const browser = await json<{ passed: number; failed: number; fixtureScenarioCount: number; realArchiveScenarioCount: number; browserTestFiles: number; actionAssertions: number; results: Array<{ id: string; status: string; screenshot: string }> }>("browser-results.json");
  const network = await json<{ externalAttemptCount: number; attemptCount: number }>("network-audit.json");
  const real = await json<{ providerCallsMadeByPhase4: number; source: { sourceArchiveUnchanged: boolean }; reports: Array<{ models: Array<{ providerCitationCount: number | null; rawAnswerAvailable: boolean }> }> }>("real-provider-derived-report.json");
  const freeze = executions.get("freeze-integrity");
  const allExecutionPassed = executionFile.executions.every((entry) => entry.exitCode === 0);
  const realModels = real.reports.flatMap((report) => report.models);
  const npmTotals = (testResults.npmTest as { totals: { tests: number | null; passed: number | null; failed: number | null; skipped: number | null } }).totals;
  const browserExecutionDetails = browserIds.map((id) => browserResults[id] as { totals: { passed: number | null }; source: { tests: number } });
  const browserExecutionCountsMatch = browserExecutionDetails.every((entry) => entry.totals.passed === entry.source.tests);
  const conditions = {
    freezeIntegrity: Boolean(after.sourceUnchanged && after.realEvidenceUnchanged && after.preexistingScope.passed && freeze?.exitCode === 0),
    noRegularExpressions: after.sourceScan.regexFindings.length === 0,
    noTargetSpecificProductLiterals: after.sourceScan.targetFindings.length === 0,
    regressionCommands: allExecutionPassed,
    unitTestTotals: npmTotals.tests !== null && npmTotals.passed === npmTotals.tests && npmTotals.failed === 0 && npmTotals.skipped === 0,
    browserExecutionCountsMatch,
    phase4Browser: browser.failed === 0 && browser.passed === browser.fixtureScenarioCount + browser.realArchiveScenarioCount,
    localOnlyBrowserRequests: network.externalAttemptCount === 0,
    phase4ProviderCalls: real.providerCallsMadeByPhase4 === 0,
    realArchiveUnchanged: real.source.sourceArchiveUnchanged,
    realArchiveHasRawAnswer: realModels.some((model) => model.rawAnswerAvailable),
    realArchiveHasProviderCitation: realModels.some((model) => (model.providerCitationCount || 0) > 0),
  };
  const passed = Object.values(conditions).every((value) => value);
  const result = {
    schemaVersion: "phase4-acceptance/v1",
    generatedAt: new Date().toISOString(),
    phase4Status: passed ? "passed" : "failed",
    phase5Allowed: passed ? "yes" : "no",
    finalCycleId: `phase4-final-${digest(JSON.stringify({ before, executions: executionFile.executions.map((entry) => ({ id: entry.id, stdoutPath: entry.stdoutPath, stderrPath: entry.stderrPath })), after })).slice(0, 24)}`,
    immutableInputs: {
      beforeSourceFileCount: before.sourceFiles.length,
      beforeRealProviderEvidenceFileCount: before.realProviderEvidenceFiles.length,
      beforeHash: digest(JSON.stringify(before)),
      afterHash: digest(JSON.stringify(after)),
      sourceUnchanged: after.sourceUnchanged,
      realEvidenceUnchanged: after.realEvidenceUnchanged,
    },
    testResults,
    phase4BrowserEvidence: browser,
    networkEvidence: network,
    realProviderArchiveEvidence: real,
    conditions,
    notImplementedInPhase4: ["综合报告", "趋势图", "定时监测任务"],
  };
  await writeFile(join(validationRoot, "automated-results.json"), `${JSON.stringify({ testResults, phase4BrowserEvidence: browser, networkEvidence: network }, null, 2)}\n`, "utf8");
  await writeFile(join(validationRoot, "acceptance-report.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ phase4Status: result.phase4Status, phase5Allowed: result.phase5Allowed, conditions }, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
