import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { ProductBaseline } from "./baseline-schema.js";
import type { ProductModelSelection } from "./model-selection-schema.js";

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export class ProductConfigurationFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private modelSelectionsPath(projectId: string): string {
    return join(this.projects.projectDir(projectId), "model-selections.json");
  }

  private baselineDir(projectId: string): string {
    return join(this.projects.projectDir(projectId), "baselines");
  }

  private baselinePath(projectId: string, baselineId: string): string {
    return join(this.baselineDir(projectId), `${baselineId}.json`);
  }

  async readModelSelections(projectId: string): Promise<ProductModelSelection[]> {
    try {
      const selections = await readJson<ProductModelSelection[]>(this.modelSelectionsPath(projectId));
      return Array.isArray(selections) ? selections : [];
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async saveModelSelections(projectId: string, selections: ProductModelSelection[]): Promise<void> {
    await mkdir(this.projects.projectDir(projectId), { recursive: true });
    await writeJson(this.modelSelectionsPath(projectId), selections);
  }

  async listBaselines(projectId: string): Promise<ProductBaseline[]> {
    try {
      const entries = await readdir(this.baselineDir(projectId), { withFileTypes: true });
      const baselines: ProductBaseline[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        baselines.push(await readJson<ProductBaseline>(join(this.baselineDir(projectId), entry.name)));
      }
      return baselines.sort((left, right) => left.version - right.version);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async readBaseline(projectId: string, baselineId: string): Promise<ProductBaseline | null> {
    try {
      return await readJson<ProductBaseline>(this.baselinePath(projectId, baselineId));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async saveBaseline(baseline: ProductBaseline): Promise<void> {
    await mkdir(this.baselineDir(baseline.projectId), { recursive: true });
    await writeJson(this.baselinePath(baseline.projectId, baseline.id), baseline);
  }
}
