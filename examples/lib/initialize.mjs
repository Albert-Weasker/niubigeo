import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freezeJson, hash, readJson, snapshot, writeJson } from './io.mjs';
import { plannedCalls } from './study.mjs';

export async function initialize(root, costLimitUsd) {
  if (!(costLimitUsd > 0)) throw new Error('An authorized budget is required.');
  let publishedPlan = null;
  try { publishedPlan = await readJson('examples/study-plan.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (publishedPlan) {
    if (costLimitUsd !== publishedPlan.budget.costLimitUsd) throw new Error('Budget differs from this frozen study. Create a separate reviewed study rather than modifying it.');
    const planHash = await freezeJson(join(root, 'study-plan.json'), publishedPlan);
    await freezeJson(join(root, 'provider-ledger.json'), { schemaVersion: 'phase6-cost-ledger/v1', budget: publishedPlan.budget, entries: [] });
    await freezeJson(join(root, 'results.json'), { schemaVersion: 'phase6-results/v1', studyPlanHash: planHash, phase6Status: 'blocked', preflight: [], cases: publishedPlan.cases.map(x => ({ caseId: x.id, domain: x.domain, status: 'not_run', projectId: null, recognitionRuns: [], measurementRuns: [], errors: [] })) });
    return { planHash, counts: publishedPlan.callPlan, budget: publishedPlan.budget, metadataRequests: 0, inferenceRequests: 0, mode: 'isolated_copy_of_frozen_study' };
  }
  const cases = await readJson('examples/case-inputs.json');
  const models = await readJson('examples/model-inputs.json');
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  const selected = models.map(model => {
    const row = catalog.data.find(x => x.id === model.modelId);
    if (!row || !row.supported_parameters.includes('structured_outputs')) throw new Error(`Catalog does not confirm structured output: ${model.modelId}`);
    if (model.webSearchMode === 'provider_native' && (!row.supported_parameters.includes('tools') || !(Number(row.pricing.web_search) > 0))) throw new Error(`Catalog does not confirm priced native search: ${model.modelId}`);
    return row;
  });
  const plan = {
    schemaVersion: 'release-study/v1', version: 'v0.2.0-rc.1', createdAt: new Date().toISOString(), cases,
    models, measurementModelIds: models.map(x => x.modelId), maxKeywords: 2, repetitions: 3, repeatCases: ['R02', 'R04'],
    demonstrations: { crossModel: 'R01', keyword: 'R02', citations: 'R03', repeated: 'R04' },
    protocols: { D: 'domain-recognition/v1', K: 'keyword-discovery/v1' },
    keywordRule: { version: 'observed-consensus/v1', minimumIndependentModels: 2, ordering: ['distinct_model_count_desc', 'normalized_keyword_asc'], exclusions: ['observed_identity_substring', 'no_exact_quote', 'insufficient_independent_association'], noSemanticRewriting: true },
    maxOutputTokens: 900, truncationRetryMaxOutputTokens: 2000, providerRetryLimit: 0, applicationTruncationRetries: 1, concurrency: 1,
    scheduleRule: { frequency: 'custom', timezone: 'UTC', cron: '0 * * * * *' },
    preflight: { domain: 'vercel.com', language: 'en', order: [models[0].modelId, models[2].modelId, models[1].modelId], stopOnFirstEngineeringFailure: true },
    budget: { costLimitUsd, requestLimit: 1, authorization: 'User authorized this phase with a cumulative USD 2 cap; no separate request limit.', unknownCost: 'stop_new_calls', inFlightReservation: 'full_context_window_for_native_search; prompt_bytes_plus_schema_overhead_offline', scope: 'all_preflight_main_failures_retries_and_search_this_phase' },
    classificationNotSentToModels: true,
  };
  const counts = plannedCalls(plan, cases);
  plan.budget.requestLimit = counts.maximumCallsIncludingTruncationRetries + plan.preflight.order.length * 2;
  plan.callPlan = counts;
  plan.pricing = selected;
  const before = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain=v1', '-uall'], { encoding: 'utf8' }),
    source: await snapshot('.', ['src', 'test', 'examples/lib']),
    userData: await snapshot('.', ['data']),
    note: 'All changes visible at this snapshot include preexisting work; phase 6 attribution requires diff against this snapshot.'
  };
  await freezeJson(join(root, 'initial-inventory.json'), before);
  const planHash = await freezeJson(join(root, 'study-plan.json'), plan);
  await freezeJson('examples/study-plan.json', plan);
  await writeJson(join(root, 'provider-ledger.json'), { schemaVersion: 'phase6-cost-ledger/v1', budget: plan.budget, entries: [] });
  await writeJson(join(root, 'results.json'), { schemaVersion: 'phase6-results/v1', studyPlanHash: planHash, phase6Status: 'blocked', preflight: [], cases: cases.map(x => ({ caseId: x.id, domain: x.domain, status: 'not_run', projectId: null, recognitionRuns: [], measurementRuns: [], errors: [] })) });
  for (const item of cases) {
    await freezeJson(join('examples/cases', item.id, 'case.json'), { ...item, studyPlan: '../../study-plan.json', evidenceIndex: './evidence-index.json' });
  }
  return { planHash, counts, budget: plan.budget, metadataRequests: 1, inferenceRequests: 0 };
}
