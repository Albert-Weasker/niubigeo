import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { argumentsMap, hash, readJson } from './lib/io.mjs';
import { plannedCalls, readCases, validatePlan } from './lib/study.mjs';

export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  const options = argumentsMap(rest);
  const root = options['--root'] || 'validation/release-v0.2.0-rc.1';
  if (command === 'init') {
    const { initialize } = await import('./lib/initialize.mjs');
    return initialize(root, Number(options['--budget-usd']));
  }
  if (command === 'plan') {
    const plan = validatePlan(await readJson(options['--manifest'] || 'examples/study-plan.json'));
    const cases = (await readCases()).filter(x => !options['--case'] || x.id === options['--case']);
    if (!cases.length) throw new Error('Unknown case ID.');
    return { execution: 'plan_only', inferenceCalls: 0, cases, models: plan.models, calls: plannedCalls(plan, cases), budget: plan.budget };
  }
  if (command === 'validate') {
    const cases = await readCases();
    if (cases.length !== 20) throw new Error('Exactly twenty cases are required.');
    for (let i = 0; i < cases.length; i++) {
      const input = cases[i];
      if (input.id !== `R${String(i + 1).padStart(2, '0')}`) throw new Error('Case IDs must be R01 through R20.');
      const index = await readJson(join('examples/cases', input.id, 'evidence-index.json'));
      const content = await readFile(join('examples/cases', input.id, index.path));
      if (hash(content) !== index.sha256) throw new Error(`Evidence hash mismatch: ${input.id}`);
      for (const language of ['README.md', 'README.zh-CN.md']) await readFile(join('examples/cases', input.id, language));
    }
    return { cases: cases.length, evidenceHashesVerified: cases.length, inferenceCalls: 0 };
  }
  if (command === 'replay') {
    if (!options['--evidence']) throw new Error('--evidence is required.');
    const evidence = await readJson(options['--evidence']);
    if (evidence.schemaVersion !== 'public-case-evidence/v1' || evidence.caseId !== options['--case']) throw new Error('Evidence case or schema mismatch.');
    const { summarizeCase } = await import('./lib/export.mjs');
    return { label: 'Archived result replay / 已归档结果回放', inferenceCalls: 0, summary: summarizeCase(evidence.state) };
  }
  if (command === 'export') {
    const { exportCases } = await import('./lib/export.mjs');
    return exportCases(root);
  }
  if (command === 'run' || command === 'preflight') {
    const { executeStudy } = await import('./lib/run.mjs');
    const result = await executeStudy({ root, command, caseId: options['--case'], execution: options['--execution'], budgetUsd: Number(options['--budget-usd']) });
    return { status: 'execution_finished', cases: result.cases.map(x => ({ id: x.caseId, status: x.status })) };
  }
  throw new Error('Commands: init, plan, validate, replay, export, preflight, run.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
