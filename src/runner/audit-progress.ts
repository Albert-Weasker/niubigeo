export type AuditProgressStage =
  | "preparing"
  | "calling_providers"
  | "building_result"
  | "saving_result"
  | "completed"
  | "failed";

export interface AuditModelProgress {
  providerId: string;
  model: string;
  planned: number;
  completed: number;
  failed: number;
}

export interface AuditProgressSnapshot {
  stage: AuditProgressStage;
  plannedObservationCount: number;
  completedObservationCount: number;
  failedObservationCount: number;
  models: AuditModelProgress[];
  activeProviderId?: string | undefined;
  activeModel?: string | undefined;
  message?: string | undefined;
}

export type AuditProgressListener = (progress: AuditProgressSnapshot) => void | Promise<void>;

export function emptyAuditProgress(): AuditProgressSnapshot {
  return {
    stage: "preparing",
    plannedObservationCount: 0,
    completedObservationCount: 0,
    failedObservationCount: 0,
    models: [],
  };
}
