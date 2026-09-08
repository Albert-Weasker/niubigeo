import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProductClient } from './client.mjs';
import { freezeJson, hash, readJson, snapshot, writeJson } from './io.mjs';
import { keywordManifest, preflightReview, verifyFrozen, validatePlan } from './study.mjs';

async function recognition(client, path, key, modelIds) {
  const started = await client.request(`${path}/recognition-runs`, 'POST', { modelIds }, key);
  const detail = await client.wait(`${path}/recognition-runs/${started.run.id}`);
  const models = [];
  for (const model of detail.modelRuns) models.push(await client.request(`${path}/recognition-runs/${detail.run.id}/model-runs/${model.id}`));
  let report = null; let reportError = null;
  try { report = (await client.request(`${path}/recognition-runs/${detail.run.id}/reports`, 'POST', {})).report; } catch (error) { reportError = error.message; }
  return { ...detail, models, report, reportError };
}

async function project(client, domain, language, models) {
  const { project } = await client.request('/api/projects', 'POST', { domain, defaultLanguage: language });
  const path = `/api/projects/${project.id}`;
  await client.request(`${path}/models`, 'PUT', { selections: models });
  const { baseline } = await client.request(`${path}/baselines`, 'POST', {});
  return { project, baseline, path };
}

async function measurement(client, path, key, plan) {
  const { run } = await client.request(`${path}/measurement-runs`, 'POST', { idempotencyKey: key, modelIds: plan.measurementModelIds, budget: { requestLimit: plan.models.length * (1 + plan.maxKeywords), costLimitUsd: plan.budget.costLimitUsd } });
  return collectMeasurement(client, path, run.id);
}

async function collectMeasurement(client, path, runId) {
  const detail = await client.wait(`${path}/measurement-runs/${runId}`);
  const probes = [];
  for (const model of detail.modelRuns) for (const probeId of model.probeRunIds) probes.push(await client.request(`${path}/measurement-runs/${runId}/model-runs/${model.id}/probes/${probeId}`));
  return { ...detail, probes };
}

export async function executeStudy({ root, command, caseId, execution, budgetUsd }) {
  if (execution !== 'live') throw new Error('Live execution is disabled; use --execution live explicitly.');
  const planPath = join(root, 'study-plan.json');
  const plan = validatePlan(await readJson(planPath));
  if (budgetUsd !== plan.budget.costLimitUsd) throw new Error('The requested budget differs from the frozen authorization.');
  const resultsPath = join(root, 'results.json');
  const results = await readJson(resultsPath);
  await verifyFrozen(planPath, results.studyPlanHash);
  const frozenPaths = ['src', 'test', 'e2e', 'scripts', 'website', 'examples/lib', 'examples/cli.mjs', 'examples/case-inputs.json', 'examples/model-inputs.json', 'examples/study-plan.json', 'package.json', 'package-lock.json', 'Dockerfile', 'docker-compose.yml', '.dockerignore', '.github'];
  const freeze = await snapshot('.', frozenPaths);
  const cycle = `${command}-${Date.now()}`;
  await freezeJson(join(root, 'cycles', `${cycle}-before.json`), { planHash: results.studyPlanHash, code: freeze });
  const { productSession } = await import('./product-session.ts');
  const session = await productSession(root, plan);
  const client = new ProductClient(session.baseUrl);
  let gateFailure = null;
  try {
    if (command === 'preflight') {
      results.preflightReview = results.preflight.map(run => ({ runId: run.run.id, originalGatePassed: run.gatePassed, ...preflightReview(run) }));
      if (results.preflightReview.some(review => !review.passed)) throw new Error('An archived preflight has an engineering failure. No model is rerun automatically.');
      const remaining = plan.preflight.order.filter(modelId => !results.preflight.some(run => run.modelId === modelId));
      await writeJson(resultsPath, results);
      if (!remaining.length) return results;
      const selection = plan.models.map(x => ({ ...x }));
      const created = await project(client, plan.preflight.domain, plan.preflight.language, selection);
      for (const modelId of remaining) {
        const run = await recognition(client, created.path, `${results.studyPlanHash}:preflight:${modelId}`, [modelId]);
        const review = preflightReview(run);
        results.preflight.push({ modelId, projectId: created.project.id, ...run, gatePassed: review.passed });
        results.preflightReview.push({ runId: run.run.id, originalGatePassed: review.passed, ...review });
        await writeJson(resultsPath, results);
        if (!review.passed) { gateFailure = `Preflight gate failed for ${modelId}. No further inference calls are allowed in this cycle.`; break; }
      }
      // Preflight records remain archived but cannot collide with the main case domain.
      await client.request(created.path, 'DELETE');
    } else {
      if (results.preflight.length !== plan.preflight.order.length || results.preflight.some(x => !preflightReview(x).passed)) throw new Error('Preflight gates have not passed.');
      const selected = plan.cases.filter(x => !caseId || x.id === caseId);
      if (!selected.length) throw new Error('Case ID is not present in the frozen plan.');
      for (const input of selected) {
        const state = results.cases.find(x => x.caseId === input.id);
        if (state.status !== 'not_run') continue;
        const created = await project(client, input.domain, input.language, plan.models);
        state.projectId = created.project.id; state.baseline = created.baseline; state.status = 'running';
        await writeJson(resultsPath, results);
        try {
          const run = await recognition(client, created.path, `${results.studyPlanHash}:${input.id}:recognition`, plan.models.map(x => x.modelId));
          state.recognitionRuns.push(run);
          await writeJson(resultsPath, results);
          const { suggestion } = await client.request(`${created.path}/watch-sets/suggestion`);
          const keywords = keywordManifest(input, run.models, suggestion, plan);
          const keywordPath = join(root, 'keyword-manifests', `${input.id}.json`);
          state.keywordManifestHash = await freezeJson(keywordPath, keywords);
          state.keywords = keywords;
          const { watchSet } = await client.request(`${created.path}/watch-sets`, 'POST', { objectIds: [suggestion.target.id], keywordIds: keywords.selected.map(x => x.id), repetitions: 1 });
          await client.request(`${created.path}/watch-sets/${watchSet.id}/confirm`, 'POST', {});
          state.watchSet = watchSet;
          state.measurementRuns.push(await measurement(client, created.path, `${results.studyPlanHash}:${input.id}:measurement:1`, plan));
          await writeJson(resultsPath, results);
          if (plan.repeatCases.includes(input.id)) {
            state.measurementRuns.push(await measurement(client, created.path, `${results.studyPlanHash}:${input.id}:measurement:2`, plan));
            const { task } = await client.request(`${created.path}/monitoring-tasks`, 'POST', { name: `${input.id} release validation`, rule: plan.scheduleRule, modelScope: plan.measurementModelIds });
            state.schedule = { task, occurrences: [] };
            await writeJson(resultsPath, results);
            try {
              while (Date.now() < Date.parse(task.nextRunAt)) await new Promise(resolve => setTimeout(resolve, Math.min(1000, Date.parse(task.nextRunAt) - Date.now())));
              const due = await client.request('/api/scheduler/due', 'POST', {});
              state.schedule.occurrences = due.occurrences;
              const occurrence = due.occurrences.find(x => x.taskId === task.id);
              if (!occurrence?.runId) throw new Error('Due scheduler did not produce a run.');
              // Pause before polling so a subsequent minute cannot create another paid occurrence.
              await client.request(`${created.path}/monitoring-tasks/${task.id}/pause`, 'POST', {});
              state.measurementRuns.push(await collectMeasurement(client, created.path, occurrence.runId));
              await client.request('/api/scheduler/due', 'POST', {});
              state.schedule.occurrences = (await client.request(`${created.path}/monitoring-tasks/${task.id}/occurrences`)).occurrences;
            } finally { await client.request(`${created.path}/monitoring-tasks/${task.id}/pause`, 'POST', {}); }
          }
          state.statistics = await client.request(`${created.path}/measurement-stats`, 'POST', {});
          state.status = 'completed';
        } catch (error) { state.status = 'partial'; state.errors.push(error.message); }
        await writeJson(resultsPath, results);
        console.log(JSON.stringify({ caseId: input.id, status: state.status, recognitionRuns: state.recognitionRuns.length, measurementRuns: state.measurementRuns.length }));
        const ledger = await readJson(join(root, 'provider-ledger.json'));
        if (ledger.entries.some(x => x.status === 'unknown_cost')) { gateFailure = 'Unknown Provider cost requires reconciliation before another call.'; break; }
      }
    }
  } finally {
    await new Promise(resolve => session.server.close(resolve));
    const after = await snapshot('.', frozenPaths);
    await writeJson(join(root, 'cycles', `${cycle}-after.json`), { planHash: hash(await readFile(planPath)), code: after, unchanged: after.sha256 === freeze.sha256, gateFailure });
    if (after.sha256 !== freeze.sha256) throw new Error('Code changed during the inference cycle.');
    await verifyFrozen(planPath, results.studyPlanHash);
  }
  if (gateFailure) throw new Error(gateFailure);
  return results;
}
