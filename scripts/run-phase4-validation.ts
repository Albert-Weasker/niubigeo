import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const validationRoot = join(process.cwd(), "validation", "rebuild-phase-4-2026-09-07");
const outputRoot = join(validationRoot, "test-output");

type Execution = {
  id: string;
  command: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
  stdoutSha256: string;
  stderrSha256: string;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function execute(id: string, command: string, args: string[]): Promise<Execution> {
  const startedAt = new Date().toISOString();
  const child = spawn(command, args, { cwd: process.cwd(), env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    process.stderr.write(chunk);
  });
  const exitCode = await new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  const stdoutPath = join(outputRoot, `${id}.stdout.txt`);
  const stderrPath = join(outputRoot, `${id}.stderr.txt`);
  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");
  return {
    id,
    command: [command, ...args].join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    stdoutPath,
    stderrPath,
    stdoutSha256: digest(stdout),
    stderrSha256: digest(stderr),
  };
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const executions: Execution[] = [];
  executions.push(await execute("real-provider-derived-report", "npx", ["tsx", "scripts/prepare-phase4-real-report.ts"]));
  executions.push(await execute("npm-test", "npm", ["test"]));
  executions.push(await execute("phase1-browser", "npm", ["run", "test:phase1-browser"]));
  executions.push(await execute("phase2-browser", "npm", ["run", "test:phase2-browser"]));
  executions.push(await execute("phase3-browser", "npm", ["run", "test:phase3-browser"]));
  executions.push(await execute("phase4-browser", "npm", ["run", "test:phase4-browser"]));
  executions.push(await execute("freeze-integrity", "npm", ["run", "verify:phase4-freeze"]));
  await writeFile(join(validationRoot, "test-executions.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), executions }, null, 2)}\n`, "utf8");
  if (executions.some((entry) => entry.exitCode !== 0)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
