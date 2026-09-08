import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash, readJson, writeJson } from './io.mjs';
import { assertCitation } from './study.mjs';

const secretFields = new Set(['authorization', 'api_key', 'apikey', 'access_token', 'refresh_token', 'password', 'cookie', 'set-cookie']);
function sanitize(value, path = '$', redactions = []) {
  if (Array.isArray(value)) return value.map((item, index) => sanitize(item, `${path}[${index}]`, redactions));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (secretFields.has(key.toLowerCase())) { redactions.push(`${path}.${key}`); return [key, '[redacted]']; }
    return [key, sanitize(item, `${path}.${key}`, redactions)];
  }));
  return value;
}
function cleanText(value) {
  return String(value ?? '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('|').join('&#124;').split('\n').join(' ');
}
function textValue(value) { const text = value && typeof value === 'object' && Object.hasOwn(value, 'value') ? value.value : value; return text === null || text === undefined ? '—' : cleanText(text); }
function validAttempt(attempt) { return ['completed', 'unknown'].includes(attempt?.status) && Boolean(attempt.rawAnswer); }
function firstAttempt(detail) { return detail.attempts.find(x => x.id === detail.probe.firstAttemptId); }
function localized(value, language) {
  if (typeof value === 'string') return value;
  return typeof value?.[language] === 'string' ? value[language] : '';
}
function archiveSegment(value) {
  if (typeof value !== 'string' || !value || ['.', '..'].includes(value) || value.includes('/') || value.includes('\\')) throw new Error('Invalid archive identifier.');
  return value;
}

// Keep collection-time snapshots intact; supplementary archives have their own provenance.
export async function readCaseArchiveContext(root, state) {
  let keywordManifest = state.keywords || null;
  let keywordManifestSource = null;
  if (state.keywordManifestHash) {
    const path = join('keyword-manifests', `${archiveSegment(state.caseId)}.json`);
    const bytes = await readFile(join(root, path));
    if (hash(bytes) !== state.keywordManifestHash) throw new Error('Frozen keyword manifest hash differs.');
    keywordManifest = JSON.parse(bytes.toString('utf8'));
    if (keywordManifest.caseId !== state.caseId) throw new Error('Frozen keyword manifest belongs to another case.');
    keywordManifestSource = { path, sha256: hash(bytes) };
  }
  let schedule = null;
  if (state.schedule?.task) {
    const path = join('product-data', 'projects', archiveSegment(state.projectId), 'schedules', 'tasks', `${archiveSegment(state.schedule.task.id)}.json`);
    schedule = { taskAtCollection: state.schedule.task, finalTask: null, finalTaskSource: { path, sha256: null }, finalTaskStatus: 'archive_missing', occurrences: state.schedule.occurrences || [] };
    try {
      const bytes = await readFile(join(root, path));
      const task = JSON.parse(bytes.toString('utf8'));
      if (task.id !== state.schedule.task.id || task.projectId !== state.projectId) throw new Error('Final task archive identity differs.');
      schedule = { ...schedule, finalTask: task, finalTaskSource: { path, sha256: hash(bytes) }, finalTaskStatus: 'archived' };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { keywordManifest, keywordManifestSource, schedule };
}

export function publicModel(detail) {
  const attempt = detail.attempts.find(x => x.id === detail.modelRun.currentAttemptId);
  const archive = detail.archive || null;
  const citations = (archive?.providerCitations || []).filter(row => row.providerCitationSource !== 'answer_text_url').map(row => ({ ...row, evidenceType: assertCitation(row, detail.attempts.find(x => x.id === (row.attemptId || attempt?.id))) }));
  for (const row of archive?.brandKeywords || []) {
    const source = detail.attempts.find(x => x.id === (row.attemptId || attempt?.id));
    if (row.evidence && source?.rawAnswer?.slice(row.evidence.start, row.evidence.end) !== row.evidence.quote) throw new Error('Keyword evidence differs from raw answer.');
  }
  return { modelRun: detail.modelRun, attempts: detail.attempts, archive, presentation: detail.presentation, citations, validAnswer: validAttempt(attempt), rawAnswer: attempt?.rawAnswer ?? null, rawAnswerHash: typeof attempt?.rawAnswer === 'string' ? hash(attempt.rawAnswer) : null };
}

export function summarizeCase(state, context = {}) {
  const models = state.recognitionRuns.flatMap(run => run.models.map(publicModel));
  const probes = state.measurementRuns.flatMap(run => run.probes);
  const k = probes.filter(x => x.probe?.kind === 'keyword_discovery');
  const domainProbes = probes.filter(x => ['target_domain', 'competitor_domain'].includes(x.probe?.kind));
  const recognition = models.map(x => {
    const attempt = x.attempts.find(a => a.id === x.modelRun.currentAttemptId);
    return { scope: 'initialD', modelId: x.modelRun.modelSnapshot.modelId, modelRunId: x.modelRun.id, attemptId: attempt?.id ?? null, resultAttemptId: x.archive?.result?.attemptId ?? null, webSearchMode: x.modelRun.modelSnapshot.webSearchMode, executionMode: attempt?.providerSearch?.executionMode ?? null, domainRecognition: x.archive?.result?.domainRecognition ?? null, analysisStatus: x.archive?.result?.analysisStatus ?? null, localAnalysis: x.presentation?.localAnalysis ?? null };
  });
  const initialD = { attempted: models.length, valid: models.filter(x => x.validAnswer).length, basis: 'current_attempt_analyzable_answer', isMetricDenominator: false, models: recognition };
  const measurementD = { attempted: domainProbes.length, valid: domainProbes.filter(x => validAttempt(firstAttempt(x))).length, basis: 'first_attempt_analyzable_answer', isMetricDenominator: false, models: domainProbes.map(x => ({ scope: 'measurementD', modelId: x.probe.fingerprint.modelId, runId: x.probe.runId, probeId: x.probe.id, attemptId: firstAttempt(x)?.id ?? null, resultAttemptId: x.domainResult?.attemptId ?? null, webSearchMode: x.probe.fingerprint.webSearchMode, executionMode: firstAttempt(x)?.providerSearch?.executionMode ?? null, domainRecognition: x.domainResult?.domainRecognition ?? null, analysisStatus: x.domainResult?.analysisStatus ?? null, localAnalysis: null })) };
  const keywordCoverage = { attempted: k.length, valid: k.filter(x => validAttempt(firstAttempt(x))).length, basis: 'first_attempt_analyzable_answer', isMetricDenominator: false };
  const d = { attempted: initialD.attempted + measurementD.attempted, valid: initialD.valid + measurementD.valid, basis: 'initialD_plus_measurementD_answer_coverage', isMetricDenominator: false, models: [...recognition, ...measurementD.models] };
  const issues = [...state.errors];
  if (state.status && state.status !== 'completed' && state.status !== 'not_run') issues.push(`Case execution: ${state.status}`);
  for (const run of [...state.recognitionRuns, ...state.measurementRuns]) {
    if (run.run?.status !== 'completed') issues.push(`Run ${run.run?.id ?? 'unavailable'}: ${run.run?.status ?? 'missing_status'}`);
    if (run.reportError) issues.push(`Report ${run.run?.id}: ${run.reportError}`);
    if (run.run?.plannedProbeCount > (run.probes?.length ?? 0)) issues.push(`Run ${run.run.id}: missing planned probes`);
    if (run.run?.plannedModelRunCount > (run.models?.length ?? 0)) issues.push(`Run ${run.run.id}: missing planned model runs`);
  }
  for (const model of models) {
    if (!model.validAnswer || !model.archive?.result || model.archive.result.analysisStatus === 'analysis_failed' || model.presentation?.localAnalysis !== 'complete') issues.push(`Model ${model.modelRun.id}: incomplete answer or local analysis`);
    if (model.modelRun.status && !['completed', 'unknown'].includes(model.modelRun.status)) issues.push(`Model ${model.modelRun.id}: ${model.modelRun.status}`);
  }
  for (const detail of probes) {
    if (detail.probe.status !== 'completed' || !validAttempt(firstAttempt(detail))) issues.push(`Probe ${detail.probe.id}: ${detail.probe.status}; first attempt ${firstAttempt(detail)?.status ?? 'missing'}`);
    const result = detail.keywordResult || detail.domainResult;
    if (!result || result.analysisStatus === 'analysis_failed') issues.push(`Probe ${detail.probe.id}: missing or failed analysis`);
  }
  for (const detail of [...models, ...probes]) for (const attempt of detail.attempts) {
    if (!['completed', 'unknown'].includes(attempt.status)) issues.push(`Attempt ${attempt.id}: ${attempt.status}${attempt.errorMessage ? `; ${attempt.errorMessage}` : ''}`);
  }
  for (const occurrence of state.schedule?.occurrences || []) {
    if (occurrence.status !== 'completed' || occurrence.reason === 'run_partial_or_failed') issues.push(`Occurrence ${occurrence.id}: ${occurrence.status}; ${occurrence.reason ?? 'no_reason'}`);
  }
  if (state.schedule && !context.schedule?.finalTask) issues.push('Final monitoring task archive is unavailable; collection status is not current status.');
  const attempted = d.attempted + keywordCoverage.attempted;
  const valid = d.valid + keywordCoverage.valid;
  const hasRuns = state.recognitionRuns.length + state.measurementRuns.length > 0;
  const status = !attempted && !hasRuns && !issues.length ? 'not_run' : !valid ? (state.status === 'running' ? 'partial' : 'failed') : issues.length || state.status === 'not_run' ? 'partial' : 'completed';
  const observation = attempted ? {
    en: `Initial D: ${initialD.valid}/${initialD.attempted} analyzable current answers. Measurement D: ${measurementD.valid}/${measurementD.attempted} analyzable first answers. K: ${keywordCoverage.valid}/${keywordCoverage.attempted} analyzable first answers. These are answer-coverage counts, not recognition rates or product metric denominators.`,
    zh: `初始 D：${initialD.valid}/${initialD.attempted} 条当前回答可分析；测量 D：${measurementD.valid}/${measurementD.attempted} 条首次回答可分析；K：${keywordCoverage.valid}/${keywordCoverage.attempted} 条首次回答可分析。这些是回答覆盖计数，不是认识率或产品指标分母。`
  } : { en: 'No initial D model records or measurement probes are archived for this case. This does not establish that a started run succeeded.', zh: '此案例尚无归档的初始 D 模型记录或测量 Probe；这不表示已经启动的 Run 执行成功。' };
  return { caseId: state.caseId, status, sourceStatus: state.status ?? null, observation, initialD, measurementD, d, k: keywordCoverage, issues, schedule: context.schedule || null, screenshots: [], models, probes };
}

function rawAnswerLines(attempt, language) {
  const zh = language === 'zh';
  const raw = typeof attempt?.rawAnswer === 'string' ? attempt.rawAnswer : null;
  return [
    `<a id="attempt-${attempt.id}"></a>`, '',
    `<details><summary>${zh ? '查看模型原始回答' : 'Read the original answer'}</summary>`, '',
    `<pre>${raw === null ? (zh ? '本次未取得原始回答。' : 'No raw answer was returned.') : raw.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')}</pre>`, '', '</details>', '',
    `SHA-256: \`${raw === null ? 'unavailable' : hash(raw)}\``, '',
  ];
}

function sourceLines(evidence, attempts, attempt, language) {
  const zh = language === 'zh';
  const belongs = row => {
    const id = row.attemptId || (attempts.length === 1 ? attempts[0].id : null);
    if (!id || !attempts.some(x => x.id === id)) throw new Error(`Source has no archived attempt: ${row.id}`);
    return id === attempt.id;
  };
  const rows = (evidence?.providerCitations || []).filter(belongs);
  const urls = [...(evidence?.answerMentionedUrls || []).filter(belongs), ...rows.filter(x => x.providerCitationSource === 'answer_text_url')];
  const citations = rows.filter(x => x.providerCitationSource !== 'answer_text_url').map(row => ({ ...row, evidenceType: assertCitation(row, attempt) }));
  const lines = [];
  for (const type of ['provider_citation', 'retrieval_result']) {
    lines.push(`#### ${type === 'provider_citation' ? (zh ? 'Provider 引用' : 'Provider citations') : (zh ? '搜索检索结果' : 'Search retrieval results')}`, '');
    const selected = citations.filter(x => x.evidenceType === type);
    lines.push(...(selected.length ? selected.map(x => `- ${cleanText(x.title || '')}: [${cleanText(x.url)}](<${x.url}>) · \`${x.providerPayloadPath}\``) : [zh ? '此 Attempt 未归档此类来源。' : 'No sources of this type were archived for this attempt.']), '');
  }
  lines.push(`#### ${zh ? '回答中的链接（非 Provider 引用）' : 'Links in the answer (not Provider citations)'}`, '', ...(urls.length ? urls.map(x => `- [${cleanText(x.url)}](<${x.url}>)`) : [zh ? '此 Attempt 未归档正文 URL。' : 'No answer URLs were archived for this attempt.']), '');
  return lines;
}

function keywordLabel(detail, state, context) {
  const id = detail.probe.keywordId;
  const manifest = context.keywordManifest || state.keywords;
  const frozen = manifest?.selected?.find(x => x.id === id);
  const watched = state.watchSet?.keywords?.find(x => x.id === id);
  return frozen?.keyword || watched?.keyword || null;
}

export function caseMarkdown(input, summary, state, language, plan, evidenceHash, screenshots, context = {}) {
  const zh = language === 'zh';
  const models = summary.models;
  if (!context.documentation) {
    const conflicts = summary.probes.flatMap(p => ['firstMentionState', 'firstRecommendationState'].flatMap(field => {
      const unique = (p.mentions || []).filter(m => m[field] === 'unique');
      return unique.length > 1 ? [{ probeId: p.probe.id, field }] : [];
    }));
    context = { ...context, documentation: { conflicts } };
  }
  const evidenceLink = './public-evidence.json';
  const lines = [
    `# ${input.id} · ${input.domain}`, '',
    zh ? '[English](./README.md) · [全部案例](../../README.zh-CN.md)' : '[简体中文](./README.zh-CN.md) · [All cases](../../README.md)', '',
    zh ? '## 本次实际结果' : '## Observed result', '', context.documentation?.observation?.[language] || summary.observation[language], '',
    summary.observation[language], '',
    `${zh ? '执行状态' : 'Execution status'}: **${zh ? ({ completed: '执行完成', partial: '部分完成', failed: '执行失败', not_run: '未执行', blocked: '受阻' }[summary.status] || summary.status) : summary.status}**.`, '',
    ...(context.documentation?.conflicts?.length ? [zh ? '**该指标存在一致性冲突，暂不用于排名比较。** 下列唯一第一名字段仍保留原始值，不选择冠军，也不解释为并列。' : '**These metrics have consistency conflicts and are excluded from ranking comparisons.** Original values remain unchanged; no winner or tie is inferred.', '', ...context.documentation.conflicts.map(x => `- [${x.field} · ${x.probeId}](../../../docs/known-issues.md#conflict-${x.probeId}-${x.field.toLowerCase()})`), ''] : []),
    zh ? '## 测试条件' : '## Conditions', '',
    `${zh ? '输入域名' : 'Input domain'}: ${input.domain}. ${zh ? '回答语言' : 'Answer language'}: ${input.language}.`, '',
    `${zh ? '协议' : 'Protocols'}: D = ${plan.protocols.D}; K = ${plan.protocols.K}.`, '',
    zh ? 'D 只接收域名、语言、固定协议与模型配置。K 只接收已冻结的中性关键词。分类标签不发送给模型。' : 'D receives the domain, language, fixed protocol and model settings. K receives a frozen neutral keyword. Browsing categories are not sent to models.', '',
    ...plan.models.map(x => `- ${x.modelId} · ${x.webSearchMode}`), '',
    zh ? '## 各模型的描述' : '## Model observations', '',
  ];
  const overview = screenshots.find(x => x.view === 'models');
  if (overview) lines.splice(lines.indexOf(zh ? '## 测试条件' : '## Conditions'), 0, `![${cleanText(localized(overview.alt, language))}](../../../${overview.path})`, '', `${cleanText(localized(overview.caption, language))} ${zh ? '截图时间' : 'Captured'}: ${overview.capturedAt}.`, '');
  for (const model of models) {
    const result = model.archive?.result;
    const attempt = model.attempts.find(x => x.id === model.modelRun.currentAttemptId);
    lines.push(`### ${model.modelRun.modelSnapshot.displayName}`, '',
      `**${zh ? '运行时间' : 'Observed at'}:** ${attempt?.startedAt || model.modelRun.createdAt}`, '',
      `domainRecognition: ${textValue(result?.domainRecognition)} · analysisStatus: ${textValue(result?.analysisStatus)} · localAnalysis: ${textValue(model.presentation?.localAnalysis)}.`, '',
      `Attempt: ${textValue(attempt?.id)} · ${textValue(attempt?.status)} · executionMode: ${textValue(attempt?.providerSearch?.executionMode)}.`, '',
      ...(attempt?.errorMessage ? [`${zh ? '错误' : 'Error'}: ${cleanText(attempt.errorMessage)}`, ''] : []),
      `${zh ? '品牌' : 'Brand'}: ${textValue(result?.recognizedBrand?.value)}`, '',
      `${zh ? '业务' : 'Business'}: ${textValue(result?.businessDescription?.value)}`, '',
      ...(result?.businessDescription?.evidence ? [`${zh ? '原文位置' : 'Original span'}: UTF-16 [${result.businessDescription.evidence.start}, ${result.businessDescription.evidence.end}) · [${zh ? '打开完整回答' : 'Full answer'}](#attempt-${attempt.id})`, ''] : []),
      `${zh ? '类别' : 'Category'}: ${textValue(result?.productCategory?.value)}`, '',
      `${zh ? '目标关键词' : 'Brand keywords'}: ${(model.archive?.brandKeywords || []).map(x => cleanText(x.keyword)).join(', ') || (result ? (zh ? '本次未列出' : 'None returned') : (zh ? '无解析结果，无法判断' : 'Unavailable without an analysis result'))}`, '',
      `${zh ? '竞争对象' : 'Competitors named by this model'}:`, '',
      ...(model.archive?.competitors?.length ? model.archive.competitors.map(x => `- ${cleanText(x.name)} · ${textValue(x.domain)}: ${textValue(x.businessDescription)}. ${zh ? '关键词' : 'Keywords'}: ${(model.archive.competitorKeywords || []).filter(k => k.competitorRecognitionId === x.id).map(k => cleanText(k.keyword)).join(', ') || '—'}`) : [result ? (zh ? '本次未列出竞争对象；这不表示现实中没有。' : 'No competitors were returned; this does not establish that none exist.') : (zh ? '无解析结果，无法判断竞争对象。' : 'Competitors are unavailable without an analysis result.')]), '',
      `${zh ? '无法确认' : 'Uncertain'}: ${(result?.unknowns || []).map(cleanText).join('; ') || '—'}`, '',
      ...(result?.fieldIssues || []).map(x => `- ${cleanText(x.field)}: ${cleanText(x.kind)} · ${cleanText(x.detail)}`), '',
      ...rawAnswerLines(attempt, language),
      `[${zh ? '原始回答、字段位置与尝试记录' : 'Answer, field offsets and attempts'}](${evidenceLink}) · SHA-256: \`${model.rawAnswerHash || 'unavailable'}\``, '');
    const keywordRows = [...(model.archive?.brandKeywords || []), ...(model.archive?.competitorKeywords || [])];
    if (keywordRows.length) lines.push(`<details><summary>${zh ? '关键词与原文位置' : 'Keyword provenance and original spans'}</summary>`, '',
      zh ? '| 归属 | 关键词 | 原文 / UTF-16 位置 |' : '| Owner | Keyword | Original text / UTF-16 span |', '|---|---|---|',
      ...keywordRows.map(k => `| ${cleanText(k.competitorRecognitionId ? model.archive.competitors.find(c => c.id === k.competitorRecognitionId)?.name || 'unknown' : result?.recognizedBrand?.value || input.domain)} | ${cleanText(k.keyword)} | ${k.evidence ? `${cleanText(k.evidence.quote)} [${k.evidence.start}, ${k.evidence.end})` : (zh ? '原文定位缺失' : 'No original span')} |`), '', '</details>', '');
    if (attempt) lines.push(...sourceLines(model.archive, model.attempts, attempt, language));
  }
  if (!models.length) lines.push(zh ? '尚未取得本周期真实回答，不能生成品牌判断。' : 'No real answer is available for this cycle; no brand conclusion can be drawn.', '');
  lines.push(zh ? '## 中性关键词测试' : '## Neutral keyword tests', '',
    (context.keywordManifest || state.keywords)?.selected?.length ? (context.keywordManifest || state.keywords).selected.map(x => x.keyword).map(cleanText).join(', ') : (zh ? '关键词未执行：冻结筛选未得到合格词。逐词来源及排除记录见 public-evidence.json 的 archiveContext.keywordManifest；没有补词或重测。' : 'Keyword tests were not run: the frozen selection yielded no eligible terms. Sources and exclusions remain in archiveContext.keywordManifest in public-evidence.json; no terms or runs were added.'), '',
    zh ? 'K valid 仅指首次 Attempt 的回答可分析，不是产品指标分母。各指标使用归档统计点的 samples、included 和 judgment；后续成功重试不替换此覆盖计数。' : 'K valid counts analyzable first-attempt answers only, not product metric denominators. Inspect archived metric samples, included flags and judgments. A later successful retry does not replace this coverage count.', '',
    zh ? '筛选记录、原文位置和排除理由见证据文件。每个同条件回答同时观察目标和其他实体，不把离线与联网差异解释为模型优劣。' : 'Selection records, exact quotes and exclusions are in the evidence file. Each answer observes the target and other entities under the same conditions; offline and online differences are not model rankings.', '');
  for (const probe of summary.probes.filter(x => x.probe?.kind === 'keyword_discovery')) {
    const keyword = keywordLabel(probe, state, context);
    const result = probe.keywordResult;
    lines.push(`### ${keyword ? cleanText(keyword) : (zh ? '冻结关键词缺失' : 'Frozen keyword unavailable')} · ${probe.probe.fingerprint.modelId}`, '',
      `keywordId: ${textValue(probe.probe.keywordId)} · runId: ${textValue(probe.probe.runId)} · probeId: ${textValue(probe.probe.id)}`, '',
      `${probe.probe.fingerprint.webSearchMode} · ${probe.probe.status} · firstAttemptId: ${textValue(probe.probe.firstAttemptId)}`, '',
      `analysisStatus: ${textValue(result?.analysisStatus)} · resultAttemptId: ${textValue(result?.attemptId)}`, '',
      ...['mentionJudgment', 'recommendationJudgment'].map(key => `- ${key}: ${textValue(result?.[key])}`), '',
      ...(context.documentation?.conflicts?.some(x => x.probeId === probe.probe.id) ? [zh ? '**本回答的唯一第一名判断存在冲突，不用于排名比较。** [冲突证据](../../../docs/known-issues.md)' : '**This answer has conflicting unique-first judgments; do not use it for rankings.** [Evidence](../../../docs/known-issues.md)', ''] : []),
      ...(result?.attemptId && result.attemptId !== probe.probe.firstAttemptId ? [zh ? '派生结果来自非首次 Attempt，不能将这些标签当作首次回答的判断。' : 'The derived result belongs to a later attempt; these labels are not judgments of the first answer.', ''] : []),
      ...(probe.mentions || []).map(x => `- ${cleanText(x.name)}: ${textValue(x.recommendation)} · mention: ${textValue(x.mentionEvidence?.quote)} · recommendation: ${textValue(x.recommendationEvidence?.quote)} · attemptId: ${textValue(x.attemptId)}`), '',
      `${zh ? '无法确认' : 'Uncertain'}: ${(result?.unknowns || []).map(cleanText).join('; ') || '—'}`, '',
      `[${zh ? '实际请求与原文证据' : 'Actual request and answer evidence'}](${evidenceLink})`, '');
    for (const attempt of probe.attempts) {
      lines.push(`#### Attempt ${cleanText(attempt.id)}`, '',
        `${textValue(attempt.status)} · ${zh ? '时间' : 'Observed at'}: ${textValue(attempt.startedAt || attempt.createdAt)} · ${attempt.id === probe.probe.firstAttemptId ? (zh ? '首次 Attempt' : 'First attempt') : (zh ? '后续 Attempt，不替换首次覆盖计数' : 'Later attempt, excluded from first-answer coverage')}`, '',
        `requestedSearch: ${textValue(attempt.requestParameters?.webSearchMode)} · used: ${textValue(attempt.providerSearch?.used)} · executionMode: ${textValue(attempt.providerSearch?.executionMode)}`, '',
        ...(attempt.providerSearch?.note ? [`${cleanText(attempt.providerSearch.note)}`, ''] : []),
        ...(attempt.errorCode || attempt.errorMessage ? [`${zh ? '错误' : 'Error'}: ${textValue(attempt.errorCode)} · ${textValue(attempt.errorMessage)}`, ''] : []),
        `finish_reason: ${textValue(attempt.rawProviderResponse?.choices?.[0]?.finish_reason)}`, '',
        ...rawAnswerLines(attempt, language), ...sourceLines(probe.evidence, probe.attempts, attempt, language));
    }
    if (!probe.attempts.length) lines.push(zh ? '尚无归档 Attempt 或原始回答。' : 'No attempt or original answer is archived.', '');
  }
  lines.push(zh ? '## 重复观察' : '## Repeated observations', '',
    `${state.measurementRuns.length} ${zh ? '次归档测量运行；数量不表示全部成功。只比较相同模型、语言、搜索与指纹条件。短期重复不代表长期趋势或因果效果。' : 'archived measurement runs; this count does not imply all succeeded. Compare only identical model, language, search and fingerprint conditions. Short repeats do not establish a long-term trend or a causal effect.'}`, '',
    ...state.measurementRuns.map(x => `- Run ${textValue(x.run.id)}: ${textValue(x.run.status)}`), '',
    ...summary.measurementD.models.map(x => `- D ${textValue(x.probeId)} · ${textValue(x.modelId)} · domainRecognition: ${textValue(x.domainRecognition)} · analysisStatus: ${textValue(x.analysisStatus)} · firstAttemptId: ${textValue(x.attemptId)} · resultAttemptId: ${textValue(x.resultAttemptId)}`), '');
  if (state.schedule) {
    const schedule = context.schedule;
    lines.push(zh ? '### 调度归档' : '### Schedule archive', '',
      `${zh ? '收集时任务状态（历史快照）' : 'Task status at collection (historical snapshot)'}: ${textValue(state.schedule.task?.status)}`, '',
      `${zh ? '最终任务归档状态' : 'Final archived task status'}: ${textValue(schedule?.finalTask?.status)} · nextRunAt: ${textValue(schedule?.finalTask?.nextRunAt)} · updatedAt: ${textValue(schedule?.finalTask?.updatedAt)}`, '',
      ...(schedule?.finalTask ? [`${cleanText(schedule.finalTaskSource.path)} · SHA-256: \`${schedule.finalTaskSource.sha256}\``, ''] : [zh ? '最终任务归档缺失，不将收集时状态作为当前状态。' : 'The final task archive is missing; collection status is not current status.', '']),
      ...(state.schedule.occurrences || []).map(x => `- Occurrence ${textValue(x.id)}: ${textValue(x.status)} · reason: ${textValue(x.reason)} · runId: ${textValue(x.runId)} · scheduledFor: ${textValue(x.scheduledFor)}`), '',
      zh ? 'Occurrence completed 表示调度记录结束；关联 Run 的 partial/failed 仍是部分失败或失败。' : 'Occurrence completed means scheduling finished; a linked partial/failed run remains partial or failed.', '');
  }
  lines.push(zh ? '## 产品截图' : '## Product screenshots', '');
  if (!screenshots.length) lines.push(zh ? '候选容器的真实截图尚未取得。此案例不能据此视为截图验收通过。' : 'Real candidate-container screenshots are not yet available. Screenshot acceptance has not passed.', '');
  for (const shot of screenshots) {
    if (shot === overview) continue;
    const alt = localized(shot.alt, language) || `${input.id} ${shot.view || (zh ? '产品截图' : 'product screenshot')}`;
    const conflicted = shot.view === 'keywords' && context.documentation?.conflicts?.length;
    if (conflicted) lines.push(`<details><summary>${zh ? '历史页面：当时页面展示，排名未通过核验' : 'Historical display: rankings were not validated'}</summary>`, '', zh ? '当时页面展示，排名未通过核验。图片与原始 Hash 保留，不能据图确定第一名。' : 'Rankings shown at capture time were not validated. The original image and hash are retained; the image cannot establish a winner.', '');
    lines.push(`![${cleanText(alt)}](../../../${shot.path})`, '', cleanText(localized(shot.caption, language) || alt), '', `${zh ? '截图时间' : 'Captured'}: ${shot.capturedAt}.`, '');
    if (conflicted) lines.push('</details>', '');
  }
  lines.push(zh ? '## 复核与重新测量' : '## Inspect or remeasure', '',
    `[${zh ? '案例配置' : 'Case configuration'}](./case.json) · [${zh ? '证据索引' : 'Evidence index'}](./evidence-index.json) · [${zh ? '公开证据包' : 'Public evidence bundle'}](${evidenceLink})`, '',
    `SHA-256: \`${evidenceHash}\``, '',
    ...(context.documentation?.cost ? [`${zh ? '历史案例费用（非本轮文档费用）' : 'Historical case cost (not this documentation update)'}: USD ${context.documentation.cost.usd.toFixed(8)} · ${context.documentation.cost.calls} ${zh ? '次调用' : 'calls'} · ${context.documentation.cost.tokens} Token.`, ''] : []),
    `[${zh ? '导出源码' : 'Export source'}](../../../examples/lib/export.mjs) · [${zh ? '候选版本与未发布状态' : 'Candidate provenance and unpublished status'}](../../../docs/releases/v0.2.0-rc.1.md)`, '',
    '```bash', `npm run examples:plan -- --case ${input.id}`, `npm run examples:replay -- --case ${input.id} --evidence examples/cases/${input.id}/public-evidence.json`, '```', '',
    zh ? '重新测量会收费：必须使用独立产品服务、冻结计划和显式 live 授权。阅读或导出不调用模型。' : 'Remeasurement incurs costs and requires an isolated product service, a frozen plan and explicit live authorization. Reading and exporting do not call models.', '',
    zh ? '## 限制与披露' : '## Limits and disclosure', '',
    input.sponsorDisclosure ? (zh ? 'NiubiStar 为 NiubiGEO 开源开发提供赞助。本例使用公开的共同测试规则，实际结果与失败均保留。' : 'NiubiStar sponsors NiubiGEO open-source development. This case uses the same public study rules; actual outcomes and failures are retained.') : (zh ? '仅作公开产品观察；收录不表示合作或背书关系。' : 'This is a public-product observation. Inclusion does not imply a partnership or endorsement.'), '',
    zh ? '模型描述不是已核实的市场事实。来源存在不证明页面内容正确，也不说明为何推荐。未知、缺失、解析失败与请求失败保持区分。可据此调查业务误述或来源内容，但不能断言差距由某次优化造成。' : 'Model descriptions are not verified market facts. A returned source does not establish that its content is correct or caused a recommendation. Unknown, missing, analysis failure and request failure remain separate. Use the evidence to investigate descriptions or sources, not to assert optimization caused a difference.', '',
    ...summary.issues.map(error => `- ${cleanText(error)}`), '');
  return lines.join('\n');
}

export async function publicScreenshot(screenshot) {
  const { trace, ...metadata } = screenshot;
  const archivedTrace = typeof trace === 'string' ? { status: 'private_archive', sha256: hash(await readFile(trace)), publicUrl: null } : null;
  return { ...metadata, trace: archivedTrace };
}

export async function exportCases(root) {
  const plan = await readJson(join(root, 'study-plan.json'));
  const results = await readJson(join(root, 'results.json'));
  const index = [];
  let screenshotIndex = [];
  try { screenshotIndex = await readJson(join(root, 'screenshot-index.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const input of plan.cases) {
    const state = results.cases.find(x => x.caseId === input.id);
    const context = await readCaseArchiveContext(root, state);
    const summary = summarizeCase(state, context);
    const redactions = [];
    const raw = { schemaVersion: 'public-case-evidence/v1', caseId: input.id, domain: input.domain, provenance: 'product_api_archive', studyPlanHash: results.studyPlanHash, state, archiveContext: context };
    const evidence = { ...sanitize(raw, '$', redactions), redactions, sourceSerializationHash: hash(JSON.stringify(raw)) };
    const path = join('examples/cases', input.id);
    await writeJson(join(path, 'public-evidence.json'), evidence);
    const sha256 = hash(await readFile(join(path, 'public-evidence.json')));
    const screenshots = await Promise.all(screenshotIndex.filter(x => x.caseId === input.id && x.candidateImageDigest).map(publicScreenshot));
    const rawAnswers = [
      ...summary.models.flatMap(x => x.attempts.map(attempt => ({ scope: 'initialD', modelRunId: x.modelRun.id, attemptId: attempt.id, selected: attempt.id === x.modelRun.currentAttemptId, sha256: typeof attempt.rawAnswer === 'string' ? hash(attempt.rawAnswer) : null }))),
      ...summary.probes.flatMap(x => x.attempts.map(attempt => ({ scope: x.probe.kind === 'keyword_discovery' ? 'K' : 'measurementD', runId: x.probe.runId, modelRunId: x.probe.modelRunId, probeId: x.probe.id, attemptId: attempt.id, firstAttempt: attempt.id === x.probe.firstAttemptId, sha256: typeof attempt.rawAnswer === 'string' ? hash(attempt.rawAnswer) : null }))),
    ];
    await writeJson(join(path, 'evidence-index.json'), { schemaVersion: 'case-evidence-index/v1', caseId: input.id, path: './public-evidence.json', sha256, redactions, screenshotCount: screenshots.length, rawAnswers });
    const publicSummary = { ...summary, screenshots };
    delete publicSummary.models; delete publicSummary.probes;
    await writeJson(join(path, 'result-summary.json'), publicSummary);
    await writeFile(join(path, 'README.md'), caseMarkdown(input, summary, state, 'en', plan, sha256, screenshots, context));
    await writeFile(join(path, 'README.zh-CN.md'), caseMarkdown(input, summary, state, 'zh', plan, sha256, screenshots, context));
    index.push({ ...input, ...publicSummary });
  }
  await writeJson('examples/case-index.json', index);
  await writeJson(join('assets/screenshots', archiveSegment(plan.version), 'index.json'), index.flatMap(item => item.screenshots));
  return { casesDocumented: index.length, casesAttempted: index.filter(x => x.d.attempted > 0).length, casesWithValidAnswers: index.filter(x => x.d.valid > 0).length };
}
