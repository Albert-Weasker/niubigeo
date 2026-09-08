import type { MonitoringNotificationChannelType, MonitoringNotificationCondition } from "./monitoring-task-schema.js";

export type MonitoringEventStatus = "recorded" | "delivered" | "partially_delivered" | "delivery_failed";
export type MonitoringDeliveryStatus = "delivered" | "failed";

export interface MonitoringEventDelivery {
  channelId: string;
  channelType: MonitoringNotificationChannelType;
  status: MonitoringDeliveryStatus;
  attemptedAt: string;
  error?: string | undefined;
}

export interface MonitoringEvent {
  id: string;
  projectId: string;
  taskId: string;
  runId?: string | undefined;
  condition: MonitoringNotificationCondition;
  occurrenceCount: number;
  observationIds: string[];
  previousObservationIds: string[];
  promptIds: string[];
  models: string[];
  entityNames: string[];
  citationUrls: string[];
  status: MonitoringEventStatus;
  deliveries: MonitoringEventDelivery[];
  createdAt: string;
}
