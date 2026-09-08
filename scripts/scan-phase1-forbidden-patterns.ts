import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { splitLines } from "../src/utils/text.js";

type AllowlistEntry = {
  path: string;
  reason: string;
};

type Rule = {
  id: string;
  literal: string;
  description: string;
  allowlist: AllowlistEntry[];
};

type Configuration = {
  scanDirectories: string[];
  rules: Rule[];
};

type Match = {
  ruleId: string;
  literal: string;
  path: string;
  line: number;
  column: number;
  snippet: string;
  allowed: boolean;
  allowlistReason?: string | undefined;
};

const root = process.cwd();
const configPath = join(root, "validation", "rebuild-phase-1-2026-09-05", "forbidden-patterns.json");
const reportPath = join(root, "validation", "rebuild-phase-1-2026-09-05", "forbidden-patterns-report.json");
const textExtensions = new Set([".ts", ".json", ".md"]);

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

async function filesIn(path: string): Promise<string[]> {
  const absolute = resolve(root, path);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesIn(relative(root, entryPath)));
      continue;
    }
    if (entry.isFile() && textExtensions.has(extension(entry.name))) files.push(entryPath);
  }
  return files;
}

async function filesFor(paths: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const path of paths) {
    const absolute = resolve(root, path);
    const entries = await readdir(dirname(absolute), { withFileTypes: true });
    const entry = entries.find((candidate) => join(dirname(absolute), candidate.name) === absolute);
    if (!entry) continue;
    if (entry.isDirectory()) {
      for (const file of await filesIn(path)) files.add(file);
    } else if (entry.isFile() && textExtensions.has(extension(absolute))) {
      files.add(absolute);
    }
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

function allowlistReason(rule: Rule, path: string): string | undefined {
  return rule.allowlist.find((entry) => entry.path === path)?.reason;
}

async function main(): Promise<void> {
  const configuration = JSON.parse(await readFile(configPath, "utf8")) as Configuration;
  const matches: Match[] = [];
  const files = await filesFor(configuration.scanDirectories);

  for (const file of files) {
    const path = relative(root, file);
    const lines = splitLines(await readFile(file, "utf8"));
    for (const rule of configuration.rules) {
      const reason = allowlistReason(rule, path);
      for (let index = 0; index < lines.length; index += 1) {
        const column = lines[index].indexOf(rule.literal);
        if (column === -1) continue;
        matches.push({
          ruleId: rule.id,
          literal: rule.literal,
          path,
          line: index + 1,
          column: column + 1,
          snippet: lines[index].trim(),
          allowed: Boolean(reason),
          allowlistReason: reason,
        });
      }
    }
  }

  const nonAllowed = matches.filter((match) => !match.allowed);
  const report = {
    configuration: relative(root, configPath),
    scannedFiles: files.map((file) => relative(root, file)),
    rules: configuration.rules.map((rule) => ({
      id: rule.id,
      literal: rule.literal,
      description: rule.description,
      allowlist: rule.allowlist,
      matches: matches.filter((match) => match.ruleId === rule.id),
    })),
    nonAllowedHitCount: nonAllowed.length,
    nonAllowed,
    noRegularExpressionsUsed: true,
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ scannedFileCount: files.length, nonAllowedHitCount: nonAllowed.length, reportPath }, null, 2)}\n`);
  if (nonAllowed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
