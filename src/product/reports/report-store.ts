import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { RecognitionReport } from "./report-schema.js";

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export class RecognitionReportFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private reportsDir(projectId: string, runId: string): string {
    return join(this.projects.projectDir(projectId), "recognition-runs", runId, "reports");
  }

  private reportPath(projectId: string, runId: string, reportId: string): string {
    return join(this.reportsDir(projectId, runId), `${reportId}.json`);
  }

  async list(projectId: string, runId: string): Promise<RecognitionReport[]> {
    try {
      const entries = await readdir(this.reportsDir(projectId, runId), { withFileTypes: true });
      const reports: RecognitionReport[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const report = await readJson<RecognitionReport>(join(this.reportsDir(projectId, runId), entry.name));
        if (report.projectId === projectId && report.runId === runId) reports.push(report);
      }
      return reports.sort((left, right) => left.reportRevision - right.reportRevision);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async read(projectId: string, runId: string, reportId: string): Promise<RecognitionReport | null> {
    try {
      const report = await readJson<RecognitionReport>(this.reportPath(projectId, runId, reportId));
      return report.projectId === projectId && report.runId === runId && report.reportId === reportId ? report : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async save(report: RecognitionReport): Promise<void> {
    await mkdir(this.reportsDir(report.projectId, report.runId), { recursive: true });
    await writeJson(this.reportPath(report.projectId, report.runId, report.reportId), report);
  }
}
