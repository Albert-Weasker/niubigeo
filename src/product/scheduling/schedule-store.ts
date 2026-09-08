import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../utils/hash.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { BudgetLedgerEntry, MonitoringTask, ScheduledOccurrence } from "./schedule-schema.js";

function notFound(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT"); }
async function readJson<T>(path: string): Promise<T> { return JSON.parse(await readFile(path, "utf8")) as T; }
async function writeJson(path: string, value: unknown): Promise<void> { const temporary = `${path}.${randomUUID()}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temporary, path); }

export class ProductScheduleFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}
  private root(projectId: string): string { return join(this.projects.projectDir(projectId), "schedules"); }
  private tasks(projectId: string): string { return join(this.root(projectId), "tasks"); }
  private taskPath(projectId: string, taskId: string): string { return join(this.tasks(projectId), `${taskId}.json`); }
  private occurrenceRoot(projectId: string): string { return join(this.root(projectId), "occurrences"); }
  private occurrencePath(projectId: string, taskId: string, scheduledFor: string): string { return join(this.occurrenceRoot(projectId), `${sha256(`${taskId}:${scheduledFor}`)}.json`); }
  private ledgerRoot(projectId: string): string { return join(this.root(projectId), "ledger"); }
  private ledgerPath(projectId: string, entryId: string): string { return join(this.ledgerRoot(projectId), `${entryId}.json`); }
  private lockRoot(projectId: string): string { return join(this.root(projectId), "locks"); }
  private lockPath(projectId: string, taskId: string): string { return join(this.lockRoot(projectId), `${sha256(taskId)}.lock`); }

  async saveTask(value: MonitoringTask): Promise<void> { await mkdir(this.tasks(value.projectId), { recursive: true }); await writeJson(this.taskPath(value.projectId, value.id), value); }
  async readTask(projectId: string, taskId: string): Promise<MonitoringTask | null> { try { const row = await readJson<MonitoringTask>(this.taskPath(projectId, taskId)); return row.projectId === projectId && row.id === taskId ? row : null; } catch (error) { if (notFound(error)) return null; throw error; } }
  async listTasks(projectId: string): Promise<MonitoringTask[]> { try { const values: MonitoringTask[] = []; for (const entry of await readdir(this.tasks(projectId), { withFileTypes: true })) { if (!entry.isFile() || !entry.name.endsWith(".json")) continue; const row = await this.readTask(projectId, entry.name.slice(0, -5)); if (row) values.push(row); } return values.sort((left, right) => left.createdAt.localeCompare(right.createdAt)); } catch (error) { if (notFound(error)) return []; throw error; } }

  async getOrCreateOccurrence(input: Omit<ScheduledOccurrence, "id" | "createdAt">): Promise<{ occurrence: ScheduledOccurrence; created: boolean }> {
    const path = this.occurrencePath(input.projectId, input.taskId, input.scheduledFor);
    await mkdir(this.occurrenceRoot(input.projectId), { recursive: true });
    const value: ScheduledOccurrence = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    let handle;
    try {
      handle = await open(path, "wx");
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      await handle.close();
      return { occurrence: value, created: true };
    } catch (error) {
      if (handle) await handle.close();
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        return { occurrence: await readJson<ScheduledOccurrence>(path), created: false };
      }
      throw error;
    }
  }

  async saveOccurrence(value: ScheduledOccurrence): Promise<void> { await mkdir(this.occurrenceRoot(value.projectId), { recursive: true }); await writeJson(this.occurrencePath(value.projectId, value.taskId, value.scheduledFor), value); }
  async readOccurrence(projectId: string, taskId: string, scheduledFor: string): Promise<ScheduledOccurrence | null> { try { const row = await readJson<ScheduledOccurrence>(this.occurrencePath(projectId, taskId, scheduledFor)); return row.projectId === projectId && row.taskId === taskId && row.scheduledFor === scheduledFor ? row : null; } catch (error) { if (notFound(error)) return null; throw error; } }
  async listOccurrences(projectId: string, taskId?: string): Promise<ScheduledOccurrence[]> { try { const values: ScheduledOccurrence[] = []; for (const entry of await readdir(this.occurrenceRoot(projectId), { withFileTypes: true })) { if (!entry.isFile() || !entry.name.endsWith(".json")) continue; const row = await readJson<ScheduledOccurrence>(join(this.occurrenceRoot(projectId), entry.name)); if (row.projectId === projectId && (!taskId || row.taskId === taskId)) values.push(row); } return values.sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor)); } catch (error) { if (notFound(error)) return []; throw error; } }

  async saveLedger(value: BudgetLedgerEntry): Promise<void> { await mkdir(this.ledgerRoot(value.projectId), { recursive: true }); await writeJson(this.ledgerPath(value.projectId, value.id), value); }
  async listLedger(projectId: string, taskId?: string): Promise<BudgetLedgerEntry[]> { try { const values: BudgetLedgerEntry[] = []; for (const entry of await readdir(this.ledgerRoot(projectId), { withFileTypes: true })) { if (!entry.isFile() || !entry.name.endsWith(".json")) continue; const row = await readJson<BudgetLedgerEntry>(join(this.ledgerRoot(projectId), entry.name)); if (row.projectId === projectId && (!taskId || row.taskId === taskId)) values.push(row); } return values.sort((left, right) => left.createdAt.localeCompare(right.createdAt)); } catch (error) { if (notFound(error)) return []; throw error; } }

  async withTaskLock<T>(projectId: string, taskId: string, operation: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
    await mkdir(this.lockRoot(projectId), { recursive: true });
    const path = this.lockPath(projectId, taskId);
    let handle;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") return { acquired: false };
      throw error;
    }
    try {
      return { acquired: true, value: await operation() };
    } finally {
      await handle.close();
      await unlink(path).catch(() => undefined);
    }
  }
}
