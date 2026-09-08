import { EvidenceChangeBuilder } from "../changes/evidence-change-builder.js";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { ProjectMonitoringStore } from "../projects/project-store.js";
import { MonitoringEventBuilder } from "./monitoring-event-builder.js";
import type { MonitoringEvent, MonitoringEventDelivery } from "./monitoring-event-schema.js";
import { EmailNotificationAdapter, WebhookNotificationAdapter, type NotificationDeliveryAdapter, type NotificationEnvelope } from "./notification-delivery.js";
import type { MonitoringNotificationCondition, MonitoringTask, ProjectRunRecord } from "./monitoring-task-schema.js";
import { RunSelector } from "../dashboard/run-selection.js";

export interface MonitoringEventProcessor {
  afterRun(task: MonitoringTask, run: ProjectRunRecord): Promise<void>;
  afterFailure(task: MonitoringTask): Promise<void>;
}

function eventTitle(project: MonitoringProject, condition: MonitoringNotificationCondition): string {
  const language = project.defaultLanguage.toLocaleLowerCase().split("-")[0];
  const zh: Record<MonitoringNotificationCondition, string> = {
    brand_disappeared: "品牌从监测回答中消失",
    competitor_appeared: "新的竞争对象开始替代品牌出现",
    official_citation_added: "AI 新引用了官网",
    recommendation_changed: "品牌推荐结果发生变化",
    run_completed: "监测任务已完成",
    run_failed: "监测任务运行失败",
  };
  const en: Record<MonitoringNotificationCondition, string> = {
    brand_disappeared: "Brand disappeared from monitored answers",
    competitor_appeared: "A competitor started appearing without the brand",
    official_citation_added: "AI added an official-site citation",
    recommendation_changed: "Brand recommendation changed",
    run_completed: "Monitoring run completed",
    run_failed: "Monitoring run failed",
  };
  return `${project.name}: ${(language === "zh" ? zh : en)[condition]}`;
}

function eventMessage(event: MonitoringEvent, task: MonitoringTask, project: MonitoringProject): string {
  const language = project.defaultLanguage.toLocaleLowerCase().split("-")[0];
  if (language === "zh") {
    return `任务：${task.name}\n事件数量：${event.occurrenceCount}\n问题：${event.promptIds.length}\n模型：${event.models.join(", ") || "无"}\n请在 NiubiGEO 工作台查看对应问题和原始回答。`;
  }
  return `Task: ${task.name}\nOccurrences: ${event.occurrenceCount}\nQuestions: ${event.promptIds.length}\nModels: ${event.models.join(", ") || "none"}\nOpen the NiubiGEO workspace to inspect the questions and original answers.`;
}

export class NotificationService implements MonitoringEventProcessor {
  private readonly events = new MonitoringEventBuilder();
  private readonly changes = new EvidenceChangeBuilder();
  private readonly runSelector = new RunSelector();

  constructor(
    private readonly store: ProjectMonitoringStore,
    private readonly adapters: NotificationDeliveryAdapter[] = [new EmailNotificationAdapter(), new WebhookNotificationAdapter()],
  ) {}

  async afterRun(task: MonitoringTask, run: ProjectRunRecord): Promise<void> {
    const [baselines, runs, observations] = await Promise.all([
      this.store.listBaselines(task.projectId),
      this.store.listRuns(task.projectId),
      this.store.listObservations(task.projectId),
    ]);
    const selection = this.runSelector.select({
      projectId: task.projectId,
      baselines,
      runs,
      requestedBaselineId: task.baselineId,
    }).selection;
    const changeSet = this.changes.build({
      baselineId: task.baselineId,
      currentRun: selection.comparisonCurrentRun,
      previousRun: selection.comparisonPreviousRun,
      observations,
    });
    const events = this.events.afterRun(task, run, changeSet.comparable ? changeSet.changes : []);
    await this.recordAndDeliver(task, events);
  }

  async afterFailure(task: MonitoringTask): Promise<void> {
    await this.recordAndDeliver(task, this.events.afterFailure(task));
  }

  private async recordAndDeliver(task: MonitoringTask, events: MonitoringEvent[]): Promise<void> {
    const project = await this.store.readProject(task.projectId);
    if (!project) return;
    const existingEvents = await this.store.listMonitoringEvents(task.projectId);
    for (const event of events) {
      const existing = existingEvents.find((item) => item.id === event.id);
      if (!existing) await this.store.saveMonitoringEvent(event);
      const deliveries: MonitoringEventDelivery[] = [...(existing?.deliveries || [])];
      for (const channel of task.notifications.channels.filter((item) => item.enabled)) {
        if (deliveries.some((delivery) => delivery.channelId === channel.id && delivery.status === "delivered")) continue;
        const adapter = this.adapters.find((item) => item.supports(channel));
        const attemptedAt = new Date().toISOString();
        if (!adapter) {
          deliveries.push({ channelId: channel.id, channelType: channel.type, status: "failed", attemptedAt, error: "No delivery adapter is available." });
          continue;
        }
        const envelope: NotificationEnvelope = {
          event,
          project,
          task,
          title: eventTitle(project, event.condition),
          message: eventMessage(event, task, project),
        };
        try {
          await adapter.deliver(channel, envelope);
          deliveries.push({ channelId: channel.id, channelType: channel.type, status: "delivered", attemptedAt });
        } catch (error) {
          deliveries.push({
            channelId: channel.id,
            channelType: channel.type,
            status: "failed",
            attemptedAt,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const delivered = deliveries.filter((item) => item.status === "delivered").length;
      const failed = deliveries.filter((item) => item.status === "failed").length;
      const status = delivered > 0 && failed === 0
        ? "delivered"
        : delivered > 0
          ? "partially_delivered"
          : failed > 0
            ? "delivery_failed"
            : "recorded";
      await this.store.saveMonitoringEvent({ ...(existing || event), deliveries, status });
    }
  }
}
