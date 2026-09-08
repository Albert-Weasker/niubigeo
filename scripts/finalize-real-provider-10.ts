import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProductMeasurementStatsService } from "../src/product/measurements/measurement-stats.js";
import { ProductMeasurementFileStore } from "../src/product/measurements/measurement-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { readJson, writeJson, type ProviderLedger } from "./real-provider-10-support.js";

type CaseReference = { caseId: string; domain: string; language: "zh" | "en"; projectId: string; baselineId: string; watchSetId: string; competitorDomain: string | null; competitorMissingReason: string | null; keyword: string | null; keywordMissingReason: string | null; manualRunId?: string; scheduledRunId?: string; scheduledTaskId?: string };
type CaseIndex = { cycleId: string; cases: CaseReference[] };

const root = process.cwd();
const examplesRoot = join(root, "examples", "real-provider-10");
const cycleId = process.env.NIUBIGEO_REAL_PROVIDER_CYCLE || "real-provider-10-2026-09-07-final";
const validationRoot = join(root, "validation", cycleId);
const productDataRoot = join(validationRoot, "product-data");
const indexPath = join(validationRoot, "case-index.json");
const ledgerPath = join(validationRoot, "provider-ledger.json");

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function now(): string { return new Date().toISOString(); }
function markdown(value: string | null | undefined): string { return value || "无法确认"; }
function dataPath(path: string): string { return relative(root, path); }
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function payloadAtPath(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  let index = 0;
  while (index < path.length) {
    const character = path[index];
    if (character === ".") { index += 1; continue; }
    if (character === "[") {
      const end = path.indexOf("]", index + 1);
      if (end === -1 || !Array.isArray(current)) return undefined;
      const numberText = path.slice(index + 1, end);
      if (!numberText || [...numberText].some((value) => value < "0" || value > "9")) return undefined;
      current = current[Number(numberText)];
      index = end + 1;
      continue;
    }
    const dot = path.indexOf(".", index);
    const bracket = path.indexOf("[", index);
    const ends = [dot, bracket].filter((value) => value !== -1);
    const end = ends.length ? Math.min(...ends) : path.length;
    const key = path.slice(index, end);
    if (!key || !isObject(current)) return undefined;
    current = current[key];
    index = end;
  }
  return current;
}

async function resultForCase(input: { case: CaseReference; projects: ProductProjectService; recognition: ProductRecognitionFileStore; measurements: ProductMeasurementFileStore; stats: ProductMeasurementStatsService; ledger: ProviderLedger }) {
  const project = await input.projects.get(input.case.projectId);
  const recognitionRuns = await input.recognition.listRuns(input.case.projectId);
  const recognition = [];
  let citationsVerified = 0;
  let citationsInvalid = 0;
  for (const run of recognitionRuns) {
    const modelRows = [];
    for (const modelRun of await input.recognition.listModelRuns(input.case.projectId, run.id)) {
      const attempts = await input.recognition.listAttempts(input.case.projectId, run.id, modelRun.id);
      const archive = modelRun.currentAttemptId ? await input.recognition.readArchive(input.case.projectId, run.id, modelRun.id, modelRun.currentAttemptId) : null;
      const attempt = attempts.find((item) => item.id === modelRun.currentAttemptId) || null;
      const citationChecks = archive?.providerCitations.map((citation) => {
        const valid = payloadAtPath(attempt?.rawProviderResponse, citation.providerPayloadPath) === citation.url;
        if (valid) citationsVerified += 1;
        else citationsInvalid += 1;
        return { citationId: citation.id, url: citation.url, providerPayloadPath: citation.providerPayloadPath, valid };
      }) || [];
      modelRows.push({
        modelRunId: modelRun.id,
        modelId: modelRun.modelSnapshot.modelId,
        webSearchMode: modelRun.modelSnapshot.webSearchMode,
        recognitionMode: modelRun.recognitionMode,
        status: modelRun.status,
        attemptId: attempt?.id || null,
        rawAnswer: attempt?.rawAnswer || null,
        rawAnswerHash: attempt?.rawAnswer ? hash(attempt.rawAnswer) : null,
        rawProviderResponsePath: attempt ? dataPath(join(productDataRoot, "projects", input.case.projectId, "recognition-runs", run.id, "model-runs", modelRun.id, "attempts", `${attempt.id}.json`)) : null,
        tokenUsage: attempt?.tokenUsage || null,
        costUsd: attempt?.costUsd ?? null,
        providerSearch: attempt?.providerSearch || null,
        recognition: archive ? {
          recognitionResultId: archive.result.id,
          analysisStatus: archive.result.analysisStatus,
          domainRecognition: archive.result.domainRecognition,
          recognizedBrand: archive.result.recognizedBrand,
          businessDescription: archive.result.businessDescription,
          productCategory: archive.result.productCategory,
          unknowns: archive.result.unknowns,
          competitors: archive.competitors,
          brandKeywords: archive.brandKeywords,
          competitorKeywords: archive.competitorKeywords,
          providerCitations: archive.providerCitations,
          answerMentionedUrls: archive.answerMentionedUrls,
          claimCitationLinks: archive.claimCitationLinks,
          citationChecks,
        } : null,
      });
    }
    recognition.push({ runId: run.id, status: run.status, createdAt: run.createdAt, completedAt: run.completedAt || null, modelRuns: modelRows });
  }
  const measurementRuns = await input.measurements.listRuns(input.case.projectId);
  const measurementDetails = [];
  for (const run of measurementRuns) {
    const models = await input.measurements.listModelRuns(input.case.projectId, run.id);
    const modelRows = [];
    for (const model of models) {
      const probes = await input.measurements.listProbes(input.case.projectId, run.id, model.id);
      const probeRows = [];
      for (const probe of probes) {
        const detail = await input.measurements.probeDetail(input.case.projectId, run.id, model.id, probe.id);
        probeRows.push({ probeRunId: probe.id, kind: probe.kind, subjectDomain: probe.subjectDomain || null, keyword: probe.keyword || null, status: probe.status, attempts: detail?.attempts || [], result: detail?.domainResult || detail?.keywordResult || null, citations: detail?.evidence.providerCitations || [], answerMentionedUrls: detail?.evidence.answerMentionedUrls || [] });
      }
      modelRows.push({ modelRunId: model.id, modelId: model.modelSnapshot.modelId, webSearchMode: model.modelSnapshot.webSearchMode, status: model.status, probes: probeRows });
    }
    measurementDetails.push({ run, modelRuns: modelRows });
  }
  const snapshot = await input.stats.build(input.case.projectId);
  const ledgerRows = input.ledger.entries.filter((entry) => entry.caseId === input.case.caseId);
  return {
    schemaVersion: "real-provider-10-public-result/v1",
    generatedAt: now(),
    case: input.case,
    project: { id: project.id, domain: project.normalizedDomain, name: project.name, language: project.defaultLanguage },
    recognition,
    measurement: { runs: measurementDetails, statsSnapshot: snapshot },
    providerLedger: ledgerRows,
    evidenceAudit: { providerCitationVerified: citationsVerified, providerCitationInvalid: citationsInvalid, offlineProviderCitationCount: recognition.flatMap((run) => run.modelRuns).filter((model) => model.webSearchMode === "off").reduce((total, model) => total + (model.recognition?.providerCitations.length || 0), 0) },
  };
}

function caseMarkdown(result: Awaited<ReturnType<typeof resultForCase>>): string {
  const recognitionModels = result.recognition.flatMap((run) => run.modelRuns);
  const manual = result.measurement.runs.filter((run) => run.run.source === "manual");
  const scheduled = result.measurement.runs.filter((run) => run.run.source === "scheduled");
  const citationCount = result.evidenceAudit.providerCitationVerified;
  const ledger = result.providerLedger;
  const knownCost = ledger.reduce((sum, entry) => sum + (entry.actualCostUsd ?? 0), 0);
  const unknownCost = ledger.filter((entry) => entry.actualCostUsd === null).length;
  const modelRows = recognitionModels.map((model) => `| ${model.modelId} | ${model.webSearchMode === "off" ? "不联网" : "OpenRouter 托管的 Provider 原生联网"} | ${model.status} | ${markdown(model.recognition?.recognizedBrand.value)} | ${markdown(model.recognition?.businessDescription.value)} |`).join("\n");
  const competitorRows = recognitionModels.flatMap((model) => model.recognition?.competitors || []).map((item) => `- ${item.name}${item.domain ? ` · ${item.domain}` : " · 域名未确认"}`);
  const keywordRows = recognitionModels.flatMap((model) => model.recognition?.brandKeywords || []).map((item) => `- ${item.keyword}`);
  const citations = recognitionModels.flatMap((model) => model.recognition?.providerCitations || []).map((item) => `- ${item.title} · ${item.url}`);
  return `# ${result.case.caseId} · ${result.case.domain}\n\n## 测量对象\n\n- 域名：\`${result.case.domain}\`\n- 输出语言：${result.case.language}\n- 测试周期：${result.case.projectId}\n- 两次实际测量：手动 ${manual.length} 次；定时 ${scheduled.length} 次。\n\n## 模型本次认知\n\n| 模型 | 实际联网方式 | 状态 | 识别品牌 | 业务描述 |\n| --- | --- | --- | --- | --- |\n${modelRows || "| 无 | 无 | 无 | 无法确认 | 无法确认 |"}\n\n模型的描述只代表本次 Provider API 回答，不代表消费端结果或市场事实。\n\n## 竞争对象与关键词\n\n### 实际返回的竞争对象\n\n${competitorRows.length ? competitorRows.join("\n") : "本次没有带明确域名的竞争对象进入冻结范围。"}\n\n### 本轮中性关键词\n\n${result.case.keyword ? `\`${result.case.keyword}\`` : `未选择：${result.case.keywordMissingReason || "发现阶段没有合格词"}`}\n\n### 实际返回的品牌关键词\n\n${keywordRows.length ? keywordRows.join("\n") : "本次没有返回品牌关键词。"}\n\n## 两轮执行与图表数据\n\n- 手动运行：${manual.map((item) => `${item.run.id} (${item.run.status})`).join("；") || "无"}\n- 定时运行：${scheduled.map((item) => `${item.run.id} (${item.run.status})`).join("；") || "无"}\n- 图表点级数据： [机器可读结果](./results/${result.case.caseId}.public.json) 中的 \`measurement.statsSnapshot.points\`。这些点只来自已归档 Probe，不会触发新的模型调用。\n\n## 来源\n\nProvider Citation（已验证 Payload 路径）：${citationCount}\n\n${citations.length ? citations.join("\n") : "本次没有可验证的 Provider Citation。回答正文中的普通 URL 与 Provider Citation 分开保存。"}\n\n## 原始回答与不足\n\n- 每个模型运行的 \`rawAnswer\`、尝试 ID、原始响应存储路径、结构化整理结果均在机器可读结果中。\n- 本案例共记录 ${ledger.length} 次模型推理；已知费用 ${knownCost.toFixed(6)} USD，费用未知的调用 ${unknownCost} 次。\n- unknown、未推荐、无竞品、无来源属于模型本次业务结果，不等于程序失败。\n\n## 截图\n\n![概览](./screenshots/${result.case.caseId}-overview.png)\n\n![趋势](./screenshots/${result.case.caseId}-trends.png)\n\n![证据](./screenshots/${result.case.caseId}-evidence.png)\n`;
}

async function main(): Promise<void> {
  const index = await readJson<CaseIndex>(indexPath);
  const ledger = await readJson<ProviderLedger>(ledgerPath);
  const projectStore = new ProductProjectFileStore(productDataRoot);
  const projects = new ProductProjectService(projectStore);
  const measurements = new ProductMeasurementFileStore(projectStore);
  const recognition = new ProductRecognitionFileStore(projectStore);
  const stats = new ProductMeasurementStatsService(projects, measurements);
  const results = [];
  for (const entry of index.cases) {
    const result = await resultForCase({ case: entry, projects, recognition, measurements, stats, ledger });
    results.push(result);
    await writeJson(join(examplesRoot, "results", `${entry.caseId}.public.json`), result);
    await mkdir(join(examplesRoot, "cases"), { recursive: true });
    await writeFile(join(examplesRoot, "cases", `${entry.caseId}-${entry.domain.split(".")[0] || "case"}.md`), caseMarkdown(result));
  }
  const totalKnownCost = ledger.entries.reduce((sum, entry) => sum + (entry.actualCostUsd ?? 0), 0);
  const unknownCost = ledger.entries.filter((entry) => entry.actualCostUsd === null).length;
  const acceptance = {
    cycleId: index.cycleId,
    generatedAt: now(),
    phase5Status: "blocked",
    phase6Allowed: "no",
    cases: results.map((result) => ({ caseId: result.case.caseId, domain: result.case.domain, discovery: result.recognition.length > 0, manual: result.measurement.runs.some((run) => run.run.source === "manual"), scheduled: result.measurement.runs.some((run) => run.run.source === "scheduled"), providerCitations: result.evidenceAudit.providerCitationVerified, coverageGap: result.case.competitorMissingReason || result.case.keywordMissingReason || null })),
    provider: {
      inferenceRequests: ledger.entries.length,
      byPurpose: Object.fromEntries(["discovery", "manual_measurement", "scheduled_measurement"].map((purpose) => [purpose, ledger.entries.filter((entry) => entry.purpose === purpose).length])),
      knownCostUsd: totalKnownCost,
      unknownCostEntryCount: unknownCost,
      requestCap: ledger.requestLimit,
      costCapUsd: ledger.costLimitUsd,
      capExceeded: ledger.entries.length > ledger.requestLimit || totalKnownCost > ledger.costLimitUsd,
    },
    evidence: {
      citationsVerified: results.reduce((sum, result) => sum + result.evidenceAudit.providerCitationVerified, 0),
      citationsInvalid: results.reduce((sum, result) => sum + result.evidenceAudit.providerCitationInvalid, 0),
      offlineCitationCount: results.reduce((sum, result) => sum + result.evidenceAudit.offlineProviderCitationCount, 0),
    },
    statusReason: "Final status is determined only after the separate real-browser replay and the frozen replay test have run.",
  };
  await writeJson(join(validationRoot, "acceptance-report.json"), acceptance);
  const indexMarkdown = `# 10 组真实 Provider 案例\n\n本索引记录固定域名在本轮两次实际测量中的 Provider API 观察。它不代表消费端网页或真人地区结果。\n\n${results.map((result) => `- [${result.case.caseId} · ${result.case.domain}](./cases/${result.case.caseId}-${result.case.domain.split(".")[0] || "case"}.md)`).join("\n")}\n`;
  await writeFile(join(examplesRoot, "README.zh-CN.md"), indexMarkdown);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
