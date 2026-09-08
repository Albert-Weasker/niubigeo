import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type {
  AnswerMentionedUrl,
  BrandKeywordRecognition,
  ClaimCitationLink,
  CompetitorKeywordRecognition,
  CompetitorRecognition,
  ProviderCitation,
  RecognitionArchive,
  RecognitionAnalysisRevision,
  RecognitionModelRun,
  RecognitionModelRunAttempt,
  RecognitionResult,
  RecognitionRun,
} from "./recognition-schema.js";

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

function sortedByCreatedAt<T extends { createdAt: string }>(values: T[]): T[] {
  return values.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export class ProductRecognitionFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private runsDir(projectId: string): string {
    return join(this.projects.projectDir(projectId), "recognition-runs");
  }

  private runDir(projectId: string, runId: string): string {
    return join(this.runsDir(projectId), runId);
  }

  private runPath(projectId: string, runId: string): string {
    return join(this.runDir(projectId, runId), "run.json");
  }

  private modelRunsDir(projectId: string, runId: string): string {
    return join(this.runDir(projectId, runId), "model-runs");
  }

  private modelRunDir(projectId: string, runId: string, modelRunId: string): string {
    return join(this.modelRunsDir(projectId, runId), modelRunId);
  }

  private modelRunPath(projectId: string, runId: string, modelRunId: string): string {
    return join(this.modelRunDir(projectId, runId, modelRunId), "model-run.json");
  }

  private attemptDir(projectId: string, runId: string, modelRunId: string): string {
    return join(this.modelRunDir(projectId, runId, modelRunId), "attempts");
  }

  private attemptPath(projectId: string, runId: string, modelRunId: string, attemptId: string): string {
    return join(this.attemptDir(projectId, runId, modelRunId), `${attemptId}.json`);
  }

  private archiveDir(projectId: string, runId: string, modelRunId: string): string {
    return join(this.modelRunDir(projectId, runId, modelRunId), "recognition-archives");
  }

  private archivePath(projectId: string, runId: string, modelRunId: string, attemptId: string): string {
    return join(this.archiveDir(projectId, runId, modelRunId), `${attemptId}.json`);
  }

  private revisionDir(projectId: string, runId: string, modelRunId: string, attemptId: string): string {
    return join(this.modelRunDir(projectId, runId, modelRunId), "analysis-revisions", attemptId);
  }

  private revisionPath(projectId: string, runId: string, modelRunId: string, attemptId: string, revisionId: string): string {
    return join(this.revisionDir(projectId, runId, modelRunId, attemptId), `${revisionId}.json`);
  }

  async saveRun(run: RecognitionRun): Promise<void> {
    await mkdir(this.runDir(run.projectId, run.id), { recursive: true });
    await writeJson(this.runPath(run.projectId, run.id), run);
  }

  async readRun(projectId: string, runId: string): Promise<RecognitionRun | null> {
    try {
      const run = await readJson<RecognitionRun>(this.runPath(projectId, runId));
      return run.projectId === projectId && run.id === runId ? run : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listRuns(projectId: string): Promise<RecognitionRun[]> {
    try {
      const entries = await readdir(this.runsDir(projectId), { withFileTypes: true });
      const runs: RecognitionRun[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const run = await this.readRun(projectId, entry.name);
        if (run) runs.push(run);
      }
      return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async saveModelRun(modelRun: RecognitionModelRun): Promise<void> {
    await mkdir(this.modelRunDir(modelRun.projectId, modelRun.runId, modelRun.id), { recursive: true });
    await writeJson(this.modelRunPath(modelRun.projectId, modelRun.runId, modelRun.id), modelRun);
  }

  async readModelRun(projectId: string, runId: string, modelRunId: string): Promise<RecognitionModelRun | null> {
    try {
      const modelRun = await readJson<RecognitionModelRun>(this.modelRunPath(projectId, runId, modelRunId));
      return modelRun.projectId === projectId && modelRun.runId === runId && modelRun.id === modelRunId ? modelRun : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listModelRuns(projectId: string, runId: string): Promise<RecognitionModelRun[]> {
    try {
      const entries = await readdir(this.modelRunsDir(projectId, runId), { withFileTypes: true });
      const modelRuns: RecognitionModelRun[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const modelRun = await this.readModelRun(projectId, runId, entry.name);
        if (modelRun) modelRuns.push(modelRun);
      }
      return sortedByCreatedAt(modelRuns);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async saveAttempt(attempt: RecognitionModelRunAttempt): Promise<void> {
    await mkdir(this.attemptDir(attempt.projectId, attempt.runId, attempt.modelRunId), { recursive: true });
    await writeJson(this.attemptPath(attempt.projectId, attempt.runId, attempt.modelRunId, attempt.id), attempt);
  }

  async readAttempt(projectId: string, runId: string, modelRunId: string, attemptId: string): Promise<RecognitionModelRunAttempt | null> {
    try {
      const attempt = await readJson<RecognitionModelRunAttempt>(this.attemptPath(projectId, runId, modelRunId, attemptId));
      return attempt.projectId === projectId && attempt.runId === runId && attempt.modelRunId === modelRunId && attempt.id === attemptId ? attempt : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listAttempts(projectId: string, runId: string, modelRunId: string): Promise<RecognitionModelRunAttempt[]> {
    try {
      const entries = await readdir(this.attemptDir(projectId, runId, modelRunId), { withFileTypes: true });
      const attempts: RecognitionModelRunAttempt[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const attemptId = entry.name.slice(0, -".json".length);
        const attempt = await this.readAttempt(projectId, runId, modelRunId, attemptId);
        if (attempt) attempts.push(attempt);
      }
      return attempts.sort((left, right) => left.attemptNumber - right.attemptNumber);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async saveArchive(input: {
    projectId: string;
    runId: string;
    modelRunId: string;
    archive: RecognitionArchive;
  }): Promise<void> {
    const { projectId, runId, modelRunId, archive } = input;
    this.assertArchiveRelationships(projectId, runId, modelRunId, archive);
    await mkdir(this.archiveDir(projectId, runId, modelRunId), { recursive: true });
    await writeJson(this.archivePath(projectId, runId, modelRunId, archive.result.attemptId), archive);
  }

  async readArchive(projectId: string, runId: string, modelRunId: string, attemptId: string): Promise<RecognitionArchive | null> {
    try {
      const archive = await readJson<RecognitionArchive>(this.archivePath(projectId, runId, modelRunId, attemptId));
      this.assertArchiveRelationships(projectId, runId, modelRunId, archive);
      return archive;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listArchives(projectId: string, runId: string, modelRunId: string): Promise<RecognitionArchive[]> {
    try {
      const entries = await readdir(this.archiveDir(projectId, runId, modelRunId), { withFileTypes: true });
      const archives: RecognitionArchive[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const attemptId = entry.name.slice(0, -".json".length);
        const archive = await this.readArchive(projectId, runId, modelRunId, attemptId);
        if (archive) archives.push(archive);
      }
      return archives.sort((left, right) => left.result.createdAt.localeCompare(right.result.createdAt));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async saveAnalysisRevision(revision: RecognitionAnalysisRevision): Promise<void> {
    this.assertArchiveRelationships(revision.projectId, revision.runId, revision.modelRunId, revision.archive);
    if (revision.archive.result.attemptId !== revision.attemptId) {
      throw new Error("Recognition analysis revision does not match its source attempt.");
    }
    await mkdir(this.revisionDir(revision.projectId, revision.runId, revision.modelRunId, revision.attemptId), { recursive: true });
    await writeJson(this.revisionPath(revision.projectId, revision.runId, revision.modelRunId, revision.attemptId, revision.id), revision);
  }

  async listAnalysisRevisions(projectId: string, runId: string, modelRunId: string, attemptId?: string): Promise<RecognitionAnalysisRevision[]> {
    const attemptIds = attemptId ? [attemptId] : (await this.listAttempts(projectId, runId, modelRunId)).map((attempt) => attempt.id);
    const revisions: RecognitionAnalysisRevision[] = [];
    for (const sourceAttemptId of attemptIds) {
      try {
        const entries = await readdir(this.revisionDir(projectId, runId, modelRunId, sourceAttemptId), { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
          const path = this.revisionPath(projectId, runId, modelRunId, sourceAttemptId, entry.name.slice(0, -".json".length));
          const revision = await readJson<RecognitionAnalysisRevision>(path);
          if (revision.projectId !== projectId || revision.runId !== runId || revision.modelRunId !== modelRunId || revision.attemptId !== sourceAttemptId) {
            throw new Error("Recognition analysis revision does not match its parent model run.");
          }
          this.assertArchiveRelationships(projectId, runId, modelRunId, revision.archive);
          revisions.push(revision);
        }
      } catch (error) {
        if (isNotFound(error)) continue;
        throw error;
      }
    }
    return sortedByCreatedAt(revisions);
  }

  private assertArchiveRelationships(projectId: string, runId: string, modelRunId: string, archive: RecognitionArchive): void {
    const result = archive.result;
    if (result.projectId !== projectId || result.runId !== runId || result.modelRunId !== modelRunId) {
      throw new Error("Recognition archive result does not match its parent model run.");
    }
    const sameParent = (entry: { projectId: string; runId: string; modelRunId: string; attemptId: string }): boolean =>
      entry.projectId === projectId && entry.runId === runId && entry.modelRunId === modelRunId && entry.attemptId === result.attemptId;
    const sameResult = (entry: { recognitionResultId: string }): boolean => entry.recognitionResultId === result.id;
    const collections: Array<Array<{ projectId: string; runId: string; modelRunId: string; attemptId: string; recognitionResultId?: string }>> = [
      archive.competitors,
      archive.brandKeywords,
      archive.competitorKeywords,
      archive.claimCitationLinks,
    ];
    for (const collection of collections) {
      if (collection.some((entry) => !sameParent(entry))) throw new Error("Recognition archive entry does not match its parent model run.");
      if (collection.some((entry) => entry.recognitionResultId !== undefined && !sameResult(entry as { recognitionResultId: string }))) {
        throw new Error("Recognition archive entry does not match its recognition result.");
      }
    }
    const supportCollections: Array<Array<{ projectId: string; runId: string; modelRunId: string; attemptId: string }>> = [
      archive.providerCitations,
      archive.answerMentionedUrls,
    ];
    for (const collection of supportCollections) {
      if (collection.some((entry) => !sameParent(entry))) throw new Error("Recognition archive evidence does not match its parent model run.");
    }
    const competitorIds = new Set(archive.competitors.map((entry) => entry.id));
    if (archive.competitorKeywords.some((entry) => !competitorIds.has(entry.competitorRecognitionId))) {
      throw new Error("Competitor keyword does not match a persisted competitor recognition.");
    }
    const citationIds = new Set(archive.providerCitations.map((entry) => entry.id));
    if (archive.claimCitationLinks.some((entry) => !citationIds.has(entry.providerCitationId))) {
      throw new Error("Claim citation link does not match a provider citation.");
    }
  }
}

export type RecognitionArchiveCollections = {
  result: RecognitionResult;
  competitors: CompetitorRecognition[];
  brandKeywords: BrandKeywordRecognition[];
  competitorKeywords: CompetitorKeywordRecognition[];
  providerCitations: ProviderCitation[];
  answerMentionedUrls: AnswerMentionedUrl[];
  claimCitationLinks: ClaimCitationLink[];
};
