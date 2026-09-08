import type { MonitoringTask, MonitoringTaskLease } from "./monitoring-task-schema.js";

export interface MonitoringTaskStore {
  saveTask(task: MonitoringTask): Promise<void>;
  readTask(projectId: string, taskId: string): Promise<MonitoringTask | null>;
  listTasks(projectId: string): Promise<MonitoringTask[]>;
  deleteTask(projectId: string, taskId: string): Promise<void>;
  acquireTaskLease(projectId: string, taskId: string, lease: MonitoringTaskLease): Promise<boolean>;
  releaseTaskLease(projectId: string, taskId: string, ownerId: string): Promise<void>;
}
