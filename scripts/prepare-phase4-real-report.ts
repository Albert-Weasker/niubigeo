import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../src/product/configuration/configuration-store.js";
import { ProductModelSelectionService } from "../src/product/configuration/model-selection-service.js";
import type { ProductModelCatalog } from "../src/product/configuration/model-selection-schema.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductRecognitionFileStore } from "../src/product/recognition/recognition-store.js";
import { RecognitionReportService } from "../src/product/reports/report-service.js";
import { RecognitionReportFileStore } from "../src/product/reports/report-store.js";

const root = process.cwd();
const validationRoot = join(root, "validation", "rebuild-phase-4-2026-09-07");
const phaseThreeRoot = join(root, "validation", "rebuild-phase-3-2026-09-06");
const referencePath = join(phaseThreeRoot, "niubistar-live-current-path.txt");
const copyRoot = join(validationRoot, "real-provider-derived-final");
const copiedProductData = join(copyRoot, "product-data");

type FileHash = { path: string; sha256: string; bytes: number };

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function filesAt(rootPath: string): Promise<FileHash[]> {
  const output: FileHash[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const current = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(current);
        continue;
      }
      if (!entry.isFile()) continue;
      const content = await readFile(current, "utf8");
      output.push({ path: relative(rootPath, current), sha256: hash(content), bytes: Buffer.byteLength(content) });
    }
  };
  await visit(rootPath);
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

const staticCatalog: ProductModelCatalog = {
  async list() {
    return [];
  },
};

async function main(): Promise<void> {
  const sourceRoot = (await readFile(referencePath, "utf8")).trim();
  const sourceProductData = join(sourceRoot, "product-data");
  if (!(await stat(sourceProductData)).isDirectory()) throw new Error("Phase 3 real provider product data is unavailable.");

  const sourceBefore = await filesAt(sourceProductData);
  await mkdir(copyRoot, { recursive: true });
  await cp(sourceProductData, copiedProductData, { recursive: true, errorOnExist: true });

  const projectStore = new ProductProjectFileStore(copiedProductData);
  const projects = new ProductProjectService(projectStore);
  const configuration = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configuration, staticCatalog);
  const baselines = new ProductBaselineService(projects, selections, configuration);
  const recognition = new ProductRecognitionFileStore(projectStore);
  const reports = new RecognitionReportService(projects, baselines, recognition, new RecognitionReportFileStore(projectStore));
  const projectList = await projects.list();
  const reportsCreated: Array<Record<string, unknown>> = [];

  for (const project of projectList) {
    const runs = await recognition.listRuns(project.id);
    for (const run of runs) {
      if (run.status === "queued" || run.status === "running") continue;
      const report = await reports.create(project.id, run.id);
      reportsCreated.push({
        projectId: project.id,
        domain: project.normalizedDomain,
        runId: run.id,
        baselineId: run.baselineId,
        reportId: report.reportId,
        reportRevision: report.reportRevision,
        contentStatus: report.contentStatus,
        sourceAttemptMap: report.sourceAttemptMap,
        models: report.models.map((model) => ({
          modelRunId: model.modelRunId,
          model: model.modelId,
          recognitionMode: model.recognitionMode,
          executionPath: model.webSearch.label,
          state: model.state,
          sourceAttemptId: model.sourceAttemptId,
          rawAnswerHash: model.rawAnswer === null ? null : hash(model.rawAnswer),
          recognitionResultId: model.sourceHashes.find((entry) => entry.source === "archive")?.id || null,
          competitorCount: model.competitors === null ? null : model.competitors.length,
          brandKeywordCount: model.brandKeywords === null ? null : model.brandKeywords.length,
          competitorKeywordCount: model.competitorKeywords === null ? null : model.competitorKeywords.length,
          providerCitationCount: model.providerCitations === null ? null : model.providerCitations.length,
          answerMentionedUrlCount: model.answerMentionedUrls === null ? null : model.answerMentionedUrls.length,
          providerCitationPathsVerified: model.state !== "evidence_integrity_error",
          rawAnswerAvailable: model.rawAnswer !== null,
        })),
      });
    }
  }

  const sourceAfter = await filesAt(sourceProductData);
  const output = {
    schemaVersion: "phase4-real-archive-display/v1",
    generatedAt: new Date().toISOString(),
    providerCallsMadeByPhase4: 0,
    source: {
      path: relative(root, sourceProductData),
      sourceArchiveUnchanged: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter),
      before: sourceBefore,
      after: sourceAfter,
    },
    derivedCopy: {
      path: relative(root, copiedProductData),
      writesOnlyDerivedReportFiles: true,
    },
    comparison: {
      permittedAcrossReports: false,
      reason: "Each saved run keeps its own monitoring configuration; reports are rendered independently unless their configuration identity is equal.",
    },
    reports: reportsCreated,
  };
  await writeFile(join(validationRoot, "real-provider-derived-report.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ reports: reportsCreated.length, providerCallsMadeByPhase4: 0, sourceArchiveUnchanged: output.source.sourceArchiveUnchanged }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
