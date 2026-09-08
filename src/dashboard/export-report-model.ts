import type { RunSnapshotModel } from "./run-snapshot-model.js";

export interface ExportReportModel {
  formatVersion: "project-export-v1";
  generatedAt: string;
  snapshot: RunSnapshotModel;
}

export class ExportReportModelBuilder {
  build(snapshot: RunSnapshotModel, generatedAt = new Date().toISOString()): ExportReportModel {
    return {
      formatVersion: "project-export-v1",
      generatedAt,
      snapshot,
    };
  }
}
