import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { argumentsMap, files, hash, readJson, snapshot, writeJson } from '../examples/lib/io.mjs';
import { assertCitation } from '../examples/lib/study.mjs';
import { domainRecognitionPrompt } from '../src/product/recognition/recognition-prompt.ts';
import { keywordDiscoveryPrompt } from '../src/product/measurements/keyword-discovery-protocol.ts';

const options = Object.fromEntries(Object.entries(argumentsMap(process.argv.slice(2))).map(([key, value]) => [key.slice(2), value]));
const root = options.root || 'validation/release-v0.2.0-rc.1';
const [plan, results, ledger, initial, index, image] = await Promise.all(['study-plan.json', 'results.json', 'provider-ledger.json', 'initial-inventory.json'].map(x => readJson(join(root, x))).concat([readJson('examples/case-index.json'), readJson(options.image)]));
const reports = {};
for (const kind of ['local', 'regression', 'cases', 'site']) reports[kind] = options[kind] ? { path: options[kind], ...await readJson(options[kind]) } : { passed: false, missing: true };
const additional = options.additional ? { path: options.additional, ...await readJson(options.additional) } : null;
const security = options.security ? { path: options.security, ...await readJson(options.security) } : null;
reports.semantic = { path: join(root, 'semantic-evidence-audit.json'), ...await readJson(join(root, 'semantic-evidence-audit.json')) };
for (const phase of reports.regression.records || []) {
  const traces = (await files(join(phase.path, 'artifacts'))).filter(path => path.endsWith('trace.zip'));
  const steps = [];
  for (const trace of traces) {
    const names = execFileSync('unzip', ['-Z1', trace], { encoding: 'utf8' }).split('\n').filter(name => name.endsWith('.trace'));
    const seen = new Set();
    for (const name of names) {
      const rows = execFileSync('unzip', ['-p', trace, name], { encoding: 'utf8', maxBuffer: 60000000 }).split('\n').filter(Boolean).map(line => JSON.parse(line));
      for (const row of rows.filter(row => row.type === 'before' && row.method === 'expect')) {
        const id = row.stepId || row.callId;
        if (seen.has(id)) continue;
        seen.add(id);
        steps.push({ trace, stream: name, stepId: id, title: row.title || row.params?.expression || 'expect' });
      }
    }
  }
  phase.traceAssertions = { count: steps.length, method: 'unique expect stepId per trace archive; not number of test files or browser operations', steps };
}
const countBy = (rows, key) => Object.fromEntries([...new Set(rows.map(key))].map(value => [value, rows.filter(x => key(x) === value).length]));
const inputHash = hash(await readFile(join(root, 'study-plan.json')));
const publicPlanHash = hash(await readFile('examples/study-plan.json'));
const observations = [];
const failures = [];
const citationChecks = [];
const keywordChecks = [];
const schedulerChecks = [];
const metricChecks = [];
const persistenceIndex = new Map();
for (const path of (await files(join(root, 'product-data'))).filter(x => x.endsWith('.json'))) {
  const record = await readJson(path);
  if (record?.id && Object.hasOwn(record, 'rawProviderResponse')) persistenceIndex.set(record.id, { path, record, sha256: hash(await readFile(path)) });
}
function observation(attempt, scope, state, citations, result) {
  const entry = ledger.entries.find(x => x.attemptId === attempt.id);
  const saved = persistenceIndex.get(attempt.id);
  const rawHash = typeof attempt.rawAnswer === 'string' ? hash(attempt.rawAnswer) : null;
  const sameRaw = saved && saved.record.rawAnswer === attempt.rawAnswer;
  const sameCost = entry && entry.costUsd === attempt.costUsd;
  const expected = scope === 'K' ? keywordDiscoveryPrompt({ keyword: state.keyword, language: state.language }) : domainRecognitionPrompt({ normalizedDomain: state.domain, language: state.language, protocol: state.protocol });
  const row = { caseId: state.caseId, scope, runId: attempt.runId, modelRunId: attempt.modelRunId, attemptId: attempt.id, modelId: entry?.modelId, status: attempt.status, modelRecognition: result?.domainRecognition ?? null, analysisStatus: result?.analysisStatus ?? null, hasNonemptyAnswer: Boolean(attempt.rawAnswer), analyzable: Boolean(attempt.rawAnswer) && ['completed', 'unknown'].includes(attempt.status), promptHash: attempt.promptHash, expectedPromptHash: hash(expected), promptMatches: attempt.promptHash === hash(expected), rawAnswerHash: rawHash, ledgerRawHashMatches: rawHash === entry?.rawAnswerHash, persisted: Boolean(sameRaw), persistence: saved ? { path: saved.path, sha256: saved.sha256 } : null, costMatches: Boolean(sameCost), tokenUsage: attempt.tokenUsage ?? null, costUsd: attempt.costUsd ?? null, actualSearch: attempt.providerSearch ?? null, providerCitationCount: citations.length };
  observations.push(row);
  if (!row.persisted || !row.promptMatches || !row.ledgerRawHashMatches || !row.costMatches) failures.push({ type: 'observation_consistency', ...row });
  for (const citation of citations) {
    try { citationChecks.push({ attemptId: attempt.id, id: citation.id, url: citation.url, providerPayloadPath: citation.providerPayloadPath, type: assertCitation(citation, attempt), passed: true }); }
    catch (error) { citationChecks.push({ attemptId: attempt.id, id: citation.id, passed: false, error: String(error) }); }
  }
}
for (const state of results.cases) {
  const input = plan.cases.find(x => x.id === state.caseId);
  const shared = { caseId: state.caseId, domain: input.domain, language: input.language, protocol: state.baseline.recognitionProtocol };
  for (const run of state.recognitionRuns) for (const model of run.models) for (const attempt of model.attempts) observation(attempt, 'initial_D', shared, model.archive?.providerCitations || [], model.archive?.result);
  for (const run of state.measurementRuns) for (const detail of run.probes) for (const attempt of detail.attempts) {
    const keyword = state.watchSet.keywords.find(x => x.id === detail.probe.keywordId)?.keyword;
    observation(attempt, detail.probe.kind === 'keyword_discovery' ? 'K' : 'measurement_D', { ...shared, keyword }, detail.evidence?.providerCitations || [], detail.domainResult || detail.keywordResult);
  }
  const path = join(root, 'keyword-manifests', `${state.caseId}.json`);
  const keywordHash = hash(await readFile(path));
  const keywordSources = state.keywords.selected.flatMap(x => x.sources).map(source => { const saved = persistenceIndex.get(source.attemptId); return { ...source, exactQuote: saved?.record.rawAnswer?.slice(source.evidence.start, source.evidence.end) === source.evidence.quote }; });
  keywordChecks.push({ caseId: state.caseId, path, sha256: keywordHash, expectedHash: state.keywordManifestHash, passed: keywordHash === state.keywordManifestHash && keywordSources.every(x => x.exactQuote), selected: state.keywords.selected.map(x => x.keyword), sources: keywordSources });
  for (const point of state.statistics?.snapshot?.points || []) {
    const included = point.samples.filter(x => x.included);
    const numerator = included.filter(x => x.numerator).length;
    const associationPoints = (state.statistics?.snapshot?.points || []).filter(x => x.metric === 'keyword_association_count' && x.runId === point.runId && x.modelId === point.modelId && x.webSearchMode === point.webSearchMode && x.objectId === point.objectId);
    const denominator = point.metric === 'keyword_relative_weight' ? associationPoints.reduce((sum, x) => sum + x.samples.filter(s => s.included && s.numerator).length, 0) : included.length;
    const percentage = denominator > 0 ? numerator / denominator * 100 : null;
    const value = point.metric === 'keyword_association_count' ? numerator : point.metric === 'recommendation_gap' ? denominator > 0 && point.comparisonDenominator > 0 ? percentage - point.comparisonNumerator / point.comparisonDenominator * 100 : null : percentage;
    metricChecks.push({ caseId: state.caseId, id: point.id, numerator, denominator, denominatorUnit: point.metric === 'keyword_relative_weight' ? 'all watched keyword associations' : 'included answers', numeratorMatches: point.numerator === numerator, denominatorMatches: point.denominator === denominator, valueMatches: value === null ? point.value === null : Math.abs(point.value - value) < 0.000001, sampleReferencesExist: point.samples.every(x => !x.attemptId || persistenceIndex.has(x.attemptId)), metric: point.metric, keywordId: point.keywordId, runId: point.runId });
  }
  if (state.schedule) {
    const taskFiles = (await files(join(root, 'product-data/projects', state.projectId, 'schedules/tasks'))).filter(x => x.endsWith('.json'));
    const tasks = await Promise.all(taskFiles.map(readJson));
    const occurrenceFiles = (await files(join(root, 'product-data/projects', state.projectId, 'schedules/occurrences'))).filter(x => x.endsWith('.json'));
    const occurrences = await Promise.all(occurrenceFiles.map(readJson));
    schedulerChecks.push({ caseId: state.caseId, tasks, occurrences, taskFiles, occurrenceFiles, stopped: tasks.every(x => x.status !== 'active'), actualRuns: state.measurementRuns.map(x => x.run), calls: ledger.entries.filter(x => occurrences.some(y => y.runId === x.runId)).map(x => x.id) });
  }
}
const costSummary = rows => ({ calls: rows.length, knownCostUsd: Number(rows.reduce((sum, x) => sum + (x.costUsd ?? 0), 0).toFixed(10)), unknownCostCalls: rows.filter(x => x.costUsd === null || x.costUsd === undefined).length, tokens: { input: rows.reduce((sum, x) => sum + (x.tokens?.input || 0), 0), output: rows.reduce((sum, x) => sum + (x.tokens?.output || 0), 0), total: rows.reduce((sum, x) => sum + (x.tokens?.total || 0), 0) } });
const cost = costSummary(ledger.entries);
const mainIds = new Set(observations.map(x => x.attemptId));
const budget = { ...ledger.budget, actual: cost, caseCalls: costSummary(ledger.entries.filter(x => mainIds.has(x.attemptId))), preflight: costSummary(ledger.entries.filter(x => !mainIds.has(x.attemptId))), remainingUsd: Number((ledger.budget.costLimitUsd - cost.knownCostUsd).toFixed(10)), exceeded: cost.knownCostUsd > ledger.budget.costLimitUsd, metadataRequests: { kind: 'free model directory GET', count: null, reason: 'not instrumented across every historical browser cycle' }, ledgerPath: join(root, 'provider-ledger.json'), ledgerHash: hash(await readFile(join(root, 'provider-ledger.json'))) };
const sourceFiles = (await Promise.all(['src', 'test', 'e2e', 'scripts', 'examples/lib', 'website'].map(files))).flat().filter(x => ['.ts', '.js', '.mjs', '.tsx', '.jsx'].some(ext => x.endsWith(ext)));
const sourceFindings = [];
const brandMatches = [];
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    const called = (ts.isCallExpression(node) || ts.isNewExpression(node)) && node.expression;
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral || (called && (ts.isIdentifier(called) && called.text === 'RegExp' || ts.isPropertyAccessExpression(called) && called.name.text === 'RegExp'))) sourceFindings.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind: ts.SyntaxKind[node.kind] });
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (file.startsWith('src/')) for (const input of plan.cases) {
    const position = content.toLowerCase().indexOf(input.domain.toLowerCase());
    if (position !== -1) brandMatches.push({ file, domain: input.domain, line: content.slice(0, position).split('\n').length, status: 'requires_review_not_automatically_a_product_branch' });
  }
}
const scan = { method: 'TypeScript AST; no regular expressions used by scanner', scope: sourceFiles, fileCount: sourceFiles.length, regularExpressionFindings: sourceFindings, literalDomainMatches: brandMatches, limitation: 'Literal-domain detection plus existing architecture branch tests cannot prove absence of every possible semantic product bias.' };
await writeJson(join(root, 'source-scan.json'), scan);
const screenshots = await readJson(join(root, 'screenshot-index.json'));
const imageChecks = await Promise.all(screenshots.map(async x => ({ caseId: x.caseId, path: x.path, hashMatches: hash(await readFile(x.path)) === x.sha256, sameCandidate: x.candidateImageDigest === image.indexDigest, hasAttempts: x.attemptIds.length > 0, hasTrace: (await readFile(x.trace)).length > 0 })));
const contentFiles = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const inventory = [];
for (const path of [...new Set(contentFiles)].sort()) {
  let bytes;
  try { bytes = await readFile(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const category = path.startsWith('src/') || ['Dockerfile', 'docker-compose.yml', 'package.json', 'package-lock.json', 'tsconfig.json'].includes(path) ? 'product_source' : ['test/', 'e2e/', 'scripts/'].some(x => path.startsWith(x)) || path.startsWith('playwright') ? 'test_and_tooling' : path.startsWith('examples/') || path.startsWith('assets/screenshots/') ? 'public_examples' : 'documentation_and_release';
  const previous = initial.source.files.find(x => x.path === path);
  const releaseSelection = path.startsWith('examples/real-provider-10/') || path.startsWith('docs/legacy/') ? 'legacy_preserved_not_selected_for_current_public_showcase' : 'candidate_inventory_requires_source_review_before_commit';
  inventory.push({ path, category, releaseSelection, sha256: hash(bytes), sizeBytes: bytes.length, initialSourceHash: previous?.sha256 ?? null, attribution: previous ? previous.sha256 === hash(bytes) ? 'preexisting_unchanged' : 'changed_since_recorded_phase6_snapshot' : 'not_covered_by_initial_source_snapshot_do_not_infer_authorship' });
}
await writeJson(join(root, 'release-files.json'), { inventory, privateValidation: { path: root, excludedFromGit: true, purpose: 'original provider archives, local tests, traces, user authorization and build outputs' }, userPreexistingGitStatus: initial.status });
const currentUserData = await snapshot('.', ['data']);
const isolation = { testedRoot: join(root, 'product-data'), screenshotRoot: join(root, 'case-ui-data'), userDataBefore: initial.userData.sha256, userDataAfter: currentUserData.sha256, unchanged: currentUserData.sha256 === initial.userData.sha256, caveat: 'Initial hash only covered data/. User server may use another validation directory; no before-hash was captured for that alternative path and no verification claim is made for it.' };
const gates = [];
function gate(id, passed, evidence, reason = '') { gates.push({ id, status: passed ? 'passed' : 'blocked', evidence, reason }); }
gate('A01', index.length === plan.cases.length && new Set(index.map(x => x.domain)).size === plan.cases.length && index.every(x => x.d.attempted > 0), ['examples/case-index.json']);
gate('A02', inputHash === publicPlanHash && inputHash === results.studyPlanHash && keywordChecks.every(x => x.passed), ['keywordChecks', 'inputHashes']);
gate('A03', observations.length > 0 && failures.length === 0, ['observations', 'failures']);
gate('A04', observations.some(x => x.status === 'unknown' || x.modelRecognition === 'not_recognized'), ['observations']);
gate('A05', false, ['test/examples/release-examples.test.mjs'], 'No new all-failed real case was forced. Synthetic unit coverage must not be reported as a real full-failure demonstration.');
gate('A06', observations.filter(x => x.status === 'analysis_failed').every(x => x.hasNonemptyAnswer && x.persisted), ['observations', reports.cases.path]);
gate('A07', observations.filter(x => x.scope !== 'K').every(x => x.promptMatches), ['observations']);
gate('A08', keywordChecks.every(x => x.passed) && observations.filter(x => x.scope === 'K').every(x => x.promptMatches), ['keywordChecks', 'observations']);
gate('A09', citationChecks.some(x => x.type === 'provider_citation') && citationChecks.every(x => x.passed) && observations.filter(x => !x.actualSearch?.requested).every(x => x.providerCitationCount === 0), ['citationChecks']);
gate('A10', false, ['metricChecks', 'docs/limitations.md'], 'Sample arithmetic is audited below; recommendation quote eligibility and comparison conditions still have documented product gaps.');
gate('A11', schedulerChecks.length === plan.repeatCases.length && reports.regression.records?.find(x => x.phase === 5)?.exitCode === 0 && reports.cases.passed && imageChecks.every(x => x.sameCandidate), ['schedulerChecks', reports.regression.path, reports.cases.path], 'Latest chart regression covers keyword separation and missing-value breaks; only archived repeat points are displayed.');
gate('A12', schedulerChecks.length > 0 && schedulerChecks.every(x => x.stopped && x.calls.length > 0), ['schedulerChecks']);
gate('A13', !budget.exceeded && cost.unknownCostCalls === 0, ['budget', 'test/examples/release-examples.test.mjs'], 'This phase uses the isolated study budget executor, not a guarantee for all product entry points.');
gate('A14', reports.local.passed && reports.site.passed, [reports.local.path, reports.site.path]);
gate('A15', false, ['docs/deployment/docker.md'], 'Local builds were exercised; no immutable source release or public candidate registry exists.');
gate('A16', reports.local.passed && reports.regression.passed, [reports.local.path, reports.regression.path]);
gate('A17', reports.cases.passed && imageChecks.every(x => x.sameCandidate), [options.image, reports.cases.path]);
gate('A18', additional?.records.find(x => x.id === 'B08')?.passed === true, [additional?.path], 'Backup restore in both candidate architectures and rollback to the previous local candidate; not a stable-release migration guarantee.');
gate('A19', reports.regression.passed, [reports.regression.path]);
gate('A20', false, ['website build manifest', 'examples/case-index.json'], 'Relative local evidence exists; immutable public source and evidence URLs have not been published.');
gate('A21', false, ['assets/brand/', 'brand-assets checks'], 'Shape-only fill variants exist; final GitHub rendered dark/light verification must be separately recorded.');
gate('A22', reports.cases.passed && imageChecks.length >= plan.cases.length * 2 && imageChecks.every(x => x.hashMatches && x.sameCandidate && x.hasAttempts && x.hasTrace), ['imageChecks', reports.cases.path]);
gate('A23', false, ['docs/limitations.md'], 'Final public security/content review is separate from generated export counts.');
gate('A24', security?.passed === true, [security?.path, 'release-files.json'], 'Exact local secret values and private project identifiers scanned within the stated public export scope; not a general security audit.');
gate('A25', reports.local.passed, [reports.local.path, '.github/workflows/docker-publish.yml'], 'No registry tags were changed; publication still requires explicit authorization.');
gate('A26', reports.regression.records?.find(x => x.phase === 5)?.exitCode === 0, [reports.regression.path]);
gate('A27', false, ['docs/ARCHITECTURE.md', 'docs/limitations.md'], 'Current architecture documented; known evidence/statistical defects remain.');
gate('A28', [reports.local, reports.regression, reports.cases, reports.site].every(x => x.unchanged) && inputHash === results.studyPlanHash, ['reports', 'inputHashes']);
for (const id of ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08']) {
  const record = additional?.records.find(x => x.id === id);
  gate(id, record?.passed === true, [additional?.path, reports.cases.path, reports.site.path], record ? record.error || '' : 'Scenario not fully verified by the supplemental browser test; screenshots alone do not establish every assertion.');
}
const adjudication = { schemaVersion: 'release-adjudication/v1', generatedAt: new Date().toISOString(), phase6Status: 'blocked', version: plan.version, providerInferenceStopped: true, inputHashes: { privatePlan: inputHash, publicPlan: publicPlanHash, expected: results.studyPlanHash }, coverage: { casesDocumented: index.length, casesAttempted: index.filter(x => x.d.attempted).length, casesWithValidAnswers: index.filter(x => x.d.valid).length, caseStates: countBy(index, x => x.status), byProtocol: countBy(observations, x => x.scope), observationStates: countBy(observations, x => x.status), casesWithK: index.filter(x => x.k.attempted).length, screenshots: screenshots.length }, budget, observations, failures, citationChecks, keywordChecks, metricChecks, schedulerChecks, imageChecks, isolation, reports, additional, security, gates, git: { branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }), committedThisPhase: false, pushedThisPhase: false, latestChanged: false } };
await writeJson(join(root, 'release-adjudication.json'), adjudication);
await writeJson(join(root, 'release-manifest.json'), { version: plan.version, status: adjudication.phase6Status, productCommit: null, documentationCommit: null, headReferenceOnly: adjudication.git.head, reason: 'Candidate built from attributed uncommitted worktree; no publishing or commit performed.', sourceInventory: 'release-files.json', image, studyPlanHash: inputHash, ledgerHash: budget.ledgerHash, evidenceBundles: await Promise.all(index.map(async x => ({ caseId: x.id, path: `examples/cases/${x.id}/public-evidence.json`, sha256: hash(await readFile(`examples/cases/${x.id}/public-evidence.json`)) }))), screenshotIndexHash: hash(await readFile(join(root, 'screenshot-index.json'))), adjudication: 'release-adjudication.json', publicUrls: { release: null, image: null, website: null } });
console.log(JSON.stringify({ phase6Status: adjudication.phase6Status, coverage: adjudication.coverage, cost: budget.actual, inconsistencies: failures.length, report: join(root, 'release-adjudication.json') }));
