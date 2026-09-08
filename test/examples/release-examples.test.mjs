import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hash, freezeJson, readJson, writeJson } from '../../examples/lib/io.mjs';
import { atPayloadPath, assertCitation, plannedCalls, preflightReview, readCases, verifyFrozen } from '../../examples/lib/study.mjs';
import { costReservation, StudyBudgetExecutor } from '../../examples/lib/budget.mjs';
import { ProductClient } from '../../examples/lib/client.mjs';
import { main } from '../../examples/cli.mjs';
import { caseMarkdown, publicScreenshot, readCaseArchiveContext, summarizeCase } from '../../examples/lib/export.mjs';

test('public screenshots retain a trace hash without publishing the private filesystem path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'private-trace-test-'));
  const trace = join(root, 'trace.json');
  try {
    await writeJson(trace, { fixture: 'trace metadata test, not a browser recording' });
    const input = { path: 'assets/screenshots/example.png', trace };
    const output = await publicScreenshot(input);
    assert.equal(input.trace, trace);
    assert.equal(output.trace.sha256, hash(await readFile(trace)));
    assert.equal(output.trace.publicUrl, null);
    assert.equal(output.trace.status, 'private_archive');
    assert.equal(JSON.stringify(output).includes(root), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('initializing a fresh local root preserves the published manifest without a network call', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-init-'));
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Frozen initialization must stay offline.'); };
  const before = hash(await readFile('examples/study-plan.json'));
  try {
    const result = await main(['init', '--root', root, '--budget-usd', '2']);
    assert.equal(result.inferenceRequests, 0);
    assert.equal(result.metadataRequests, 0);
    assert.equal(hash(await readFile(join(root, 'study-plan.json'))), before);
    assert.equal(hash(await readFile('examples/study-plan.json')), before);
    await assert.rejects(() => main(['init', '--root', root, '--budget-usd', '2']));
  } finally { globalThis.fetch = previous; await rm(root, { recursive: true, force: true }); }
});

test('release input has exactly twenty independent domain configurations', async () => {
  const cases = await readCases();
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map(x => x.domain)).size, 20);
  for (let i = 0; i < cases.length; i++) assert.equal(cases[i].id, `R${String(i + 1).padStart(2, '0')}`);
});

test('actual product combined D/K calls and repeat cycles are included in the plan', () => {
  const cases = Array.from({ length: 20 }, (_, i) => ({ id: String(i) }));
  const result = plannedCalls({ models: [{}, {}, {}], maxKeywords: 2, repetitions: 3, repeatCases: ['1', '3'] }, cases);
  assert.equal(result.recognition, 60);
  assert.equal(result.measurement, 216);
  assert.equal(result.maximumCallsIncludingTruncationRetries, 336);
});

test('result writes cannot mutate an existing frozen input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-freeze-'));
  try {
    const path = join(root, 'plan.json');
    const digest = await freezeJson(path, { input: 'example.test' });
    await assert.rejects(() => freezeJson(path, { input: 'another.test' }));
    await writeJson(join(root, 'results.json'), { status: 'failed' });
    await verifyFrozen(path, digest);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('provider citations require exact payload provenance and an online attempt', () => {
  const response = { choices: [{ message: { annotations: [{ url_citation: { url: 'https://example.test/path' } }] } }] };
  const path = 'choices[0].message.annotations[0].url_citation.url';
  assert.equal(atPayloadPath(response, path), 'https://example.test/path');
  const citation = { id: 'citation', url: 'https://example.test/path', providerPayloadPath: path, providerCitationSource: 'provider_annotation' };
  assert.equal(assertCitation(citation, { rawProviderResponse: response, requestParameters: { webSearchEnabled: true } }), 'provider_citation');
  assert.throws(() => assertCitation(citation, { rawProviderResponse: response, requestParameters: { webSearchEnabled: false } }));
  assert.throws(() => assertCitation({ ...citation, url: 'https://other.test' }, { rawProviderResponse: response, requestParameters: { webSearchEnabled: true } }));
  assert.equal(assertCitation({ ...citation, providerCitationSource: 'provider_search_result' }, { rawProviderResponse: response, requestParameters: { webSearchEnabled: true } }), 'retrieval_result');
});

test('reading a case and disabling live never invoke fetch', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network must not be called.'); };
  try {
    const plan = await main(['plan', '--case', 'R02']);
    assert.equal(plan.inferenceCalls, 0);
    await assert.rejects(() => main(['run']), error => error.message.includes('disabled'));
    const valid = await main(['validate']);
    assert.equal(valid.evidenceHashesVerified, 20);
  } finally { globalThis.fetch = previous; }
});

test('example clients reject nonlocal product environments', () => {
  assert.throws(() => new ProductClient('https://example.com'));
  assert.ok(new ProductClient('http://127.0.0.1:10001'));
});

test('unrun cases cannot turn into valid answers or plotted measurements', () => {
  const summary = summarizeCase({ caseId: 'sample', recognitionRuns: [], measurementRuns: [], errors: [] });
  assert.equal(summary.status, 'not_run');
  assert.equal(summary.d.valid, 0);
  assert.equal(summary.initialD.attempted, 0);
  assert.equal(summary.measurementD.attempted, 0);
  assert.equal(summary.k.valid, 0);
  assert.deepEqual(summary.screenshots, []);
});

function initialModel() {
  return {
    modelRun: { id: 'initial-model', status: 'completed', currentAttemptId: 'initial-attempt', modelSnapshot: { modelId: 'provider/model', displayName: 'Fixture model', webSearchMode: 'off' } },
    attempts: [{ id: 'initial-attempt', status: 'unknown', rawAnswer: 'The domain is not recognized.', startedAt: '2026-01-01T00:00:00Z', providerSearch: { executionMode: 'unverified' } }],
    archive: { result: { attemptId: 'initial-attempt', analysisStatus: 'unknown', domainRecognition: 'not_recognized', unknowns: [] }, brandKeywords: [], competitors: [], providerCitations: [], answerMentionedUrls: [] },
    presentation: { localAnalysis: 'complete' },
  };
}

function measurementProbe(kind = 'keyword_discovery') {
  const id = kind === 'keyword_discovery' ? 'keyword-probe' : 'domain-probe';
  const attemptId = `${id}-first`;
  const result = { attemptId, analysisStatus: 'completed', mentionJudgment: 'adjudicable', recommendationJudgment: 'adjudicable', firstMentionJudgment: 'adjudicable', firstRecommendationJudgment: 'adjudicable', unknowns: [] };
  return {
    probe: { id, kind, runId: 'measurement-run', modelRunId: 'measurement-model', keywordId: kind === 'keyword_discovery' ? 'keyword-id' : null, firstAttemptId: attemptId, latestAttemptId: attemptId, status: 'completed', fingerprint: { modelId: 'provider/model', webSearchMode: 'off' } },
    attempts: [{ id: attemptId, attemptNumber: 1, status: 'completed', rawAnswer: 'Archived fixture answer.', startedAt: '2026-01-01T00:01:00Z', requestParameters: { webSearchMode: 'off', webSearchEnabled: false }, providerSearch: { used: false, executionMode: 'unverified' } }],
    ...(kind === 'keyword_discovery' ? { keywordResult: result } : { domainResult: { attemptId, analysisStatus: 'unknown', domainRecognition: 'not_recognized' } }),
    mentions: [], evidence: { providerCitations: [], answerMentionedUrls: [] },
  };
}

function completedCase(probes = [measurementProbe('target_domain'), measurementProbe()]) {
  return {
    caseId: 'fixture', projectId: 'project', status: 'completed', errors: [],
    recognitionRuns: [{ run: { id: 'initial-run', status: 'completed', plannedModelRunCount: 1 }, models: [initialModel()], report: { id: 'report' }, reportError: null }],
    measurementRuns: [{ run: { id: 'measurement-run', status: 'completed', plannedProbeCount: probes.length }, probes }],
    keywords: { caseId: 'fixture', selected: [{ id: 'keyword-id', keyword: 'Neutral category' }] },
    watchSet: { keywords: [{ id: 'keyword-id', keyword: 'Watched category' }] },
  };
}

const markdownInput = { id: 'fixture', domain: 'example.test', language: 'en' };
const markdownPlan = { protocols: { D: 'domain-recognition/v1', K: 'keyword-discovery/v1' }, models: [{ modelId: 'provider/model', webSearchMode: 'off' }] };
function renderCase(state, language = 'en', screenshots = [], context = {}) {
  return caseMarkdown(markdownInput, summarizeCase(state, context), state, language, markdownPlan, 'evidence-hash', screenshots, context);
}

test('initial D, measurement D and domain claims keep their distinct meanings', () => {
  const state = completedCase();
  state.recognitionRuns[0].models[0].attempts.push({ id: 'other-attempt', status: 'completed', rawAnswer: 'Later answer.', providerSearch: { executionMode: 'sdk' } });
  const summary = summarizeCase(state);
  assert.equal(summary.status, 'completed');
  assert.equal(summary.initialD.attempted, 1);
  assert.equal(summary.initialD.valid, 1);
  assert.equal(summary.measurementD.attempted, 1);
  assert.equal(summary.measurementD.valid, 1);
  assert.equal(summary.d.attempted, 2);
  assert.equal(summary.d.valid, 2);
  assert.equal(summary.initialD.models[0].analysisStatus, 'unknown');
  assert.equal(summary.initialD.models[0].localAnalysis, 'complete');
  assert.equal(summary.initialD.models[0].domainRecognition, 'not_recognized');
  assert.equal(summary.initialD.models[0].executionMode, 'unverified');
  assert.equal(summary.measurementD.models[0].localAnalysis, null);
  assert.equal(summary.d.isMetricDenominator, false);
  assert.ok(summary.observation.en.includes('Initial D: 1/1'));
  assert.ok(summary.observation.en.includes('Measurement D: 1/1'));
});

test('partial runs, failed attempts and report failures cannot export as completed', () => {
  const state = completedCase();
  state.measurementRuns[0].run.status = 'partial';
  const failed = state.measurementRuns[0].probes[1];
  failed.probe.status = 'failed';
  failed.attempts[0].status = 'analysis_failed';
  failed.attempts[0].errorMessage = 'Unterminated string in JSON';
  failed.keywordResult.analysisStatus = 'analysis_failed';
  assert.equal(summarizeCase(state).status, 'partial');
  assert.equal(summarizeCase(state).k.valid, 0);
  const markdown = renderCase(state);
  assert.ok(markdown.includes('Unterminated string in JSON'));
  assert.ok(markdown.includes('Run measurement-run: partial'));
  assert.ok(markdown.includes('Archived fixture answer.'));
  for (const status of ['running', 'partial', 'failed']) {
    const current = completedCase();
    current.status = status;
    assert.notEqual(summarizeCase(current).status, 'completed');
  }
  const reportFailure = completedCase();
  reportFailure.recognitionRuns[0].reportError = 'Report unavailable';
  assert.equal(summarizeCase(reportFailure).status, 'partial');
  const missingProbe = completedCase();
  missingProbe.measurementRuns[0].run.plannedProbeCount++;
  assert.equal(summarizeCase(missingProbe).status, 'partial');
  const noAnswers = completedCase([]);
  noAnswers.recognitionRuns[0].models[0].attempts[0] = { id: 'initial-attempt', status: 'provider_failed', errorMessage: 'Request rejected' };
  noAnswers.recognitionRuns[0].models[0].archive = null;
  assert.equal(summarizeCase(noAnswers).status, 'failed');
  assert.ok(renderCase(noAnswers).includes('Competitors are unavailable without an analysis result.'));
});

test('K coverage selects firstAttemptId and never claims a product metric denominator', () => {
  const probe = measurementProbe();
  const original = probe.attempts[0];
  original.status = 'analysis_failed';
  const retry = { ...original, id: 'retry', attemptNumber: 2, status: 'completed', rawAnswer: 'Recovered answer.' };
  probe.attempts = [retry, original];
  probe.probe.latestAttemptId = retry.id;
  probe.keywordResult.attemptId = retry.id;
  const state = completedCase([probe]);
  const summary = summarizeCase(state);
  assert.equal(summary.k.valid, 0);
  assert.equal(summary.k.basis, 'first_attempt_analyzable_answer');
  assert.equal(summary.k.isMetricDenominator, false);
  assert.equal(summary.status, 'partial');
  const markdown = renderCase(state);
  assert.ok(markdown.includes('The derived result belongs to a later attempt'));
  assert.ok(markdown.includes('Recovered answer.'));
  assert.ok(markdown.includes('Archived fixture answer.'));
  const unknown = measurementProbe();
  unknown.keywordResult.analysisStatus = 'unknown';
  unknown.keywordResult.mentionJudgment = 'unknown';
  const unknownState = completedCase([unknown]);
  assert.equal(summarizeCase(unknownState).k.valid, 1);
  assert.ok(renderCase(unknownState).includes('mentionJudgment: unknown'));
  assert.ok(renderCase(unknownState).includes('not product metric denominators'));
  delete unknown.probe.firstAttemptId;
  assert.equal(summarizeCase(unknownState).k.valid, 0);
});

test('K uses frozen keyword IDs and shows raw attempts with separate source provenance', () => {
  const probe = measurementProbe();
  const attempt = probe.attempts[0];
  attempt.rawAnswer = 'Original <answer> with https://body.example.test/page';
  attempt.requestParameters = { webSearchMode: 'provider_native', webSearchEnabled: true };
  attempt.providerSearch = { used: true, executionMode: 'sdk' };
  attempt.rawProviderResponse = { citations: [{ url: 'https://citation.example.test/page' }], search_results: [{ url: 'https://retrieval.example.test/page' }], choices: [{ finish_reason: 'stop' }] };
  probe.evidence = {
    providerCitations: [
      { id: 'citation', attemptId: attempt.id, title: 'Cited source', url: 'https://citation.example.test/page', providerPayloadPath: 'citations[0].url', providerCitationSource: 'provider_annotation' },
      { id: 'retrieval', attemptId: attempt.id, title: 'Retrieved source', url: 'https://retrieval.example.test/page', providerPayloadPath: 'search_results[0].url', providerCitationSource: 'provider_search_result' },
    ],
    answerMentionedUrls: [{ id: 'body-url', attemptId: attempt.id, url: 'https://body.example.test/page' }],
  };
  const state = completedCase([probe]);
  assert.equal(probe.probe.keyword, undefined);
  const markdown = renderCase(state);
  assert.ok(markdown.includes('### Neutral category · provider/model'));
  assert.ok(markdown.includes('Original &lt;answer&gt; with https://body.example.test/page'));
  assert.ok(markdown.includes(hash(attempt.rawAnswer)));
  assert.ok(markdown.includes('executionMode: sdk'));
  assert.ok(markdown.includes('finish_reason: stop'));
  const keywordSection = markdown.slice(markdown.indexOf('### Neutral category'));
  const providerSection = keywordSection.slice(keywordSection.indexOf('#### Provider citations'), keywordSection.indexOf('#### Search retrieval results'));
  const retrievalSection = keywordSection.slice(keywordSection.indexOf('#### Search retrieval results'), keywordSection.indexOf('#### Links in the answer'));
  assert.ok(providerSection.includes('https://citation.example.test/page'));
  assert.equal(providerSection.includes('https://body.example.test/page'), false);
  assert.equal(providerSection.includes('https://retrieval.example.test/page'), false);
  assert.ok(retrievalSection.includes('https://retrieval.example.test/page'));
  assert.ok(keywordSection.includes('#### Links in the answer (not Provider citations)'));
  probe.evidence.providerCitations.push({ id: 'answer-source', attemptId: attempt.id, url: 'https://body.example.test/another', providerCitationSource: 'answer_text_url' });
  const withAnswerSource = renderCase(state).slice(markdown.indexOf('### Neutral category'));
  const providerOnly = withAnswerSource.slice(withAnswerSource.indexOf('#### Provider citations'), withAnswerSource.indexOf('#### Search retrieval results'));
  assert.equal(providerOnly.includes('https://body.example.test/another'), false);
  const answerLinks = withAnswerSource.slice(withAnswerSource.indexOf('#### Links in the answer'));
  assert.ok(answerLinks.includes('https://body.example.test/another'));
  state.keywords.selected = [];
  assert.ok(renderCase(state).includes('### Watched category'));
  state.watchSet.keywords = [];
  assert.ok(renderCase(state).includes('Frozen keyword unavailable'));
  const context = { keywordManifest: { selected: [{ id: 'keyword-id', keyword: 'Frozen file category' }] } };
  assert.ok(renderCase(state, 'en', [], context).includes('### Frozen file category'));
  probe.evidence.providerCitations[0].url = 'https://different.example.test';
  assert.throws(() => renderCase(state), error => error.message.includes('differs from payload'));
});

test('screenshot alt and caption objects are selected by document language', () => {
  const state = completedCase();
  const shots = [{ path: 'assets/screenshots/fixture.png', alt: { en: 'English alt', zh: '中文替代文本' }, caption: { en: 'English caption', zh: '中文图注' } }];
  const en = renderCase(state, 'en', shots);
  const zh = renderCase(state, 'zh', shots);
  assert.ok(en.includes('![English alt]'));
  assert.ok(en.includes('English caption'));
  assert.equal(en.includes('中文图注'), false);
  assert.ok(zh.includes('![中文替代文本]'));
  assert.ok(zh.includes('中文图注'));
  assert.equal(zh.includes('[object Object]'), false);
  shots[0].caption = 'Shared caption';
  assert.ok(renderCase(state, 'zh', shots).includes('Shared caption'));
  delete shots[0].alt.zh;
  shots[0].caption = {};
  assert.ok(renderCase(state, 'zh', shots).includes('![fixture 产品截图]'));
});

test('final task and frozen keyword archives supplement results without mutation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-export-archives-'));
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Archive reads must stay offline.'); };
  try {
    const state = completedCase();
    state.schedule = { task: { id: 'task', projectId: 'project', status: 'active', nextRunAt: '2026-01-01T00:02:00Z' }, occurrences: [{ id: 'occurrence', status: 'completed', reason: 'run_partial_or_failed', runId: 'measurement-run' }] };
    const manifest = { caseId: state.caseId, selected: [{ id: 'keyword-id', keyword: 'Archived category' }] };
    state.keywordManifestHash = await freezeJson(join(root, 'keyword-manifests', `${state.caseId}.json`), manifest);
    const finalTask = { ...state.schedule.task, status: 'paused', nextRunAt: null, updatedAt: '2026-01-01T00:03:00Z' };
    const taskPath = join(root, 'product-data/projects/project/schedules/tasks/task.json');
    await writeJson(taskPath, finalTask);
    const resultsPath = join(root, 'results.json');
    await writeJson(resultsPath, { cases: [state] });
    const before = await readFile(resultsPath);
    const original = JSON.stringify(state);
    const context = await readCaseArchiveContext(root, state);
    assert.equal(JSON.stringify(state), original);
    assert.equal(hash(await readFile(resultsPath)), hash(before));
    assert.equal(context.schedule.taskAtCollection.status, 'active');
    assert.equal(context.schedule.finalTask.status, 'paused');
    assert.equal(context.schedule.finalTask.nextRunAt, null);
    assert.equal(context.schedule.finalTaskSource.sha256, hash(await readFile(taskPath)));
    assert.deepEqual(context.keywordManifest, manifest);
    assert.equal(summarizeCase(state, context).status, 'partial');
    const markdown = renderCase(state, 'en', [], context);
    assert.ok(markdown.includes('Task status at collection (historical snapshot): active'));
    assert.ok(markdown.includes('Final archived task status: paused'));
    assert.ok(markdown.includes('run_partial_or_failed'));
    assert.ok(markdown.includes('### Archived category'));
    await rm(taskPath);
    const missing = await readCaseArchiveContext(root, state);
    assert.equal(missing.schedule.finalTask, null);
    assert.equal(missing.schedule.finalTaskStatus, 'archive_missing');
    assert.ok(renderCase(state, 'en', [], missing).includes('The final task archive is missing'));
    await writeJson(taskPath, { ...finalTask, id: 'other-task' });
    await assert.rejects(() => readCaseArchiveContext(root, state), error => error.message.includes('identity differs'));
    state.keywordManifestHash = 'wrong-hash';
    await assert.rejects(() => readCaseArchiveContext(root, state), error => error.message.includes('manifest hash differs'));
  } finally { globalThis.fetch = previous; await rm(root, { recursive: true, force: true }); }
});

test('empty provider citations are a valid observation, not proof of citation coverage', () => {
  const run = { report: { id: 'report' }, models: [{ modelRun: { currentAttemptId: 'attempt', modelSnapshot: { webSearchMode: 'provider_native' } }, attempts: [{ id: 'attempt', rawAnswer: 'unknown', providerSearch: { used: true, executionMode: 'native' } }], archive: { providerCitations: [] }, presentation: { localAnalysis: 'complete' } }] };
  assert.equal(preflightReview(run).passed, true);
  assert.equal(preflightReview(run).releaseCitationGateSatisfied, false);
  run.models[0].attempts[0].providerSearch.executionMode = 'sdk';
  assert.equal(preflightReview(run).passed, false);
  run.models[0].attempts[0].providerSearch.executionMode = 'native';
  run.models[0].presentation.localAnalysis = 'failed';
  assert.equal(preflightReview(run).passed, false);
});

test('shared budget serializes requests and blocks unknown-cost or over-cap calls before delegate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-budget-'));
  const path = join(root, 'ledger.json');
  const model = { id: 'provider/model', context_length: 100, pricing: { prompt: 0, completion: 0.01, web_search: 0 } };
  const input = { prompt: 'domain', requestParameters: { maxTokens: 10, webSearchEnabled: false }, modelSnapshot: { modelId: model.id, webSearchMode: 'off' } };
  let calls = 0;
  try {
    await writeJson(path, { entries: [] });
    const budget = new StudyBudgetExecutor(path, [model], { costLimitUsd: 0.1, requestLimit: 10 }, { async execute() { calls++; return { text: 'raw', costUsd: 0.1 }; } });
    const results = await Promise.allSettled([budget.execute(input), budget.execute(input)]);
    assert.equal(calls, 1);
    assert.equal(results.filter(x => x.status === 'rejected').length, 1);
    assert.equal((await readJson(path)).entries.length, 1);
    await writeJson(path, { entries: [] });
    const unknown = new StudyBudgetExecutor(path, [model], { costLimitUsd: 1, requestLimit: 10 }, { async execute() { calls++; return { text: 'raw' }; } });
    await unknown.execute(input);
    await assert.rejects(() => unknown.execute(input));
    assert.equal(calls, 2);
    assert.equal((await readJson(path)).entries[0].costUsd, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
