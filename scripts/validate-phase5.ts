import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const validationRoot = join(root, "validation", "rebuild-phase-5-2026-09-07");
const phaseFourRoot = join(root, "validation", "rebuild-phase-4-2026-09-07");
const sourceRoots = [
  "package.json",
  "docs/PHASE5_MEASUREMENT_ARCHITECTURE.md",
  "src/product/measurements",
  "src/product/scheduling",
  "src/product/product-server.ts",
  "src/ui/product-phase5-app.ts",
  "test/fixtures/phase5-fixture-adapter.ts",
  "test/fixtures/phase5-product-server.ts",
  "test/product-measurements.test.ts",
  "e2e/phase5-measurements.spec.ts",
  "playwright.phase5.config.ts",
  "scripts/validate-phase5.ts",
  "scripts/run-phase5-unit.ts",
];
const codeRoots = ["src", "test", "e2e", "scripts"];
const legacyDirectories = ["src/monitoring", "src/dashboard", "src/timeseries"];
const prohibitedProductLiterals = new Set(["niubistar", "niubistar.com"]);

type FileHash = { path: string; sha256: string; bytes: number };
type SourceFinding = { path: string; line: number; column: number; kind: string; detail: string };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collect(path: string): Promise<string[]> {
  const absolute = resolve(root, path);
  if (!(await exists(absolute))) return [];
  if (!(await stat(absolute)).isDirectory()) return [absolute];
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) await visit(child);
      if (entry.isFile()) files.push(child);
    }
  };
  await visit(absolute);
  return files.sort((left, right) => left.localeCompare(right));
}

async function hashes(paths: string[]): Promise<FileHash[]> {
  const files = (await Promise.all(paths.map(collect))).flat();
  const output: FileHash[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    output.push({ path: relative(root, file), sha256: sha256(content), bytes: Buffer.byteLength(content) });
  }
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

function sourceFindings(path: string, content: string): { regex: SourceFinding[]; productLiteral: SourceFinding[] } {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  const regex: SourceFinding[] = [];
  const productLiteral: SourceFinding[] = [];
  const position = (node: ts.Node) => {
    const current = source.getLineAndCharacterOfPosition(node.getStart(source));
    return { line: current.line + 1, column: current.character + 1 };
  };
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) regex.push({ path, ...position(node), kind: "regular_expression_literal", detail: node.getText(source) });
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "RegExp") regex.push({ path, ...position(node), kind: "regular_expression_constructor", detail: node.getText(source) });
    if (path.startsWith("src/") && ts.isStringLiteralLike(node) && prohibitedProductLiterals.has(node.text.toLocaleLowerCase())) {
      productLiteral.push({ path, ...position(node), kind: "product_specific_literal", detail: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { regex, productLiteral };
}

async function scan(): Promise<{ fileCount: number; regexFindings: SourceFinding[]; productLiteralFindings: SourceFinding[] }> {
  const files = await hashes(codeRoots);
  const regexFindings: SourceFinding[] = [];
  const productLiteralFindings: SourceFinding[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".js")) continue;
    const content = await readFile(join(root, file.path), "utf8");
    const found = sourceFindings(file.path, content);
    regexFindings.push(...found.regex);
    productLiteralFindings.push(...found.productLiteral);
  }
  return { fileCount: files.length, regexFindings, productLiteralFindings };
}

async function legacyScope(): Promise<unknown> {
  const priorPath = join(phaseFourRoot, "preexisting-scope.json");
  const prior = await exists(priorPath) ? JSON.parse(await readFile(priorPath, "utf8")) as { hashes?: FileHash[] } : null;
  const current = await hashes(legacyDirectories);
  const productServer = await readFile(join(root, "src/product/product-server.ts"), "utf8");
  const imports = legacyDirectories.map((directory) => {
    const reference = directory.slice("src/".length);
    return { directory, importedByProductEntrypoint: productServer.includes(`/${reference}/`) || productServer.includes(`/${reference}.`) };
  });
  const priorHashes = prior && Array.isArray(prior.hashes) ? prior.hashes : [];
  return {
    phaseFourArtifact: relative(root, priorPath),
    existedBeforePhase5: prior !== null,
    phaseFourHashes: priorHashes,
    currentHashes: current,
    unchangedSincePhaseFour: JSON.stringify(priorHashes) === JSON.stringify(current),
    runtimeImports: imports,
    productEntrypointKeepsLegacyInactive: imports.every((item) => item.importedByProductEntrypoint === false),
  };
}

function requirements(): Array<{ id: string; requirement: string; evidence: string[] }> {
  return [
    { id: "R5.1", requirement: "协议 D 与 K 独立存档和统计", evidence: ["T01", "T02", "B05"] },
    { id: "R5.2", requirement: "固定样例 A 至 E 可由原始样本复算", evidence: ["fixed example A", "fixed example B", "fixed example C", "fixed example E"] },
    { id: "R5.3", requirement: "T01 至 T36 的边界覆盖", evidence: ["test/product-measurements.test.ts", "unit-results.json"] },
    { id: "R5.4", requirement: "八类图表有定义、公式和点到证据入口", evidence: ["B02", "B03"] },
    { id: "R5.5", requirement: "新增模型只执行新增模型，移除模型保留历史", evidence: ["T13", "T16", "T17", "T22", "B04"] },
    { id: "R5.6", requirement: "定时任务使用统一执行路径并持久化生命周期", evidence: ["T24", "T25", "T26", "T27", "T28", "T29", "T30", "B07"] },
    { id: "R5.7", requirement: "跨项目隔离、无 Provider 图表读取与中文 UI", evidence: ["T31", "T32", "T33", "T34", "B09", "network-audit.json"] },
    { id: "R5.8", requirement: "产品源码没有正则表达式和特定品牌分支", evidence: ["AST scan"] },
    { id: "R5.9", requirement: "真实 Provider 的协议 K 与定时任务端到端验证", evidence: ["real-provider-results.json"] },
  ];
}

function frozenManifest(sourceFiles: FileHash[]) {
  const byPath = (path: string) => sourceFiles.find((item) => item.path === path)?.sha256 || null;
  return {
    fixtureAdapterHash: byPath("test/fixtures/phase5-fixture-adapter.ts"),
    unitTestHash: byPath("test/product-measurements.test.ts"),
    browserTestHash: byPath("e2e/phase5-measurements.spec.ts"),
    fixedExamples: ["A", "B", "C", "D", "E"],
    boundaryCases: Array.from({ length: 36 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`),
    browserCases: Array.from({ length: 9 }, (_, index) => `B${String(index + 1).padStart(2, "0")}`),
    mutationPolicy: "Source, fixture, and manifest hashes must remain unchanged during the final test cycle.",
  };
}

function testAstCounts(content: string): { browserTestFiles: number; independentScenarios: number; assertionCalls: number; interactionCalls: number } {
  const source = ts.createSourceFile("e2e/phase5-measurements.spec.ts", content, ts.ScriptTarget.Latest, true);
  let independentScenarios = 0;
  let assertionCalls = 0;
  let interactionCalls = 0;
  const interactionNames = new Set(["click", "fill", "check", "uncheck", "selectOption", "press", "reload"]);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "test") independentScenarios += 1;
      if (ts.isIdentifier(node.expression) && node.expression.text === "expect") assertionCalls += 1;
      if (ts.isPropertyAccessExpression(node.expression) && interactionNames.has(node.expression.name.text)) interactionCalls += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { browserTestFiles: 1, independentScenarios, assertionCalls, interactionCalls };
}

async function readJson(name: string): Promise<unknown | null> {
  const path = join(validationRoot, name);
  return (await exists(path)) ? JSON.parse(await readFile(path, "utf8")) : null;
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await mkdir(validationRoot, { recursive: true });
  await writeFile(join(validationRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const mode = process.argv[2] || "freeze";
  const sourceFiles = await hashes(sourceRoots);
  const sourceScan = await scan();
  const scope = await legacyScope();
  const browserSource = await readFile(join(root, "e2e/phase5-measurements.spec.ts"), "utf8");
  const browserCounts = testAstCounts(browserSource);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    sourceFileCount: sourceFiles.length,
    sourceHash: sha256(JSON.stringify(sourceFiles)),
    sourceScan,
    preexistingScope: scope,
  };
  if (mode === "freeze") {
    await writeJson("requirements.json", { requirements: requirements() });
    await writeJson("measurement-contract.json", { domainProtocol: "domain-recognition/v1", keywordProtocol: "keyword-discovery/v1", metrics: 10, charts: 8, seriesKey: "modelId + webSearchMode + probe fingerprint", trendAttemptRule: "first attempt only", realProviderBudgetAuthorization: "required before any Phase 5 Provider request" });
    await writeJson("test-manifest.json", frozenManifest(sourceFiles));
    await writeJson("before.json", snapshot);
    await writeJson("change-scope.json", { sourceRoots, implementationDirectories: ["src/product/measurements", "src/product/scheduling"], productEntrypoint: "src/product/product-server.ts", uiEntrypoint: "src/ui/product-phase5-app.ts", legacyDirectories });
    await writeJson("preexisting-scope.json", scope);
    await writeJson("browser-ast-counts.json", browserCounts);
    process.stdout.write(`${JSON.stringify({ mode, validationRoot, sourceFileCount: sourceFiles.length, ...browserCounts, regexFindings: sourceScan.regexFindings.length, productLiteralFindings: sourceScan.productLiteralFindings.length }, null, 2)}\n`);
    return;
  }
  const before = await readJson("before.json") as { sourceFiles: FileHash[]; sourceHash: string } | null;
  const browserResults = await readJson("browser-results.json") as { passed?: number; failed?: number; results?: unknown[] } | null;
  const network = await readJson("network-audit.json") as { externalAttemptCount?: number; attemptCount?: number } | null;
  const sourceUnchanged = before !== null && JSON.stringify(before.sourceFiles) === JSON.stringify(sourceFiles);
  const legacy = scope as { unchangedSincePhaseFour: boolean; productEntrypointKeepsLegacyInactive: boolean };
  const unitResult = await readJson("unit-results.json") as { passed?: number; failed?: number } | null;
  const realProvider = {
    status: "not_run",
    reason: "No fresh Phase 5 Provider budget authorization was supplied.",
    providerRequestCount: 0,
    tokenCount: 0,
    costUsd: null,
    costCapStatus: "not_authorized",
  };
  const checks = {
    sourceUnchanged,
    noRegularExpressions: sourceScan.regexFindings.length === 0,
    noProductSpecificRuntimeLiterals: sourceScan.productLiteralFindings.length === 0,
    legacyUnchanged: legacy.unchangedSincePhaseFour,
    legacyInactive: legacy.productEntrypointKeepsLegacyInactive,
    unitPassed: unitResult?.failed === 0 && (unitResult?.passed || 0) > 0,
    browserPassed: browserResults?.failed === 0 && browserResults?.passed === browserCounts.independentScenarios,
    browserMadeNoExternalRequests: network?.externalAttemptCount === 0,
    realProviderExecuted: false,
  };
  const status = checks.realProviderExecuted ? "passed" : "blocked";
  await writeJson("after.json", { ...snapshot, sourceUnchanged });
  await writeJson("browser-results.json", { ...(browserResults || {}), ...browserCounts, testOutput: browserResults || null });
  await writeJson("real-provider-results.json", realProvider);
  await writeJson("network-and-cost.json", { browserNetwork: network, realProvider, totalExternalProviderRequestsThisPhase: 0, totalKnownCostUsdThisPhase: 0, unknownCostUsdThisPhase: null });
  await writeJson("scheduler-results.json", { unitEvidence: "monitoring tasks persist previews, lifecycle transitions, and model scope changes", browserEvidence: "B07", status: checks.unitPassed && checks.browserPassed ? "fixture_verified" : "not_verified", realScheduledProviderRun: "not_run_without_budget_authorization" });
  await writeJson("automated-results.json", { unit: unitResult, browser: { passed: browserResults?.passed || 0, failed: browserResults?.failed || 0, ...browserCounts }, sourceChecks: { regexFindings: sourceScan.regexFindings, productLiteralFindings: sourceScan.productLiteralFindings }, checks });
  await writeJson("acceptance-report.json", { phase5Status: status, phase6Allowed: "no", statusReason: realProvider.reason, checks, blockers: ["fresh_provider_budget_authorization", "real_protocol_k_execution", "real_scheduled_execution"] });
  process.stdout.write(`${JSON.stringify({ mode, phase5Status: status, checks, browserCounts, realProvider }, null, 2)}\n`);
  if (!checks.sourceUnchanged || !checks.noRegularExpressions || !checks.noProductSpecificRuntimeLiterals || !checks.legacyUnchanged || !checks.legacyInactive || !checks.unitPassed || !checks.browserPassed || !checks.browserMadeNoExternalRequests) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
