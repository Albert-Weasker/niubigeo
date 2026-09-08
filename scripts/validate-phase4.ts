import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const validationRoot = join(root, "validation", "rebuild-phase-4-2026-09-07");
const phaseThreeRoot = join(root, "validation", "rebuild-phase-3-2026-09-06");
const sourceRoots = ["package.json", "tsconfig.json", "src/product", "src/ui/product-phase2-app.ts", "src/ui/product-phase4-app.ts", "test/recognition-report.test.ts", "test/fixtures/phase4-fixture-adapter.ts", "test/fixtures/phase4-product-server-v2.ts", "e2e/phase4-reports.spec.ts", "playwright.phase4.config.ts", "scripts/validate-phase4.ts", "scripts/prepare-phase4-real-report.ts", "scripts/run-phase4-validation.ts", "scripts/finalize-phase4-validation.ts"];
const laterStageDirectories = ["src/monitoring", "src/dashboard", "src/timeseries"];
const targetTerms = new Set(["niubistar", "niubistar.com", "targetdocs", "forge", "beacon"]);
const codeRoots = ["src", "test", "e2e", "scripts"];

type FileHash = { path: string; sha256: string; bytes: number };
type Finding = { path: string; line: number; column: number; kind: string; detail: string };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function collectFiles(path: string): Promise<string[]> {
  const absolute = resolve(root, path);
  if (!(await isDirectory(absolute))) return [absolute];
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const item = join(directory, entry.name);
      if (entry.isDirectory()) await visit(item);
      if (entry.isFile()) result.push(item);
    }
  };
  await visit(absolute);
  return result.sort((left, right) => left.localeCompare(right));
}

async function hashes(paths: string[]): Promise<FileHash[]> {
  const files = (await Promise.all(paths.map(collectFiles))).flat();
  const values: FileHash[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    values.push({ path: relative(root, file), sha256: digest(content), bytes: Buffer.byteLength(content) });
  }
  return values.sort((left, right) => left.path.localeCompare(right.path));
}

function sourceFindings(path: string, content: string): { regex: Finding[]; target: Finding[] } {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  const regex: Finding[] = [];
  const target: Finding[] = [];
  const position = (node: ts.Node) => {
    const at = source.getLineAndCharacterOfPosition(node.getStart(source));
    return { line: at.line + 1, column: at.character + 1 };
  };
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) regex.push({ path, ...position(node), kind: "regular_expression_literal", detail: node.getText(source) });
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "RegExp") regex.push({ path, ...position(node), kind: "regular_expression_constructor", detail: node.getText(source) });
    if (path.startsWith("src/") && ts.isStringLiteralLike(node) && targetTerms.has(node.text.toLocaleLowerCase())) {
      target.push({ path, ...position(node), kind: "target_specific_literal", detail: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { regex, target };
}

async function scanSources(): Promise<{ regexFindings: Finding[]; targetFindings: Finding[] }> {
  const files = await hashes(codeRoots);
  const regexFindings: Finding[] = [];
  const targetFindings: Finding[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".js")) continue;
    const found = sourceFindings(file.path, await readFile(join(root, file.path), "utf8"));
    regexFindings.push(...found.regex);
    targetFindings.push(...found.target);
  }
  return { regexFindings, targetFindings };
}

async function preexistingScope(): Promise<unknown> {
  const hashesBefore = await hashes(laterStageDirectories);
  const server = await readFile(join(root, "src/product/product-server.ts"), "utf8");
  const runtimeImports = laterStageDirectories.map((directory) => ({
    directory,
    activatedByProductEntrypoint: server.includes(`/${directory.slice("src/".length)}/`) || server.includes(`/${directory.slice("src/".length)}.`),
  }));
  return {
    purpose: "Legacy directories are retained, but the package product entrypoint must not import or expose them.",
    hashes: hashesBefore,
    runtimeImports,
    passed: runtimeImports.every((entry) => entry.activatedByProductEntrypoint === false),
  };
}

async function realArchiveFiles(): Promise<FileHash[]> {
  const reference = (await readFile(join(phaseThreeRoot, "niubistar-live-current-path.txt"), "utf8")).trim();
  return hashes([relative(root, join(reference, "product-data"))]);
}

function requirements() {
  return [
    { id: "R01", requirement: "每份报告固定绑定一个 Run 与 active Attempt 快照", tests: ["T01", "T02", "T03", "T10", "T11", "T12"] },
    { id: "R02", requirement: "模型状态、原始回答、整理失败与请求失败分开保存和展示", tests: ["T04", "T15", "T16", "B01", "B05"] },
    { id: "R03", requirement: "竞争对象和关键词按原始记录精确归组，不跨模型或对象补全", tests: ["T06", "T07", "B02", "B03"] },
    { id: "R04", requirement: "Provider Citation 与回答 URL 分开，且 Provider payload path 可追溯", tests: ["T08", "B04", "B07"] },
    { id: "R05", requirement: "所有项目级父子资源隔离", tests: ["T09", "B06"] },
    { id: "R06", requirement: "报告只写派生目录，原始阶段3归档不可变", tests: ["T13", "B07"] },
    { id: "R07", requirement: "报告页面不执行 Provider、搜索、抓取或自动外链预览", tests: ["B01", "B02", "B03", "B04", "B05", "B06", "B07"] },
    { id: "R08", requirement: "默认产品入口不激活旧监测、趋势或仪表盘模块", tests: ["Phase 4 product entry"] },
    { id: "R09", requirement: "产品代码无正则且没有测试品牌分支", tests: ["AST source scan"] },
  ];
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await mkdir(validationRoot, { recursive: true });
  await writeFile(join(validationRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const mode = process.argv[2] || "freeze";
  const sourceHashes = await hashes(sourceRoots);
  const scan = await scanSources();
  const scope = await preexistingScope();
  const realArchive = await realArchiveFiles();
  const manifest = {
    frozenAt: new Date().toISOString(),
    fixtureAdapterHash: sourceHashes.find((entry) => entry.path === "test/fixtures/phase4-fixture-adapter.ts")?.sha256 || null,
    unitTestHash: sourceHashes.find((entry) => entry.path === "test/recognition-report.test.ts")?.sha256 || null,
    browserTestHash: sourceHashes.find((entry) => entry.path === "e2e/phase4-reports.spec.ts")?.sha256 || null,
    fixtureProjectA: { domain: "target.example", models: ["fixture/model-a", "fixture/model-b", "fixture/model-c", "fixture/model-d"] },
    fixtureProjectB: { domain: "other.example" },
    keywordNormalization: "trim plus locale lowercase only; no translation, synonym expansion, or semantic merge",
    tests: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T12", "T13", "T14", "T15", "T16", "B01", "B02", "B03", "B04", "B05", "B06", "B07"],
  };
  const snapshot = { generatedAt: new Date().toISOString(), sourceFiles: sourceHashes, sourceFileCount: sourceHashes.length, realProviderEvidenceFiles: realArchive, realProviderEvidenceFileCount: realArchive.length, sourceScan: scan, preexistingScope: scope };
  if (mode === "scan") {
    process.stdout.write(`${JSON.stringify({ mode, sourceFileCount: sourceHashes.length, regexFindings: scan.regexFindings, targetFindings: scan.targetFindings, preexistingScope: scope }, null, 2)}\n`);
    if (scan.regexFindings.length > 0 || scan.targetFindings.length > 0 || !(scope as { passed: boolean }).passed) process.exitCode = 1;
    return;
  }
  if (mode === "freeze") {
    await writeJson("requirements.json", { requirements: requirements() });
    await writeJson("test-manifest.json", manifest);
    await writeJson("before.json", snapshot);
    await writeJson("preexisting-scope.json", scope);
    await writeJson("change-scope.json", { phase4SourceFiles: sourceHashes.map((entry) => entry.path), productEntrypoint: "src/product/product-server.ts", legacyDirectoriesRetained: laterStageDirectories, sourceScan: scan });
    process.stdout.write(`${JSON.stringify({ mode, validationRoot, sourceFileCount: sourceHashes.length, regexFindings: scan.regexFindings.length, targetFindings: scan.targetFindings.length }, null, 2)}\n`);
    return;
  }
  const before = JSON.parse(await readFile(join(validationRoot, "before.json"), "utf8")) as { sourceFiles: FileHash[]; realProviderEvidenceFiles: FileHash[] };
  const sourceUnchanged = JSON.stringify(before.sourceFiles) === JSON.stringify(sourceHashes);
  const realEvidenceUnchanged = JSON.stringify(before.realProviderEvidenceFiles) === JSON.stringify(realArchive);
  await writeJson("after.json", { ...snapshot, sourceUnchanged, realEvidenceUnchanged });
  process.stdout.write(`${JSON.stringify({ mode, sourceUnchanged, realEvidenceUnchanged, regexFindings: scan.regexFindings.length, targetFindings: scan.targetFindings.length }, null, 2)}\n`);
  if (!sourceUnchanged || !realEvidenceUnchanged || scan.regexFindings.length > 0 || scan.targetFindings.length > 0 || !(scope as { passed: boolean }).passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
