import type { ProjectRunRecord } from "../monitoring/monitoring-task-schema.js";
import type { TrendFilter } from "./timeseries-schema.js";
import { isCurrentDataRun } from "../dashboard/run-selection.js";

function trendComplete(run: ProjectRunRecord): boolean {
  return isCurrentDataRun(run) && run.trendEligible && Boolean(run.finishedAt);
}

function rangeStart(filter: TrendFilter): number | null {
  if (filter.range === "all") return null;
  const now = new Date(filter.now || new Date().toISOString()).getTime();
  const duration = filter.range === "24h" ? 24 : filter.range === "7d" ? 24 * 7 : filter.range === "30d" ? 24 * 30 : 24 * 90;
  return now - duration * 60 * 60 * 1000;
}

function localDay(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export interface ComparableRunSelection {
  runs: ProjectRunRecord[];
  excludedRunIds: string[];
  completeRunCount: number;
  distinctDayCount: number;
  partialRunCount: number;
}

export class ComparablePeriodSelector {
  select(runs: ProjectRunRecord[], baselineId: string, filter: TrendFilter): ComparableRunSelection {
    const matchingBaseline = runs.filter((run) => run.baselineId === baselineId);
    const start = rangeStart(filter);
    const inRange = matchingBaseline.filter((run) => {
      const time = new Date(run.finishedAt || run.startedAt).getTime();
      return start === null || time >= start;
    });
    const partialRunCount = inRange.filter((run) => !trendComplete(run)).length;
    const completeRuns = inRange.filter(trendComplete).sort((a, b) => (a.finishedAt || a.startedAt).localeCompare(b.finishedAt || b.startedAt));
    if (filter.range === "24h") {
      return {
        runs: completeRuns,
        excludedRunIds: inRange.filter((run) => !completeRuns.includes(run)).map((run) => run.id),
        completeRunCount: completeRuns.length,
        distinctDayCount: new Set(completeRuns.map((run) => localDay(run.finishedAt || run.startedAt, filter.timezone))).size,
        partialRunCount,
      };
    }
    const byDay = new Map<string, ProjectRunRecord>();
    for (const run of completeRuns) {
      const day = localDay(run.finishedAt || run.startedAt, filter.timezone);
      const previous = byDay.get(day);
      if (!previous || (run.finishedAt || run.startedAt) > (previous.finishedAt || previous.startedAt)) byDay.set(day, run);
    }
    const selected = [...byDay.values()].sort((a, b) => (a.finishedAt || a.startedAt).localeCompare(b.finishedAt || b.startedAt));
    return {
      runs: selected,
      excludedRunIds: inRange.filter((run) => !selected.includes(run)).map((run) => run.id),
      completeRunCount: completeRuns.length,
      distinctDayCount: byDay.size,
      partialRunCount,
    };
  }

  bucket(run: ProjectRunRecord, filter: TrendFilter): string {
    const observedAt = run.finishedAt || run.startedAt;
    return filter.range === "24h" ? observedAt : localDay(observedAt, filter.timezone);
  }
}
