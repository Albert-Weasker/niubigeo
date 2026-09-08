import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { load } from "cheerio";
import { renderWorkbenchScript } from "../src/ui/workbench-script.js";

interface Finding {
  file: string;
  line: number;
  kind: string;
}

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;
const IGNORED_DIRECTORIES = new Set([".git", "data", "dist", "node_modules", "runs", "validation"]);

function sourceFiles(root: string): string[] {
  const output: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) output.push(file);
    }
  };
  visit(root);
  return output;
}

function regularExpressionFindings(file: string, sourceText: string): Finding[] {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const visit = (node: ts.Node) => {
    let kind = "";
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) kind = "regular-expression literal";
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "RegExp") {
      kind = "RegExp constructor";
    }
    if (kind) {
      findings.push({
        file,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        kind,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

test("all first-party code contains no regular expressions", () => {
  const files = sourceFiles(".");
  const findings = files.flatMap((file) => regularExpressionFindings(file, readFileSync(file, "utf8")));
  assert.deepEqual(findings, []);
});

test("browser script contains no regular expressions", () => {
  const document = load(renderWorkbenchScript());
  const script = document("script").text();
  assert.ok(script.length > 0);
  assert.deepEqual(regularExpressionFindings("workbench-browser.js", script), []);
});

test("production semantics contain no retired local classifiers or test-target branches", () => {
  const source = sourceFiles("src").map((file) => readFileSync(file, "utf8")).join("\n");
  const retiredClassifiers = [
    "looksChinese",
    "inferPromptType",
    "textMatchesKeyword",
    "KeywordRelevanceScorer",
    "KeywordUniverseBuilder",
    "SOURCE_WEIGHT",
    "SOURCE_CONFIDENCE",
    "candidateBrandNames",
    "canonicalBrandName",
    "displayModeForIntent",
  ];
  const testTargets = [
    "NiubiStar",
    "Niubistar",
    "TrustMRR",
    "Vercel",
    "Supabase",
    "PostHog",
    "Sentry",
    "Stripe",
    "Docker",
    "Hugging Face",
    "Linear",
    "GitStar",
    "Product Hunt",
    "niubistar.com",
    "trustmrr.com",
    "vercel.com",
    "supabase.com",
    "posthog.com",
    "sentry.io",
    "stripe.com",
    "docker.com",
    "huggingface.co",
    "linear.app",
  ];
  for (const marker of retiredClassifiers) assert.equal(source.includes(marker), false, `retired local classifier found: ${marker}`);
  for (const marker of testTargets) assert.equal(source.includes(marker), false, `test-target branch found in production source: ${marker}`);
});
