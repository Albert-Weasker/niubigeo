import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

type FrozenFile = {
  path: string;
  sha256: string;
};

type FreezeManifest = {
  phase: string;
  createdAt: string;
  files: FrozenFile[];
};

const root = process.cwd();
const outputDirectory = resolve(root, "validation", "rebuild-phase-2-2026-09-05");
const manifestPath = join(outputDirectory, "frozen-validation-manifest.json");
const integrityPath = join(outputDirectory, "post-test-integrity.json");
const roots = ["src", "test", "e2e", "scripts"];
const extensions = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]);
const explicitFiles = ["package.json", "package-lock.json", "playwright.config.ts", "playwright.phase2.config.ts"];

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

async function collect(directory: string): Promise<string[]> {
  const absolute = resolve(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collect(relative(root, candidate)));
      continue;
    }
    if (entry.isFile() && extensions.has(extension(entry.name))) files.push(candidate);
  }
  return files;
}

async function digest(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function currentFiles(): Promise<FrozenFile[]> {
  const collected = (await Promise.all(roots.map((directory) => collect(directory)))).flat();
  for (const file of explicitFiles) collected.push(resolve(root, file));
  const unique = [...new Set(collected)].sort((left, right) => left.localeCompare(right));
  return Promise.all(unique.map(async (file) => ({ path: relative(root, file), sha256: await digest(file) })));
}

async function freeze(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const manifest: FreezeManifest = { phase: "phase-2", createdAt: new Date().toISOString(), files: await currentFiles() };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ manifestPath, fileCount: manifest.files.length }, null, 2)}\n`);
}

async function verify(): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FreezeManifest;
  const current = new Map((await currentFiles()).map((file) => [file.path, file.sha256]));
  const mismatches = manifest.files.filter((file) => current.get(file.path) !== file.sha256);
  const additions = [...current.keys()].filter((path) => !manifest.files.some((file) => file.path === path));
  const report = {
    phase: "phase-2",
    verifiedAt: new Date().toISOString(),
    manifestPath: relative(root, manifestPath),
    frozenFileCount: manifest.files.length,
    mismatchCount: mismatches.length,
    addedFileCount: additions.length,
    mismatches,
    additions,
    passed: mismatches.length === 0 && additions.length === 0,
  };
  await writeFile(integrityPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

const action = process.argv[2];
if (action === "freeze") freeze().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`); process.exitCode = 1; });
else if (action === "verify") verify().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`); process.exitCode = 1; });
else {
  process.stderr.write("Choose freeze or verify.\n");
  process.exitCode = 1;
}
