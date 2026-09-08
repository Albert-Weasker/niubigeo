import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type {
  DomainProbeResult,
  KeywordDiscoveryMention,
  KeywordDiscoveryResult,
  MeasurementMetricPoint,
  MeasurementModelRun,
  MeasurementRun,
  MeasurementStatsSnapshot,
  ProbeAttempt,
  ProbeEvidenceArchive,
  ProbeRun,
  WatchSet,
} from "./measurement-schema.js";

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function sorted<T extends { createdAt: string }>(entries: T[]): T[] {
  return entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export class ProductMeasurementFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private root(projectId: string): string { return join(this.projects.projectDir(projectId), "measurements"); }
  private watchSets(projectId: string): string { return join(this.root(projectId), "watch-sets"); }
  private watchSetPath(projectId: string, watchSetId: string): string { return join(this.watchSets(projectId), `${watchSetId}.json`); }
  private runs(projectId: string): string { return join(this.root(projectId), "runs"); }
  private runRoot(projectId: string, runId: string): string { return join(this.runs(projectId), runId); }
  private runPath(projectId: string, runId: string): string { return join(this.runRoot(projectId, runId), "run.json"); }
  private modelRoot(projectId: string, runId: string, modelRunId: string): string { return join(this.runRoot(projectId, runId), "model-runs", modelRunId); }
  private modelPath(projectId: string, runId: string, modelRunId: string): string { return join(this.modelRoot(projectId, runId, modelRunId), "model-run.json"); }
  private probeRoot(projectId: string, runId: string, modelRunId: string): string { return join(this.modelRoot(projectId, runId, modelRunId), "probe-runs"); }
  private probePath(projectId: string, runId: string, modelRunId: string, probeId: string): string { return join(this.probeRoot(projectId, runId, modelRunId), `${probeId}.json`); }
  private attemptRoot(projectId: string, runId: string, modelRunId: string, probeId: string): string { return join(this.modelRoot(projectId, runId, modelRunId), "attempts", probeId); }
  private attemptPath(projectId: string, runId: string, modelRunId: string, probeId: string, attemptId: string): string { return join(this.attemptRoot(projectId, runId, modelRunId, probeId), `${attemptId}.json`); }
  private resultPath(projectId: string, runId: string, modelRunId: string, probeId: string): string { return join(this.modelRoot(projectId, runId, modelRunId), "results", `${probeId}.json`); }
  private evidencePath(projectId: string, runId: string, modelRunId: string, probeId: string): string { return join(this.modelRoot(projectId, runId, modelRunId), "evidence", `${probeId}.json`); }
  private snapshotRoot(projectId: string): string { return join(this.root(projectId), "stats"); }
  private snapshotPath(projectId: string, snapshotId: string): string { return join(this.snapshotRoot(projectId), `${snapshotId}.json`); }

  async saveWatchSet(value: WatchSet): Promise<void> {
    await mkdir(this.watchSets(value.projectId), { recursive: true });
    await writeJson(this.watchSetPath(value.projectId, value.id), value);
  }

  async readWatchSet(projectId: string, watchSetId: string): Promise<WatchSet | null> {
    try {
      const value = await readJson<WatchSet>(this.watchSetPath(projectId, watchSetId));
      return value.projectId === projectId && value.id === watchSetId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listWatchSets(projectId: string): Promise<WatchSet[]> {
    try {
      const rows: WatchSet[] = [];
      for (const entry of await readdir(this.watchSets(projectId), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const value = await readJson<WatchSet>(join(this.watchSets(projectId), entry.name));
        if (value.projectId === projectId) rows.push(value);
      }
      return rows.sort((left, right) => left.version - right.version);
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async saveRun(value: MeasurementRun): Promise<void> {
    await mkdir(this.runRoot(value.projectId, value.id), { recursive: true });
    await writeJson(this.runPath(value.projectId, value.id), value);
  }

  async readRun(projectId: string, runId: string): Promise<MeasurementRun | null> {
    try {
      const value = await readJson<MeasurementRun>(this.runPath(projectId, runId));
      return value.projectId === projectId && value.id === runId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listRuns(projectId: string): Promise<MeasurementRun[]> {
    try {
      const values: MeasurementRun[] = [];
      for (const entry of await readdir(this.runs(projectId), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const row = await this.readRun(projectId, entry.name);
        if (row) values.push(row);
      }
      return values.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async saveModelRun(value: MeasurementModelRun): Promise<void> {
    await mkdir(this.modelRoot(value.projectId, value.runId, value.id), { recursive: true });
    await writeJson(this.modelPath(value.projectId, value.runId, value.id), value);
  }

  async readModelRun(projectId: string, runId: string, modelRunId: string): Promise<MeasurementModelRun | null> {
    try {
      const value = await readJson<MeasurementModelRun>(this.modelPath(projectId, runId, modelRunId));
      return value.projectId === projectId && value.runId === runId && value.id === modelRunId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listModelRuns(projectId: string, runId: string): Promise<MeasurementModelRun[]> {
    const root = join(this.runRoot(projectId, runId), "model-runs");
    try {
      const values: MeasurementModelRun[] = [];
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const row = await this.readModelRun(projectId, runId, entry.name);
        if (row) values.push(row);
      }
      return sorted(values);
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async saveProbe(value: ProbeRun): Promise<void> {
    await mkdir(this.probeRoot(value.projectId, value.runId, value.modelRunId), { recursive: true });
    await writeJson(this.probePath(value.projectId, value.runId, value.modelRunId, value.id), value);
  }

  async readProbe(projectId: string, runId: string, modelRunId: string, probeId: string): Promise<ProbeRun | null> {
    try {
      const value = await readJson<ProbeRun>(this.probePath(projectId, runId, modelRunId, probeId));
      return value.projectId === projectId && value.runId === runId && value.modelRunId === modelRunId && value.id === probeId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listProbes(projectId: string, runId: string, modelRunId: string): Promise<ProbeRun[]> {
    try {
      const values: ProbeRun[] = [];
      for (const entry of await readdir(this.probeRoot(projectId, runId, modelRunId), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const row = await this.readProbe(projectId, runId, modelRunId, entry.name.slice(0, -5));
        if (row) values.push(row);
      }
      return values.sort((left, right) => left.sampleNumber - right.sampleNumber || left.id.localeCompare(right.id));
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async saveAttempt(value: ProbeAttempt): Promise<void> {
    await mkdir(this.attemptRoot(value.projectId, value.runId, value.modelRunId, value.probeRunId), { recursive: true });
    await writeJson(this.attemptPath(value.projectId, value.runId, value.modelRunId, value.probeRunId, value.id), value);
  }

  async readAttempt(projectId: string, runId: string, modelRunId: string, probeId: string, attemptId: string): Promise<ProbeAttempt | null> {
    try {
      const value = await readJson<ProbeAttempt>(this.attemptPath(projectId, runId, modelRunId, probeId, attemptId));
      return value.projectId === projectId && value.runId === runId && value.modelRunId === modelRunId && value.probeRunId === probeId && value.id === attemptId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listAttempts(projectId: string, runId: string, modelRunId: string, probeId: string): Promise<ProbeAttempt[]> {
    try {
      const values: ProbeAttempt[] = [];
      for (const entry of await readdir(this.attemptRoot(projectId, runId, modelRunId, probeId), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const row = await this.readAttempt(projectId, runId, modelRunId, probeId, entry.name.slice(0, -5));
        if (row) values.push(row);
      }
      return values.sort((left, right) => left.attemptNumber - right.attemptNumber);
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async saveResults(input: { projectId: string; runId: string; modelRunId: string; probeRunId: string; domainResult?: DomainProbeResult; keywordResult?: KeywordDiscoveryResult; mentions: KeywordDiscoveryMention[] }): Promise<void> {
    const path = this.resultPath(input.projectId, input.runId, input.modelRunId, input.probeRunId);
    await mkdir(join(path, ".."), { recursive: true });
    await writeJson(path, input);
  }

  async readResults(projectId: string, runId: string, modelRunId: string, probeId: string): Promise<{ domainResult?: DomainProbeResult; keywordResult?: KeywordDiscoveryResult; mentions: KeywordDiscoveryMention[] } | null> {
    try {
      const value = await readJson<{ projectId: string; runId: string; modelRunId: string; probeRunId: string; domainResult?: DomainProbeResult; keywordResult?: KeywordDiscoveryResult; mentions: KeywordDiscoveryMention[] }>(this.resultPath(projectId, runId, modelRunId, probeId));
      return value.projectId === projectId && value.runId === runId && value.modelRunId === modelRunId && value.probeRunId === probeId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async saveEvidence(projectId: string, runId: string, modelRunId: string, probeId: string, value: ProbeEvidenceArchive): Promise<void> {
    const path = this.evidencePath(projectId, runId, modelRunId, probeId);
    await mkdir(join(path, ".."), { recursive: true });
    await writeJson(path, value);
  }

  async readEvidence(projectId: string, runId: string, modelRunId: string, probeId: string): Promise<ProbeEvidenceArchive> {
    try {
      return await readJson<ProbeEvidenceArchive>(this.evidencePath(projectId, runId, modelRunId, probeId));
    } catch (error) {
      if (notFound(error)) return { providerCitations: [], answerMentionedUrls: [] };
      throw error;
    }
  }

  async probeDetail(projectId: string, runId: string, modelRunId: string, probeId: string): Promise<import("./measurement-schema.js").MeasurementProbeDetail | null> {
    const probe = await this.readProbe(projectId, runId, modelRunId, probeId);
    if (!probe) return null;
    const [attempts, results, evidence] = await Promise.all([
      this.listAttempts(projectId, runId, modelRunId, probeId),
      this.readResults(projectId, runId, modelRunId, probeId),
      this.readEvidence(projectId, runId, modelRunId, probeId),
    ]);
    return { probe, attempts, domainResult: results?.domainResult, keywordResult: results?.keywordResult, mentions: results?.mentions || [], evidence };
  }

  async saveSnapshot(value: MeasurementStatsSnapshot): Promise<void> {
    await mkdir(this.snapshotRoot(value.projectId), { recursive: true });
    await writeJson(this.snapshotPath(value.projectId, value.id), value);
  }

  async readSnapshot(projectId: string, snapshotId: string): Promise<MeasurementStatsSnapshot | null> {
    try {
      const value = await readJson<MeasurementStatsSnapshot>(this.snapshotPath(projectId, snapshotId));
      return value.projectId === projectId && value.id === snapshotId ? value : null;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async listSnapshots(projectId: string): Promise<MeasurementStatsSnapshot[]> {
    try {
      const values: MeasurementStatsSnapshot[] = [];
      for (const entry of await readdir(this.snapshotRoot(projectId), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const value = await this.readSnapshot(projectId, entry.name.slice(0, -5));
        if (value) values.push(value);
      }
      return values.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async listPoints(projectId: string): Promise<MeasurementMetricPoint[]> {
    const snapshots = await this.listSnapshots(projectId);
    return snapshots.flatMap((snapshot) => snapshot.points);
  }
}
