import { randomUUID } from "node:crypto";

export type AsyncJobStatus = "queued" | "running" | "completed" | "failed";

export interface AsyncJobRecord<Progress, Result> {
  id: string;
  status: AsyncJobStatus;
  progress: Progress;
  result?: Result | undefined;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | undefined;
}

export type AsyncJobOperation<Progress, Result> = (
  update: (progress: Progress) => void,
) => Promise<Result>;

export class AsyncJobRegistry<Progress, Result> {
  private readonly jobs = new Map<string, AsyncJobRecord<Progress, Result>>();

  constructor(private readonly maximumJobs = 100) {}

  create(initialProgress: Progress, operation: AsyncJobOperation<Progress, Result>): AsyncJobRecord<Progress, Result> {
    const now = new Date().toISOString();
    const job: AsyncJobRecord<Progress, Result> = {
      id: `job-${randomUUID()}`,
      status: "queued",
      progress: initialProgress,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.trim();
    queueMicrotask(() => void this.execute(job.id, operation));
    return this.copy(job);
  }

  read(jobId: string): AsyncJobRecord<Progress, Result> | null {
    const job = this.jobs.get(jobId);
    return job ? this.copy(job) : null;
  }

  private async execute(jobId: string, operation: AsyncJobOperation<Progress, Result>): Promise<void> {
    const current = this.jobs.get(jobId);
    if (!current) return;
    this.jobs.set(jobId, { ...current, status: "running", updatedAt: new Date().toISOString() });
    try {
      const result = await operation((progress) => {
        const active = this.jobs.get(jobId);
        if (!active) return;
        this.jobs.set(jobId, { ...active, status: "running", progress, updatedAt: new Date().toISOString() });
      });
      const finishedAt = new Date().toISOString();
      const active = this.jobs.get(jobId);
      if (!active) return;
      this.jobs.set(jobId, { ...active, status: "completed", result, updatedAt: finishedAt, finishedAt });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const active = this.jobs.get(jobId);
      if (!active) return;
      this.jobs.set(jobId, {
        ...active,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: finishedAt,
        finishedAt,
      });
    }
  }

  private trim(): void {
    if (this.jobs.size <= this.maximumJobs) return;
    const completed = [...this.jobs.values()]
      .filter((job) => job.status === "completed" || job.status === "failed")
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    while (this.jobs.size > this.maximumJobs && completed.length > 0) {
      const job = completed.shift();
      if (job) this.jobs.delete(job.id);
    }
  }

  private copy(job: AsyncJobRecord<Progress, Result>): AsyncJobRecord<Progress, Result> {
    return structuredClone(job);
  }
}
