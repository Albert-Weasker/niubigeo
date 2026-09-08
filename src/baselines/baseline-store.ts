import type { MonitoringBaseline } from "./baseline-schema.js";

export interface BaselineStore {
  saveBaseline(baseline: MonitoringBaseline): Promise<void>;
  readBaseline(projectId: string, baselineId: string): Promise<MonitoringBaseline | null>;
  listBaselines(projectId: string): Promise<MonitoringBaseline[]>;
}
