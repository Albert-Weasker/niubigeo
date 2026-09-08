import { releaseReadme } from "./lib/release-readme.mjs";
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { caseMarkdown, summarizeCase } from '../examples/lib/export.mjs';

// Documentation only: inspect archives, never import an executor.
const json = async path => JSON.parse(await readFile(path, 'utf8'));
if (process.argv.includes('--readme-only')) {
  const cases = await json('examples/case-index.json');
  if (cases.some(item => item.d.valid < 1)) throw new Error('Case coverage does not support the README claim.');
  const coverage = { cases: cases.length, k: cases.filter(item => item.k.attempted > 0).length };
  for (const zh of [false, true]) {
    await writeFile(zh ? 'README.zh-CN.md' : 'README.md', releaseReadme(zh, coverage));
  }
  console.log(JSON.stringify({ readmes: 2, coverage, newInferenceCalls: 0 }));
  process.exit(0);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = 'validation/release-v0.2.0-rc.1';
const plan = await json('examples/study-plan.json');
const index = await json('examples/case-index.json');
const conflicts = (await json(`${root}/semantic-evidence-audit.json`)).conflicts;
const ledger = (await json(`${root}/provider-ledger.json`)).entries;
const shots = await json('assets/screenshots/v0.2.0-rc.1/index.json');
const records = new Map();
for (const item of index) records.set(item.id, await json(`examples/cases/${item.id}/public-evidence.json`));
const text = v => String(v ?? '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('|').join('&#124;').split('\n').join(' ');
const models = e => e.state.recognitionRuns.flatMap(r => r.models);
const probes = e => e.state.measurementRuns.flatMap(r => r.probes);
const attempts = e => [...models(e), ...probes(e)].flatMap(x => x.attempts);
const anchor = x => `conflict-${x.probeId}-${x.field.toLowerCase()}`;
const filename = zh => zh ? 'README.zh-CN.md' : 'README.md';
const caseLink = (id, zh, prefix = 'examples/') => `${prefix}cases/${id}/${filename(zh)}`;
const quoteLink = (id, attempt, zh, prefix = 'examples/') => `${caseLink(id, zh, prefix)}#attempt-${attempt}`;

// Editorial observations of saved answers, not product rules or expected outcomes.
const observations = [
  ['一个模型描述为游戏娱乐，另一个描述为 GitHub 增长，第三个未识别。', 'One model described gaming, another GitHub growth, and a third did not recognize the domain.'],
  ['均描述前端部署；三轮关键词观察中保留三条解析失败。', 'All described frontend deployment; three keyword answers failed analysis across three repeats.'],
  ['模型提到 Firebase 替代关系；未产生合格的中性关键词测试。', 'Models described a Firebase alternative; no eligible neutral keyword test was established.'],
  ['Feature Flags 回答返回真实引用；三轮都保留部分失败。', 'Feature Flags answers returned actual citations; all three repeats remain partial.'],
  ['模型强调错误追踪；Datadog、New Relic 等名单随模型不同。', 'Models emphasized error tracking, naming different lists including Datadog and New Relic.'],
  ['问题追踪与产品开发描述不同；一项第一名判断冲突。', 'Descriptions ranged from issue tracking to product development; one first-place field conflicts.'],
  ['在线设计描述相近；关键词回答有两项第一名冲突。', 'Online-design descriptions were similar; the keyword answer has two first-place conflicts.'],
  ['模型分别强调笔记、工作空间与协作，竞争对象不一致。', 'Models emphasized notes, workspace and collaboration, naming different competitors.'],
  ['模型强调 CDN 与安全；AWS 相关名称未统一为同一实体。', 'Models emphasized CDN and security; AWS-related names are not resolved to one entity.'],
  ['模型描述浏览器 IDE；关键词结果含两项第一名冲突。', 'Models described a browser IDE; keyword results contain two first-place conflicts.'],
  ['域名回答描述代码托管；“协作”回答的第一名字段冲突。', 'Domain answers described code hosting; the collaboration answer has a conflicting first-place field.'],
  ['模型均提到 DevOps；关键词解析失败并非品牌未出现。', 'Models described DevOps; a keyword analysis failure is not a brand absence.'],
  ['模型列出 Kubernetes 等对象，但这种关联不等于替代关系已核实。', 'Models named Kubernetes and other objects; that does not verify a substitution relationship.'],
  ['Prototyping 联网回答明确推荐 Figma，另一关键词解析失败。', 'An online Prototyping answer explicitly recommended Figma; another keyword failed analysis.'],
  ['无代码建站描述相近；Wix、Webflow 等名单不一致。', 'No-code building descriptions were similar; lists including Wix and Webflow differed.'],
  ['模型描述可视化建站，一次回答还明确写了 CMS 与托管。', 'Models described visual website building; one also explicitly described CMS and hosting.'],
  ['模型分别强调数据库、电子表格和协作；未执行关键词测试。', 'Models emphasized databases, spreadsheets and collaboration; keyword tests were not run.'],
  ['回答混用 Make 与 Integromat 等名称，不能直接视为不同公司。', 'Answers used names such as Make and Integromat; they cannot simply be counted as different companies.'],
  ['一个联网回答没列竞争对象；“开源软件”关键词存在第一名冲突。', 'One online answer named no competitors; the open-source-software keyword has a first-place conflict.'],
  ['模型强调隐私分析；共同列出 Google Analytics 和 Matomo。', 'Models emphasized privacy-focused analytics and all named Google Analytics and Matomo.'],
];
const coverage = {cases:index.length,validD:index.filter(x=>x.d.valid>0).length,k:index.filter(x=>x.k.attempted>0).length,partial:index.filter(x=>x.status==='partial').length,failures:[...records.values()].flatMap(attempts).filter(a=>a.status==='analysis_failed').length};
const cost = {calls:ledger.length,usd:Number(ledger.reduce((n,a)=>n+(a.costUsd||0),0).toFixed(8)),tokens:ledger.reduce((n,a)=>n+(a.tokens?.total||0),0)};
function table(zh,prefix) {
  return [zh?'| ID | 域名 | 实际测试范围 | 一句话观察或限制 | 详情 |':'| ID | Domain | Actual scope | Observation or limitation | Details |','|---|---|---|---|---|',...index.map((x,i)=>`| ${x.id} | ${x.domain} | ${x.k.attempted ? `D + K (${x.k.valid}/${x.k.attempted} ${zh?'条 K 可分析':'K answers analyzable'})` : (zh?'仅域名认知；关键词未执行':'Domain only; keyword tests not run')} | ${observations[i][zh?0:1]} | [${zh?'阅读':'Read'}](${caseLink(x.id,zh,prefix)}) |`)];
}
function coverageLine(zh) {
  return zh ? `${coverage.cases} 个域名都有可分析的 D 回答；其中 ${coverage.k} 例实际执行 K，${coverage.partial} 例部分完成，${coverage.failures} 条回答分析失败。${new Set(conflicts.map(x=>x.caseId)).size} 例的 ${conflicts.length} 项第一名字段存在冲突，不用于排名。这些是不同统计口径，不是“全部成功率”。` : `All ${coverage.validD} domains have analyzable D answers; ${coverage.k} cases actually ran K, ${coverage.partial} cases are partial, and ${coverage.failures} answers failed analysis. ${conflicts.length} first-place fields across ${new Set(conflicts.map(x=>x.caseId)).size} cases conflict and are excluded from rankings. These are different scopes, not an overall success rate.`;
}
for(let i=0;i<index.length;i++){
  const item=index[i],e=records.get(item.id),ids=new Set(attempts(e).map(a=>a.id)),calls=ledger.filter(a=>ids.has(a.attemptId));
  const context={...e.archiveContext,documentation:{observation:{zh:observations[i][0],en:observations[i][1]},conflicts:conflicts.filter(c=>c.caseId===item.id),cost:{calls:calls.length,usd:calls.reduce((n,a)=>n+(a.costUsd||0),0),tokens:calls.reduce((n,a)=>n+(a.tokens?.total||0),0)}}};
  const summary=summarizeCase(e.state,context);
  for(const language of ['en','zh']) await writeFile(`examples/cases/${item.id}/${filename(language==='zh')}`,caseMarkdown(item,summary,e.state,language,plan,sha(await readFile(`examples/cases/${item.id}/public-evidence.json`)),shots.filter(s=>s.caseId===item.id),context));
}
for(const zh of [false,true]){
  await writeFile(filename(zh), releaseReadme(zh, coverage));
  const original=await readFile(`examples/${filename(zh)}`,'utf8'),parts=original.split('<!-- CASE_INDEX -->');
  let content=parts[0]+'<!-- CASE_INDEX -->\n\n'+coverageLine(zh)+'\n\n'+`[${zh?'冲突与失败索引':'Conflict and failure index'}](../docs/known-issues.md)`+'\n\n'+table(zh,'').join('\n')+'\n\n<!-- CASE_INDEX -->'+parts.at(-1);
  content=content.split('The same Markdown generates the public website.').join('Markdown is the reading interface; no case service is needed.').split('website generation').join('Markdown rendering');
  await writeFile(`examples/${filename(zh)}`,content);
}
const issues=['# 已知问题 / Known Issues','','**状态：未修复，发布仍为 blocked / Unresolved; release remains blocked.**','','以下索引来自已经保存的回答及语义复核，不修改任何原始名次、结果或统计点。链接指向仓库 Markdown 原文和脱敏响应；本地文件不冒充公开下载地址。','','This index references archived answers and the read-only semantic audit. No rankings, responses or metric points were changed. Repository files are prepared locally, not yet a published evidence release.','','## 唯一第一名冲突 / Conflicting unique-first fields','','同一回答将多个对象标记为 unique，而归档仍记录 adjudicable 的 0/1。该指标存在一致性冲突，暂不用于排名比较。不是已证明目标不在第一位，也不解释为并列第一。','','Multiple objects are marked unique in one answer while the archive records an adjudicable 0/1. These fields are excluded from ranking comparisons, not interpreted as a verified loss or a tie.','','| 案例 / Case | 字段 / Field | 模型 / Model · Run | 冲突对象 / Records | 证据 / Evidence |','|---|---|---|---|---|'];
for(const c of conflicts){const p=probes(records.get(c.caseId)).find(p=>p.probe.id===c.probeId),a=p.attempts.find(a=>c.attemptIds.includes(a.id));if(sha(a.rawAnswer)!==c.rawAnswerHash)throw new Error('Conflict source hash differs');issues.push(`| ${c.caseId} | ${c.field} | ${p.probe.fingerprint.modelId}<br>${c.runId} | ${c.entities.map(e=>text(e.name)).join(', ')} | [${c.uniqueCount} unique](#${anchor(c)}) |`);}
for(const c of conflicts)issues.push('',`<a id="${anchor(c)}"></a>`,`### ${c.caseId} · ${c.field}`,'',`Probe: \`${c.probeId}\` · Attempt: ${c.attemptIds.map(a=>'`'+a+'`').join(', ')}`,'',`[中文原文](${quoteLink(c.caseId,c.attemptIds[0],true,'../examples/')}) · [Original answer](${quoteLink(c.caseId,c.attemptIds[0],false,'../examples/')}) · [Payload](../examples/cases/${c.caseId}/public-evidence.json)`,'',`Raw answer SHA-256: \`${c.rawAnswerHash}\``,'',`影响 / Impact: ${c.affectedPoints.map(p=>`${p.id}: ${p.numerator}/${p.denominator}, value=${p.value}`).join('; ')}. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.`,'','**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。');
issues.push('','## 分析失败 / Analysis failures','','模型已返回内容但本地分析失败，不等于模型不认识。原文和原错误均保留。These models returned content but analysis failed; this is not non-recognition. Original answers and errors remain intact.','','| 案例 / Case | 模型 / Model | 时间 UTC / Time | 原始回答 / Attempt | 错误 / Error |','|---|---|---|---|---|');
for(const [id,e] of records)for(const a of attempts(e).filter(a=>a.status==='analysis_failed'))issues.push(`| ${id} | ${a.requestParameters.model} | ${a.startedAt} | [${a.id}](${quoteLink(id,a.id,false,'../examples/')}) | ${text(a.errorCode||a.errorMessage||a.status)} |`);
issues.push('','## 其他门禁 / Other gates','','此前 npm test：212 通过、0 失败、10 跳过，来源为发布记录中的既有周期，未在本次文档整理中重跑。十项跳过是缺少旧归档，不是十次成功。完整失败案例的真实验收仍未证明，Fixture 不能替代。','','The earlier npm test cycle recorded 212 passes, zero failures and ten skipped legacy archives. It was not rerun for this documentation update. Real full-failure-case acceptance remains unproven; fixtures are not a substitute.','','发布提交、永久公开证据和实际 GitHub 主题验收仍缺失；本地预览不代表 GitHub 验收。本轮不新增推理、不消耗历史剩余预算。Release commits, permanent public evidence and actual GitHub theme acceptance remain pending. Local rendering is not GitHub acceptance. This update adds no inference and does not spend remaining historical budget.','','[完整限制 / Full limitations](limitations.md) · [发布记录 / Release record](releases/v0.2.0-rc.1.md)','');
await writeFile('docs/known-issues.md',issues.join('\n'));
console.log(JSON.stringify({readmes:2,caseDocuments:index.length*2,conflicts:conflicts.length,coverage,historicalCost:cost,newInferenceCalls:0}));
