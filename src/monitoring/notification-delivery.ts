import nodemailer from "nodemailer";
import type { MonitoringProject } from "../projects/project-schema.js";
import type { MonitoringEvent } from "./monitoring-event-schema.js";
import type { MonitoringNotificationChannel, MonitoringTask } from "./monitoring-task-schema.js";

export interface NotificationEnvelope {
  event: MonitoringEvent;
  project: MonitoringProject;
  task: MonitoringTask;
  title: string;
  message: string;
}

export interface NotificationDeliveryAdapter {
  supports(channel: MonitoringNotificationChannel): boolean;
  deliver(channel: MonitoringNotificationChannel, envelope: NotificationEnvelope): Promise<void>;
}

function endpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Notification endpoint must use HTTP or HTTPS.");
  return url.toString();
}

function webhookBody(channel: MonitoringNotificationChannel, envelope: NotificationEnvelope): unknown {
  if (channel.type === "slack") return { text: `${envelope.title}\n${envelope.message}` };
  if (channel.type === "discord") return { content: `${envelope.title}\n${envelope.message}` };
  if (channel.type === "wecom") return { msgtype: "text", text: { content: `${envelope.title}\n${envelope.message}` } };
  if (channel.type === "lark") return { msg_type: "text", content: { text: `${envelope.title}\n${envelope.message}` } };
  return {
    event: envelope.event,
    project: { id: envelope.project.id, name: envelope.project.name, domain: envelope.project.domain },
    task: { id: envelope.task.id, name: envelope.task.name },
    title: envelope.title,
    message: envelope.message,
  };
}

export class WebhookNotificationAdapter implements NotificationDeliveryAdapter {
  supports(channel: MonitoringNotificationChannel): boolean {
    return channel.type !== "email";
  }

  async deliver(channel: MonitoringNotificationChannel, envelope: NotificationEnvelope): Promise<void> {
    const response = await fetch(endpoint(channel.target), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody(channel, envelope)),
    });
    if (!response.ok) throw new Error(`Notification endpoint returned HTTP ${response.status}.`);
  }
}

export class EmailNotificationAdapter implements NotificationDeliveryAdapter {
  supports(channel: MonitoringNotificationChannel): boolean {
    return channel.type === "email";
  }

  async deliver(channel: MonitoringNotificationChannel, envelope: NotificationEnvelope): Promise<void> {
    const smtpUrl = process.env.SMTP_URL?.trim();
    const from = process.env.SMTP_FROM?.trim();
    if (!smtpUrl || !from) throw new Error("Email delivery requires SMTP_URL and SMTP_FROM.");
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({ from, to: channel.target, subject: envelope.title, text: envelope.message });
  }
}
