import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { ProductBaselineService } from "../src/product/configuration/baseline-service.js";
import type { ProductMeasurementRunService } from "../src/product/measurements/measurement-service.js";
import type { MeasurementRun } from "../src/product/measurements/measurement-schema.js";
import type { ProductWatchSetService } from "../src/product/measurements/watchset-service.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import type { MonitoringScheduleRule, MonitoringTask, ScheduledOccurrenceStatus } from "../src/product/scheduling/schedule-schema.js";
import { ProductScheduleService } from "../src/product/scheduling/schedule-service.js";
import { ProductScheduleFileStore } from "../src/product/scheduling/schedule-store.js";

const FIRST = "2026-09-21T09:00:00.000Z";
const SECOND = "2026-09-22T09:00:00.000Z";
const THIRD = "2026-09-23T09:00:00.000Z";
const poll = (date: string) => new Date(Date.parse(date) + 1);
type StartInput = NonNullable<Parameters<ProductMeasurementRunService["start"]>[1]>;

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-schedule-regression-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectStore = new ProductProjectFileStore(root);
  const projects = new ProductProjectService(projectStore);
  const draft = await projects.createDraft({ primaryDomain: "schedule.example" });
  const project = await projects.setActiveBaseline(draft.id, "baseline");
  const store = new ProductScheduleFileStore(projectStore);
  const task: MonitoringTask = {
    id: "daily", projectId: project.id, version: 1, name: "Daily", status: "active",
    baselineId: "baseline", watchSetId: "watch", modelScope: ["offline-fixture"],
    rule: { frequency: "daily", timezone: "UTC", hour: 9, minute: 0 },
    budget: { requestLimit: 1, dailyRequestLimit: null, tokenLimit: null, costLimitUsd: null },
    plannedRequestCount: 1, missedRunPolicy: "skip", overlapPolicy: "skip",
    nextRunAt: FIRST, createdAt: FIRST, updatedAt: FIRST,
  };
  await store.saveTask(task);
  const runs = new Map<string, MeasurementRun>();
  const starts: StartInput[] = [];
  function run(id: string, status: MeasurementRun["status"] = "completed"): MeasurementRun {
    return { id, projectId: project.id, baselineId: task.baselineId, baselineVersion: 1,
      watchSetId: task.watchSetId, watchSetVersion: 1, source: "scheduled", modelScope: task.modelScope,
      plannedProbeCount: 1, completedProbeCount: status === "completed" ? 1 : 0, failedProbeCount: 0,
      status, budget: task.budget, createdAt: FIRST };
  }
  // Only scheduler-facing methods are simulated; tasks, occurrences and budget ledgers use real files.
  const measurements: Pick<ProductMeasurementRunService, "list" | "start" | "get"> = {
    list: async () => Array.from(runs.values()),
    start: async (_projectId, input = {}) => {
      starts.push(input);
      const next = { ...run(`run-${starts.length}`), occurrenceId: input.occurrenceId, idempotencyKey: input.idempotencyKey };
      runs.set(next.id, next);
      return next;
    },
    get: async (_projectId, id) => { const value = runs.get(id); assert.ok(value); return { run: value, modelRuns: [] }; },
  };
  const service = new ProductScheduleService(projects, {} as ProductBaselineService,
    {} as ProductWatchSetService, measurements as ProductMeasurementRunService, store);
  const readTask = async () => { const value = await store.readTask(project.id, task.id); assert.ok(value); return value; };
  const seedOccurrence = async (status: ScheduledOccurrenceStatus, scheduledFor = FIRST) => {
    const { occurrence } = await store.getOrCreateOccurrence({ projectId: project.id, taskId: task.id,
      taskVersion: task.version, scheduledFor, status, reason: "persisted_result" });
    return occurrence;
  };
  return { projects, project, store, task, runs, starts, run, measurements, service, readTask, seedOccurrence };
}

for (const status of ["queued", "running"] as const) {
  test(`an overlapping ${status} run skips only that occurrence and next due runs once`, async (t) => {
    const f = await fixture(t);
    f.runs.set("previous", f.run("previous", status));
    const skipped = await f.service.runDue(poll(FIRST));
    assert.equal(skipped[0]?.reason, "previous_run_still_active");
    assert.equal(skipped[0]?.status, "skipped");
    assert.equal((await f.readTask()).nextRunAt, SECOND);
    assert.deepEqual(await f.store.listLedger(f.project.id), []);
    assert.deepEqual(await f.service.runDue(poll(FIRST)), []);
    f.runs.set("previous", f.run("previous"));
    const concurrent = await Promise.all([f.service.runDue(poll(SECOND)), f.service.runDue(poll(SECOND))]);
    assert.equal(concurrent.flat().length, 1);
    assert.equal(f.starts.length, 1);
    assert.equal(f.starts[0]?.idempotencyKey, `${f.task.id}:${SECOND}`);
    assert.equal((await f.readTask()).nextRunAt, THIRD);
    assert.deepEqual(await f.service.runDue(poll(SECOND)), []);
    assert.equal(f.starts.length, 1);
    assert.equal((await f.store.listOccurrences(f.project.id)).length, 2);
    assert.equal((await f.store.listLedger(f.project.id)).length, 1);
    assert.deepEqual(await f.store.readOccurrence(f.project.id, f.task.id, FIRST), skipped[0]);
  });
}

const calendars: Array<{ name: string; rule: MonitoringScheduleRule; due: string; next: string }> = [
  { name: "daily", rule: { frequency: "daily", timezone: "UTC", hour: 9 }, due: FIRST, next: SECOND },
  { name: "weekly", rule: { frequency: "weekly", timezone: "UTC", weekday: 1, hour: 9 }, due: FIRST, next: "2026-09-28T09:00:00.000Z" },
  { name: "monthly day 31", rule: { frequency: "monthly", timezone: "UTC", dayOfMonth: 31, hour: 9 }, due: "2026-08-31T09:00:00.000Z", next: "2026-10-31T09:00:00.000Z" },
  { name: "custom", rule: { frequency: "custom", timezone: "UTC", cron: "0 */15 * * * *" }, due: FIRST, next: "2026-09-21T09:15:00.000Z" },
  { name: "spring DST", rule: { frequency: "daily", timezone: "America/New_York", hour: 9 }, due: "2026-03-07T14:00:00.000Z", next: "2026-03-08T13:00:00.000Z" },
  { name: "fall DST", rule: { frequency: "daily", timezone: "America/New_York", hour: 9 }, due: "2026-10-31T13:00:00.000Z", next: "2026-11-01T14:00:00.000Z" },
];
for (const calendar of calendars) {
  test(`overlap advancement preserves ${calendar.name} calendar semantics`, async (t) => {
    const f = await fixture(t);
    await f.store.saveTask({ ...f.task, rule: calendar.rule, nextRunAt: calendar.due });
    f.runs.set("previous", f.run("previous", "running"));
    await f.service.runDue(poll(calendar.due));
    assert.equal((await f.readTask()).nextRunAt, calendar.next);
    assert.equal(f.starts.length, 0);
  });
}

for (const status of ["skipped", "budget_blocked", "completed", "unknown"] as const) {
  test(`a persisted ${status} result repairs the cursor without replaying historical work`, async (t) => {
    const f = await fixture(t);
    const old = await f.seedOccurrence(status);
    const results = await f.service.runDue(poll(SECOND));
    assert.equal(results.length, 1);
    assert.equal(results[0]?.scheduledFor, SECOND);
    assert.equal(f.starts.length, 1);
    assert.equal(f.starts[0]?.idempotencyKey, `${f.task.id}:${SECOND}`);
    assert.equal((await f.readTask()).nextRunAt, THIRD);
    assert.deepEqual(await f.store.readOccurrence(f.project.id, f.task.id, FIRST), old);
    assert.equal((await f.store.listLedger(f.project.id)).length, 1);
  });
}

test("a persisted started result advances without restarting its still active run", async (t) => {
  const f = await fixture(t);
  const old = { ...await f.seedOccurrence("started"), runId: "old-run" };
  await f.store.saveOccurrence(old);
  f.runs.set("old-run", f.run("old-run", "running"));
  assert.deepEqual(await f.service.runDue(poll(FIRST)), []);
  assert.equal((await f.readTask()).nextRunAt, SECOND);
  assert.equal(f.starts.length, 0);
  assert.deepEqual(await f.store.readOccurrence(f.project.id, f.task.id, FIRST), old);
  f.runs.set("old-run", f.run("old-run"));
  assert.equal((await f.service.runDue(poll(SECOND)))[0]?.status, "started");
  assert.equal(f.starts.length, 1);
});

test("recovery crosses several persisted results but dispatches at most one fresh occurrence", async (t) => {
  const f = await fixture(t);
  await f.seedOccurrence("skipped");
  await f.seedOccurrence("budget_blocked", SECOND);
  const results = await f.service.runDue(poll("2026-09-25T09:00:00.000Z"));
  assert.equal(results.length, 1);
  assert.equal(results[0]?.scheduledFor, THIRD);
  assert.equal(f.starts.length, 1);
  assert.equal((await f.readTask()).nextRunAt, "2026-09-24T09:00:00.000Z");
});

test("an existing planned occurrence remains untouched because dispatch is uncertain", async (t) => {
  const f = await fixture(t);
  const old = await f.seedOccurrence("planned");
  assert.deepEqual(await f.service.runDue(poll(SECOND)), []);
  assert.deepEqual(await f.readTask(), f.task);
  assert.deepEqual(await f.store.readOccurrence(f.project.id, f.task.id, FIRST), old);
  assert.equal(f.starts.length, 0);
  assert.deepEqual(await f.store.listLedger(f.project.id), []);
});

test("daily budget blocking advances and a new local day can execute", async (t) => {
  const f = await fixture(t);
  const due = "2026-09-21T16:30:00.000Z";
  const next = "2026-09-22T16:30:00.000Z";
  await f.store.saveTask({ ...f.task, nextRunAt: due,
    rule: { frequency: "daily", timezone: "Asia/Shanghai", hour: 0, minute: 30 },
    budget: { ...f.task.budget, dailyRequestLimit: 1 } });
  const reserved = { id: "prior-budget", projectId: f.project.id, taskId: f.task.id,
    occurrenceId: "prior-occurrence", dateKey: "2026-09-22", reservedRequests: 1,
    knownCostUsd: null, costState: "unknown" as const, createdAt: FIRST, updatedAt: FIRST };
  await f.store.saveLedger(reserved);
  const blocked = await f.service.runDue(poll(due));
  assert.equal(blocked[0]?.status, "budget_blocked");
  assert.equal(blocked[0]?.reason, "daily_request_limit");
  assert.equal((await f.readTask()).nextRunAt, next);
  assert.deepEqual(await f.store.listLedger(f.project.id), [reserved]);
  assert.equal(f.starts.length, 0);
  assert.equal((await f.service.runDue(poll(next)))[0]?.status, "started");
  assert.equal(f.starts.length, 1);
  const ledger = await f.store.listLedger(f.project.id);
  assert.equal(ledger.length, 2);
  assert.equal(ledger.find((entry) => entry.id !== reserved.id)?.dateKey, "2026-09-23");
  assert.deepEqual(ledger.find((entry) => entry.id === reserved.id), reserved);
});

test("archived projects skip one occurrence and resume after restoration", async (t) => {
  const f = await fixture(t);
  await f.projects.archive(f.project.id);
  assert.equal((await f.service.runDue(poll(FIRST)))[0]?.reason, "project_not_active");
  assert.equal((await f.readTask()).nextRunAt, SECOND);
  assert.equal(f.starts.length, 0);
  await f.projects.restore(f.project.id);
  assert.equal((await f.service.runDue(poll(SECOND)))[0]?.status, "started");
  assert.equal(f.starts.length, 1);
});

test("a changed configuration leaves the task incompatible with no next run", async (t) => {
  const f = await fixture(t);
  await f.projects.setActiveBaseline(f.project.id, "new-baseline");
  assert.equal((await f.service.runDue(poll(FIRST)))[0]?.reason, "task_configuration_changed");
  const saved = await f.readTask();
  assert.equal(saved.status, "incompatible");
  assert.equal(saved.nextRunAt, null);
  assert.deepEqual(await f.service.runDue(poll(SECOND)), []);
  assert.equal(f.starts.length, 0);
});

for (const change of ["paused", "deleted", "version", "cursor"] as const) {
  test(`advancement preserves a concurrent ${change} task change`, async (t) => {
    const f = await fixture(t);
    const edited: MonitoringTask = change === "paused" || change === "deleted"
      ? { ...f.task, status: change, nextRunAt: null }
      : change === "version" ? { ...f.task, version: 2, name: "Edited", rule: { ...f.task.rule, hour: 14 } }
        : { ...f.task, nextRunAt: THIRD };
    t.mock.method(f.measurements, "list", async () => {
      await f.store.saveTask(edited);
      return [f.run("busy", "running")];
    });
    assert.equal((await f.service.runDue(poll(FIRST)))[0]?.status, "skipped");
    assert.deepEqual(await f.readTask(), edited);
    assert.equal(f.starts.length, 0);
  });
}

for (const outcome of ["skipped", "started", "unknown"] as const) {
  test(`a saved ${outcome} result survives cursor-write failure and recovers without replay`, async (t) => {
    const f = await fixture(t);
    if (outcome === "skipped") f.runs.set("busy", f.run("busy", "running"));
    if (outcome === "unknown") t.mock.method(f.measurements, "start", async (_id: string, input: StartInput) => {
      f.starts.push(input);
      throw new Error("offline dispatch failed");
    });
    const save = f.store.saveTask.bind(f.store);
    let fail = true;
    t.mock.method(f.store, "saveTask", async (value: MonitoringTask) => {
      if (fail) { fail = false; throw new Error("injected task write failure"); }
      await save(value);
    });
    await assert.rejects(f.service.runDue(poll(FIRST)), { message: "injected task write failure" });
    assert.equal((await f.readTask()).nextRunAt, FIRST);
    const durable = await f.store.readOccurrence(f.project.id, f.task.id, FIRST);
    assert.equal(durable?.status, outcome);
    const startsBeforeRecovery = f.starts.length;
    const ledgerBeforeRecovery = await f.store.listLedger(f.project.id);
    // A still-running result avoids completion reconciliation, isolating cursor recovery.
    if (durable?.runId) f.runs.set(durable.runId, f.run(durable.runId, "running"));
    assert.deepEqual(await f.service.runDue(poll(FIRST)), []);
    assert.equal((await f.readTask()).nextRunAt, SECOND);
    assert.equal(f.starts.length, startsBeforeRecovery);
    assert.deepEqual(await f.store.listLedger(f.project.id), ledgerBeforeRecovery);
    assert.deepEqual(await f.store.readOccurrence(f.project.id, f.task.id, FIRST), durable);
  });
}
