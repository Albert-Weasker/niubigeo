import { CronExpressionParser } from "cron-parser";
import type { MonitoringSchedule } from "./monitoring-task-schema.js";

function integerInRange(value: number | undefined, fallback: number, min: number, max: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isInteger(selected) || selected < min || selected > max) throw new Error(`Invalid ${label}.`);
  return selected;
}

function expressionFor(schedule: MonitoringSchedule): string | null {
  if (schedule.kind === "manual") return null;
  if (schedule.kind === "cron") {
    const expression = schedule.cron?.trim();
    if (!expression) throw new Error("Cron schedules require an expression.");
    return expression;
  }
  const minute = integerInRange(schedule.minute, 0, 0, 59, "schedule minute");
  const hour = integerInRange(schedule.hour, 0, 0, 23, "schedule hour");
  if (schedule.kind === "daily") return `0 ${minute} ${hour} * * *`;
  if (schedule.kind === "monthly") {
    const dayOfMonth = integerInRange(schedule.dayOfMonth, 1, 1, 31, "schedule day of month");
    return `0 ${minute} ${hour} ${dayOfMonth} * *`;
  }
  const dayOfWeek = integerInRange(schedule.dayOfWeek, 1, 0, 6, "schedule day of week");
  return `0 ${minute} ${hour} * * ${dayOfWeek}`;
}

export interface ScheduleCalculator {
  next(schedule: MonitoringSchedule, after: Date): string | undefined;
  preview(schedule: MonitoringSchedule, after: Date, count: number): string[];
  validate(schedule: MonitoringSchedule): void;
}

export class CronScheduleCalculator implements ScheduleCalculator {
  next(schedule: MonitoringSchedule, after: Date): string | undefined {
    const expression = expressionFor(schedule);
    if (!expression) return undefined;
    const interval = CronExpressionParser.parse(expression, {
      currentDate: after,
      tz: schedule.timezone,
      strict: false,
    });
    return interval.next().toDate().toISOString();
  }

  preview(schedule: MonitoringSchedule, after: Date, count: number): string[] {
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("Preview count must be between 1 and 20.");
    const expression = expressionFor(schedule);
    if (!expression) return [];
    const interval = CronExpressionParser.parse(expression, {
      currentDate: after,
      tz: schedule.timezone,
      strict: false,
    });
    const values: string[] = [];
    for (let index = 0; index < count; index += 1) values.push(interval.next().toDate().toISOString());
    return values;
  }

  validate(schedule: MonitoringSchedule): void {
    if (!schedule.timezone.trim()) throw new Error("Schedule timezone is required.");
    this.next(schedule, new Date("2026-01-01T00:00:00.000Z"));
  }
}
