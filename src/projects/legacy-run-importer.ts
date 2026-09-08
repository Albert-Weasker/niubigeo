import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AuditRun } from "../core/types.js";
import { ProjectDashboardBuilder } from "../dashboard/project-dashboard-model.js";
import type { ProjectMonitoringStore } from "./project-store.js";
import { ProjectService, type MaterializedAuditRun } from "./project-service.js";

export interface LegacyRunImportSummary {
  scanned: number;
  imported: number;
  skipped: number;
  projects: string[];
  baselines: string[];
  runs: string[];
}

async function readAudit(path: string): Promise<AuditRun | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as AuditRun;
  } catch {
    return null;
  }
}

export class LegacyRunImporter {
  private readonly service = new ProjectService();
  private readonly dashboards = new ProjectDashboardBuilder();

  constructor(private readonly store: ProjectMonitoringStore) {}

  async importRuns(runsRoot: string): Promise<LegacyRunImportSummary> {
    const summary: LegacyRunImportSummary = {
      scanned: 0,
      imported: 0,
      skipped: 0,
      projects: [],
      baselines: [],
      runs: [],
    };
    let entries;
    try {
      entries = await readdir(runsRoot, { withFileTypes: true });
    } catch {
      return summary;
    }
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      summary.scanned += 1;
      const audit = await readAudit(join(runsRoot, entry.name, "audit.json"));
      if (!audit) {
        summary.skipped += 1;
        continue;
      }
      const existing = await this.store.readProject(this.service.projectFromAuditRun(audit).id);
      const materialized = this.service.materializeAuditRun({ audit, existingProject: existing || undefined });
      await this.saveMaterialized(materialized);
      summary.imported += 1;
      if (!summary.projects.includes(materialized.project.id)) summary.projects.push(materialized.project.id);
      if (!summary.baselines.includes(materialized.baseline.id)) summary.baselines.push(materialized.baseline.id);
      summary.runs.push(materialized.run.id);
    }
    for (const projectId of summary.projects) await this.rebuildDashboard(projectId);
    return summary;
  }

  private async saveMaterialized(materialized: MaterializedAuditRun): Promise<void> {
    await this.store.saveProject(materialized.project);
    await this.store.saveBaseline(materialized.baseline);
    await this.store.saveRun(materialized.run);
    await this.store.saveObservations(materialized.project.id, materialized.run.id, materialized.observations);
  }

  private async rebuildDashboard(projectId: string): Promise<void> {
    const project = await this.store.readProject(projectId);
    if (!project) return;
    const [baselines, runs, observations, tasks] = await Promise.all([
      this.store.listBaselines(projectId),
      this.store.listRuns(projectId),
      this.store.listObservations(projectId),
      this.store.listTasks(projectId),
    ]);
    await this.store.saveDashboard(projectId, this.dashboards.build({ project, baselines, runs, observations, tasks }));
  }
}
