import type { ProjectRunRecord } from "./monitoring-task-schema.js";

export interface RunStore {
  saveRun(run: ProjectRunRecord): Promise<void>;
  readRun(projectId: string, runId: string): Promise<ProjectRunRecord | null>;
  listRuns(projectId: string): Promise<ProjectRunRecord[]>;
}
