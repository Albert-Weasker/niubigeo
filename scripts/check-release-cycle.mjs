import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { freezeJson, snapshot, writeJson } from '../examples/lib/io.mjs';

const root = 'validation/release-v0.2.0-rc.1';
const cycle = `local-${Date.now()}`;
const folder = join(root, 'cycles', cycle);
await mkdir(folder, { recursive: true });
const paths = ['src', 'test', 'e2e', 'scripts', 'website', 'examples/lib', 'examples/cli.mjs', 'examples/case-inputs.json', 'examples/model-inputs.json', 'examples/study-plan.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'assets/brand', 'Dockerfile', 'docker-compose.yml', '.dockerignore', '.github'];
const before = await snapshot('.', paths);
await freezeJson(join(folder, 'before.json'), before);
const commands = [
  ['npm', ['test']],
  ['npm', ['run', 'test:examples']],
  ['npm', ['run', 'examples:plan']],
  ['npm', ['run', 'examples:validate']],
];
const results = [];
for (const [command, args] of commands) {
  const output = [];
  const startedAt = new Date().toISOString();
  const process = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.on('data', value => output.push(value.toString()));
  process.stderr.on('data', value => output.push(value.toString()));
  const exitCode = await new Promise((resolve, reject) => { process.on('error', reject); process.on('close', resolve); });
  const text = output.join('');
  const log = `${results.length + 1}.log`;
  await writeFile(join(folder, log), text);
  const counts = {};
  for (const line of text.split('\n')) {
    for (const key of ['tests', 'pass', 'fail', 'skipped', 'cancelled']) {
      for (const prefix of [`# ${key} `, `ℹ ${key} `]) if (line.startsWith(prefix)) counts[key] = Number(line.slice(prefix.length));
    }
  }
  const result = { command: [command, ...args], startedAt, finishedAt: new Date().toISOString(), exitCode, log, counts };
  results.push(result);
  console.log(JSON.stringify(result));
}
const after = await snapshot('.', paths);
await writeJson(join(folder, 'after.json'), after);
const report = { cycle, beforeHash: before.sha256, afterHash: after.sha256, unchanged: before.sha256 === after.sha256, fileCount: before.fileCount, results, passed: before.sha256 === after.sha256 && results.every(x => x.exitCode === 0) };
await writeJson(join(folder, 'report.json'), report);
console.log(JSON.stringify({ cycle, passed: report.passed, unchanged: report.unchanged, path: join(folder, 'report.json') }));
if (!report.passed) process.exitCode = 1;
