import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { files, hash, readJson } from './io.mjs';

export async function readCases(root = 'examples/cases') {
  const paths = (await files(root)).filter(path => path.endsWith('/case.json'));
  const cases = await Promise.all(paths.map(readJson));
  const ids = new Set();
  const domains = new Set();
  for (const item of cases) {
    if (typeof item.id !== 'string' || ids.has(item.id)) throw new Error('Missing or duplicate case ID.');
    const domain = new URL(`https://${item.domain}`).hostname;
    if (domain !== item.domain || domains.has(domain)) throw new Error('Domain must be unique and normalized.');
    if (!['en', 'zh'].includes(item.language)) throw new Error('Invalid case language.');
    if (!item.category?.en || !item.category?.zh) throw new Error('Missing bilingual browsing category.');
    ids.add(item.id); domains.add(domain);
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

export function validatePlan(plan) {
  if (plan.schemaVersion !== 'release-study/v1') throw new Error('Unsupported study schema.');
  if (!Array.isArray(plan.models) || plan.models.length !== 3) throw new Error('Three fixed model configurations are required.');
  if (new Set(plan.models.map(x => x.modelId)).size !== plan.models.length) throw new Error('Model IDs must be unique.');
  if (plan.models.filter(x => x.webSearchMode === 'off').length !== 2 || plan.models.filter(x => x.webSearchMode === 'provider_native').length !== 1) throw new Error('Study requires two offline and one native-search configuration.');
  if (plan.maxKeywords !== 2 || plan.repetitions !== 3) throw new Error('Study coverage changed.');
  if (!(plan.budget.costLimitUsd > 0) || !Number.isInteger(plan.budget.requestLimit)) throw new Error('Explicit budget required.');
  if (plan.providerRetryLimit !== 0 || plan.applicationTruncationRetries !== 1) throw new Error('Retry policy is not explicit.');
  return plan;
}

export function plannedCalls(plan, cases) {
  const recognition = cases.length * plan.models.length;
  const repeated = cases.filter(item => plan.repeatCases.includes(item.id)).length;
  const measurementRuns = cases.length + repeated * (plan.repetitions - 1);
  const measurement = measurementRuns * plan.models.length * (1 + plan.maxKeywords);
  return { recognition, measurement, maximumBaseCalls: recognition + measurement, maximumTruncationRetries: recognition, maximumCallsIncludingTruncationRetries: recognition * 2 + measurement, note: 'Measurement API also runs the target-domain probe. No competitor-domain probes are selected.' };
}

export function atPayloadPath(root, path) {
  const keys = path.split('[').join('.').split(']').join('').split('.').filter(Boolean);
  let value = root;
  for (const key of keys) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

export function assertCitation(citation, attempt) {
  const actual = atPayloadPath(attempt.rawProviderResponse, citation.providerPayloadPath);
  if (typeof actual !== 'string') throw new Error(`Citation payload path is missing: ${citation.id}`);
  if (new URL(actual).href !== new URL(citation.url).href) throw new Error(`Citation URL differs from payload: ${citation.id}`);
  if (!attempt.requestParameters.webSearchEnabled) throw new Error('Offline attempt contains Provider Citation.');
  return citation.providerCitationSource === 'provider_search_result' ? 'retrieval_result' : 'provider_citation';
}

export function preflightReview(run) {
  const detail = run.models[0];
  const attempt = detail?.attempts.find(x => x.id === detail.modelRun.currentAttemptId);
  const online = detail?.modelRun.modelSnapshot.webSearchMode === 'provider_native';
  const citations = detail?.archive?.providerCitations || [];
  const provenance = citations.map(citation => assertCitation(citation, attempt));
  const nativeConfirmed = Boolean(attempt?.providerSearch?.used && ['native', 'provider_always_on'].includes(attempt.providerSearch.executionMode));
  const passed = Boolean(attempt?.rawAnswer && detail.archive && run.report && detail.presentation.localAnalysis !== 'failed' && (!online || nativeConfirmed));
  return { version: 'engineering-preflight/v2', passed, nativeConfirmed, providerCitationCount: provenance.filter(x => x === 'provider_citation').length, retrievalResultCount: provenance.filter(x => x === 'retrieval_result').length, emptyCitationsAreValid: true, releaseCitationGateSatisfied: provenance.includes('provider_citation') };
}

export function keywordManifest(caseInput, details, suggestion, plan) {
  const identities = [caseInput.domain];
  for (const detail of details) {
    const archive = detail.archive;
    if (archive?.result?.recognizedBrand?.value) identities.push(archive.result.recognizedBrand.value);
    for (const row of archive?.competitors || []) identities.push(row.name, row.domain || '');
  }
  const identityTokens = identities.filter(Boolean).map(x => x.trim().toLowerCase());
  const rows = suggestion.keywords.map(row => {
    const sources = [];
    for (const detail of details) {
      for (const keyword of detail.archive?.brandKeywords || []) {
        if (keyword.normalizedKeyword !== row.normalizedKeyword || !keyword.evidence) continue;
        const attempt = detail.attempts.find(x => x.id === keyword.attemptId);
        if (attempt?.rawAnswer?.slice(keyword.evidence.start, keyword.evidence.end) !== keyword.evidence.quote) continue;
        sources.push({ modelId: detail.modelRun.modelSnapshot.modelId, recordId: keyword.id, attemptId: keyword.attemptId, evidence: keyword.evidence });
      }
    }
    const matchedIdentity = identityTokens.find(x => row.normalizedKeyword.includes(x));
    const modelCount = new Set(sources.map(x => x.modelId)).size;
    const reason = matchedIdentity ? 'contains_observed_identity' : !row.neutralEligible ? row.neutralEligibilityReason : sources.length === 0 ? 'no_exact_answer_evidence' : modelCount < plan.keywordRule.minimumIndependentModels ? 'insufficient_independent_association' : 'eligible';
    return { id: row.id, keyword: row.keyword, normalizedKeyword: row.normalizedKeyword, reason, modelCount, sources };
  }).sort((a, b) => b.modelCount - a.modelCount || a.normalizedKeyword.localeCompare(b.normalizedKeyword));
  const selected = rows.filter(x => x.reason === 'eligible').slice(0, plan.maxKeywords);
  return { schemaVersion: 'release-keywords/v1', caseId: caseInput.id, studyRule: plan.keywordRule, selected, candidates: rows, limitation: 'Exact cross-model association and absence of observed identities are mechanically checked. This is not a semantic guarantee or search-demand ranking.' };
}

export async function verifyFrozen(path, expectedHash) {
  if (hash(await readFile(path)) !== expectedHash) throw new Error(`Frozen input changed: ${path}`);
}
