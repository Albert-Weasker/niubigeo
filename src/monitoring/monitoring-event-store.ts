import type { MonitoringEvent } from "./monitoring-event-schema.js";

export interface MonitoringEventStore {
  saveMonitoringEvent(event: MonitoringEvent): Promise<void>;
  listMonitoringEvents(projectId: string): Promise<MonitoringEvent[]>;
}
