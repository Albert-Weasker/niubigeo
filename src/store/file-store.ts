import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { AuditMetrics, AuditRun, GeoGapAnalysis, PromptRun, ReportBundle } from "../core/types.js";
import { slugify } from "../utils/domain.js";
import { sha256 } from "../utils/hash.js";
import { ReportBuilder } from "../report/report-builder.js";
import { ReportModelBuilder } from "../report/report-model.js";

const DEBUG_PERSISTENCE_KEYS = new Set(["rawJson", "rawJsonPath", "tokenUsage", "costUsd", "latencyMs"]);

function publicReportData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => publicReportData(item));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (DEBUG_PERSISTENCE_KEYS.has(key)) continue;
    output[key] = publicReportData(item);
  }
  return output;
}

export class FileStore {
  constructor(private readonly rootDir: string) {}

  auditDir(auditId: string): string {
    return resolve(this.rootDir, auditId);
  }

  async saveRawJson(auditId: string, name: string, value: unknown): Promise<string> {
    const rawDir = join(this.auditDir(auditId), "raw");
    await mkdir(rawDir, { recursive: true });
    const json = JSON.stringify(value, null, 2);
    const fileName = `${slugify(name)}-${sha256(json).slice(0, 10)}.json`;
    const path = join(rawDir, fileName);
    await writeFile(path, json);
    return path;
  }

  async savePromptRunRaw(auditId: string, run: PromptRun): Promise<string> {
    return this.saveRawJson(auditId, run.id, run.result?.rawJson ?? { error: run.error });
  }

  async saveAudit(
    audit: AuditRun,
    metrics: AuditMetrics,
    gaps: GeoGapAnalysis,
    reportBuilder = new ReportBuilder(),
    reportModelBuilder = new ReportModelBuilder(),
  ): Promise<ReportBundle> {
    const runDir = this.auditDir(audit.id);
    await mkdir(runDir, { recursive: true });

    const reportModel = reportModelBuilder.build(audit, metrics, gaps);
    const markdown = reportBuilder.renderMarkdown(reportModel);
    const html = reportBuilder.renderHtml(reportModel, markdown);
    const promptCsv = reportBuilder.renderPromptCsv(metrics);
    const citationCsv = reportBuilder.renderCitationCsv(audit);
    const keywordCsv = reportBuilder.renderKeywordCsv(metrics);

    const auditJson = join(runDir, "audit.json");
    const reportJson = join(runDir, "report.json");
    const reportMd = join(runDir, "report.md");
    const reportHtml = join(runDir, "report.html");
    const promptCsvPath = join(runDir, "prompts.csv");
    const citationCsvPath = join(runDir, "citations.csv");
    const keywordCsvPath = join(runDir, "keywords.csv");

    await writeFile(auditJson, JSON.stringify(publicReportData(audit), null, 2));
    await writeFile(
      reportJson,
      JSON.stringify(
        publicReportData({
          audit,
          metrics,
          generatedAt: reportModel.generatedAt,
        }),
        null,
        2,
      ),
    );
    await writeFile(reportMd, markdown);
    await writeFile(reportHtml, html);
    await writeFile(promptCsvPath, promptCsv);
    await writeFile(citationCsvPath, citationCsv);
    await writeFile(keywordCsvPath, keywordCsv);

    return {
      runDir,
      auditJson,
      reportJson,
      reportMd,
      reportHtml,
      promptCsv: promptCsvPath,
      citationCsv: citationCsvPath,
      keywordCsv: keywordCsvPath,
    };
  }
}
