import type { Observation } from "./observation-schema.js";

export interface ObservationQuery {
  runId?: string | undefined;
  baselineId?: string | undefined;
}

export interface ObservationStore {
  saveObservations(projectId: string, runId: string, observations: Observation[]): Promise<void>;
  listObservations(projectId: string, query?: ObservationQuery | string | undefined): Promise<Observation[]>;
}
