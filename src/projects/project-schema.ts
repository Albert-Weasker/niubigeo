import type { Entity } from "../core/types.js";

export type MonitoringProjectStatus = "active" | "paused" | "archived";

export interface MonitoringProject {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
  target: Entity;
  competitors: Entity[];
  defaultLanguage: string;
  status: MonitoringProjectStatus;
  createdAt: string;
  updatedAt: string;
}
