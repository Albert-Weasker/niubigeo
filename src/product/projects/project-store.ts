import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../utils/hash.js";
import type { ProductProject, ProductProjectListOptions } from "./project-schema.js";

function safeSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
    throw new Error(`Invalid ${label}.`);
  }
  return trimmed;
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

const LOCK_STALE_MS = 30 * 60 * 1000;

async function acquireLock(path: string): Promise<Awaited<ReturnType<typeof open>> | null> {
  const create = async () => {
    const handle = await open(path, "wx");
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, "utf8");
    return handle;
  };
  try {
    return await create();
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    try {
      if (Date.now() - (await stat(path)).mtimeMs <= LOCK_STALE_MS) return null;
      await unlink(path);
    } catch (staleError) {
      if (!isNotFound(staleError)) throw staleError;
    }
    try { return await create(); }
    catch (retryError) {
      if (retryError && typeof retryError === "object" && "code" in retryError && retryError.code === "EEXIST") return null;
      throw retryError;
    }
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function visibleInList(project: ProductProject, options: ProductProjectListOptions): boolean {
  if (project.status === "deleted") return options.includeDeleted === true;
  if (project.status === "archived") return options.includeArchived === true;
  return true;
}

export class ProductProjectFileStore {
  constructor(private readonly rootDir: string) {}

  projectsDir(): string {
    return resolve(this.rootDir, "projects");
  }

  private locksDir(): string {
    return resolve(this.rootDir, "locks");
  }

  projectDir(projectId: string): string {
    return join(this.projectsDir(), safeSegment(projectId, "project id"));
  }

  private projectPath(projectId: string): string {
    return join(this.projectDir(projectId), "project.json");
  }

  async read(projectId: string): Promise<ProductProject | null> {
    try {
      const project = await readJson<ProductProject>(this.projectPath(projectId));
      if (project.id !== projectId) throw new Error(`Project file does not belong to ${projectId}.`);
      return project;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async list(options: ProductProjectListOptions = {}): Promise<ProductProject[]> {
    try {
      const entries = await readdir(this.projectsDir(), { withFileTypes: true });
      const projects: ProductProject[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const project = await this.read(entry.name);
        if (project && visibleInList(project, options)) projects.push(project);
      }
      return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async listAll(): Promise<ProductProject[]> {
    return this.list({ includeArchived: true, includeDeleted: true });
  }

  async save(project: ProductProject): Promise<void> {
    const directory = this.projectDir(project.id);
    await mkdir(directory, { recursive: true });
    await writeJson(this.projectPath(project.id), project);
  }

  async purge(projectId: string): Promise<void> {
    await rm(this.projectDir(projectId), { recursive: true, force: false });
  }

  async withProjectLock<T>(projectId: string, operation: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
    await mkdir(this.locksDir(), { recursive: true });
    const path = join(this.locksDir(), `${sha256(`project:${projectId}`)}.lock`);
    const handle = await acquireLock(path);
    if (!handle) return { acquired: false };
    try { return { acquired: true, value: await operation() }; }
    finally { await handle.close(); await unlink(path).catch(() => undefined); }
  }

  async withDomainLock<T>(normalizedDomain: string, operation: () => Promise<T>): Promise<T> {
    await mkdir(this.locksDir(), { recursive: true });
    const path = join(this.locksDir(), `${sha256(normalizedDomain)}.lock`);
    const handle = await acquireLock(path);
    if (!handle) throw new Error("A project change for this domain is already in progress.");
    try {
      return await operation();
    } finally {
      await handle.close();
      try {
        await unlink(path);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
  }
}
