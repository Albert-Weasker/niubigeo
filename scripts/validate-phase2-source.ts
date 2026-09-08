import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

type SourceFinding = {
  path: string;
  line: number;
  column: number;
  kind: string;
  detail: string;
};

const root = process.cwd();
const reportPath = join(root, "validation", "rebuild-phase-2-2026-09-05", "static-source-scan.json");
const sourceRoots = ["src", "test", "e2e", "scripts"];
const productRuntimeRoots = ["src/product", "src/ui/product-phase2-app.ts", "src/server.ts"];
const textExtensions = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const targetTerms = new Set([
  "niubistar",
  "niubistar.com",
  "trustmrr",
  "trustmrr.com",
  "vercel",
  "vercel.com",
  "supabase",
  "supabase.com",
  "posthog",
  "posthog.com",
  "sentry",
  "sentry.io",
  "stripe",
  "stripe.com",
  "docker",
  "docker.com",
  "hugging face",
  "huggingface.co",
  "linear",
  "linear.app",
]);
const phaseThreeTerms = new Set(["auditplan", "modelrun", "rawresponse", "comparisonreport", "monitoringtask"]);

function fileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

async function sourceFiles(directory: string): Promise<string[]> {
  const absolute = resolve(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(relative(root, candidate)));
      continue;
    }
    if (entry.isFile() && textExtensions.has(fileExtension(entry.name))) files.push(candidate);
  }
  return files;
}

function productRuntimePath(path: string): boolean {
  return productRuntimeRoots.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function sourcePosition(sourceFile: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: position.line + 1, column: position.character + 1 };
}

function expressionName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return "";
}

function conditionContainsTarget(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isStringLiteralLike(child) && targetTerms.has(child.text.toLocaleLowerCase())) found = true;
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

async function main(): Promise<void> {
  const files = (await Promise.all(sourceRoots.map((directory) => sourceFiles(directory)))).flat().sort((left, right) => left.localeCompare(right));
  const regularExpressionFindings: SourceFinding[] = [];
  const targetSpecificRuntimeFindings: SourceFinding[] = [];
  const phaseThreeProductFindings: SourceFinding[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ES2022, true);
    const relativePath = relative(root, file);
    const inProductRuntime = productRuntimePath(relativePath);
    const visit = (node: ts.Node): void => {
      const position = sourcePosition(sourceFile, node);
      if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
        regularExpressionFindings.push({ path: relativePath, ...position, kind: "literal", detail: node.getText(sourceFile) });
      }
      if (ts.isCallExpression(node) && expressionName(node.expression) === "RegExp") {
        regularExpressionFindings.push({ path: relativePath, ...position, kind: "constructor", detail: node.getText(sourceFile) });
      }
      if (inProductRuntime && ts.isStringLiteralLike(node)) {
        const term = node.text.toLocaleLowerCase();
        if (targetTerms.has(term)) {
          targetSpecificRuntimeFindings.push({ path: relativePath, ...position, kind: "target_literal", detail: node.text });
        }
        if (phaseThreeTerms.has(term)) {
          phaseThreeProductFindings.push({ path: relativePath, ...position, kind: "phase_three_literal", detail: node.text });
        }
      }
      if (inProductRuntime && (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node)) && conditionContainsTarget(node)) {
        targetSpecificRuntimeFindings.push({ path: relativePath, ...position, kind: "target_condition", detail: node.getText(sourceFile) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    policy: "AST scan only. It detects regular-expression literals and RegExp constructor calls without executing or creating regular expressions.",
    scannedFileCount: files.length,
    scannedFiles: files.map((file) => relative(root, file)),
    regularExpressionFindings,
    targetSpecificRuntimeFindings,
    phaseThreeProductFindings,
    passed: regularExpressionFindings.length === 0 && targetSpecificRuntimeFindings.length === 0 && phaseThreeProductFindings.length === 0,
  };
  await mkdir(resolve(root, "validation", "rebuild-phase-2-2026-09-05"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ reportPath, passed: report.passed, regularExpressionFindings: regularExpressionFindings.length, targetSpecificRuntimeFindings: targetSpecificRuntimeFindings.length, phaseThreeProductFindings: phaseThreeProductFindings.length }, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
