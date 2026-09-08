import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const validationRoot = join(root, "validation", "rebuild-phase-5-2026-09-07");

function run(command: string, argumentsList: string[]): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ exitCode: code === null ? 1 : code, output }));
  });
}

function count(output: string, marker: string): number {
  return output.split("\n").filter((line) => line.trimStart().startsWith(marker)).length;
}

async function main(): Promise<void> {
  const result = await run(process.execPath, ["--test", "dist/test/product-measurements.test.js"]);
  const report = {
    command: "node --test dist/test/product-measurements.test.js",
    exitCode: result.exitCode,
    passed: count(result.output, "✔"),
    failed: count(result.output, "✖"),
    skipped: count(result.output, "↷"),
    outputSha256Source: "unit-test-output.txt",
  };
  await mkdir(validationRoot, { recursive: true });
  await writeFile(join(validationRoot, "unit-test-output.txt"), result.output, "utf8");
  await writeFile(join(validationRoot, "unit-results.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (result.exitCode !== 0 || report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
