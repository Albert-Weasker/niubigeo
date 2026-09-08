import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { AnswerResult } from "../src/core/types.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";
import type { ProductBaseline, ProductModelSnapshot } from "../src/product/configuration/baseline-schema.js";
import { OpenRouterRecognitionAnswerExecutor, type RecognitionAnswerExecutor, type RecognitionExecutionContext } from "../src/product/recognition/recognition-service.js";
import type { RecognitionRequestParameters } from "../src/product/recognition/recognition-schema.js";

export const REAL_PROVIDER_REQUEST_LIMIT = 140;
export const REAL_PROVIDER_COST_LIMIT_USD = 5;
export const REAL_PROVIDER_MAX_INPUT_TOKENS = 12000;
export const REAL_PROVIDER_MAX_OUTPUT_TOKENS = 900;

export type RealProviderPurpose = "discovery" | "manual_measurement" | "scheduled_measurement";

export type CatalogPricing = {
  promptPerToken: number;
  completionPerToken: number;
  webSearchPerRequest: number;
};

export type CatalogModel = {
  modelId: string;
  displayName: string;
  supportedParameters: string[];
  pricing: CatalogPricing;
};

export type CycleCaseReference = {
  caseId: string;
  projectId: string;
};

export type ProviderLedgerEntry = {
  id: string;
  caseId: string;
  projectId: string;
  runId: string | null;
  modelRunId: string | null;
  probeRunId: string | null;
  attemptId: string | null;
  purpose: RealProviderPurpose;
  providerId: "openrouter";
  requestedModelId: string;
  requestedWebSearchMode: "off" | "provider_native";
  startedAt: string;
  finishedAt: string | null;
  status: "reserved" | "completed" | "failed";
  estimatedUpperBoundUsd: number;
  actualCostUsd: number | null;
  costState: "reserved" | "known" | "unknown";
  providerRequestId: string | null;
  promptHash: string | null;
  requestParameters: RecognitionRequestParameters | null;
  rawAnswerHash: string | null;
  rawEvidencePath: string | null;
  rawEvidenceError: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  error: string | null;
};

export type ProviderLedger = {
  schemaVersion: "real-provider-ledger/v2";
  requestLimit: number;
  costLimitUsd: number;
  entries: ProviderLedgerEntry[];
};

type HistoricalLedgerEntry = {
  estimatedUpperBoundUsd?: unknown;
};

type HistoricalLedger = {
  schemaVersion?: unknown;
  entries?: unknown;
};

export type HistoricalProviderUsage = {
  requestCount: number;
  reservedUpperBoundUsd: number;
  ledgers: Array<{
    path: string;
    schemaVersion: string | null;
    entryCount: number;
    reservedUpperBoundUsd: number;
  }>;
};

export type NativeSearchSmokeRecord = {
  modelId: string;
  modelRunStatus: string;
  rawAnswer: string | undefined;
  search: {
    requested?: boolean;
    used?: boolean;
    executionMode?: string;
    citationCount?: number;
  } | undefined;
};

export class RealProviderBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealProviderBudgetError";
  }
}

export function assertNativeSearchSmoke(record: NativeSearchSmokeRecord): void {
  if (record.modelRunStatus !== "completed") {
    throw new Error(`Native-search smoke model ${record.modelId} ended as ${record.modelRunStatus}.`);
  }
  if (!record.rawAnswer) {
    throw new Error(`Native-search smoke model ${record.modelId} did not persist a raw answer.`);
  }
  if (!record.search?.requested || !record.search.used) {
    throw new Error(`Native-search smoke model ${record.modelId} did not execute provider search.`);
  }
  if (record.search.executionMode !== "native") {
    throw new Error(`Native-search smoke model ${record.modelId} did not confirm native provider search.`);
  }
  if (!record.search.citationCount || record.search.citationCount < 1) {
    throw new Error(`Native-search smoke model ${record.modelId} did not return a provider citation.`);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function historicalLedger(value: unknown): HistoricalLedger | null {
  const row = asObject(value);
  if (!row || !Array.isArray(row.entries)) return null;
  return row as HistoricalLedger;
}

function historicalEntryCost(value: unknown): number {
  const row = value as HistoricalLedgerEntry;
  return asNumber(row.estimatedUpperBoundUsd) ?? 0;
}

async function filesIn(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const values: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await filesIn(path));
    if (entry.isFile() && entry.name === "provider-ledger.json") values.push(path);
  }
  return values.sort((left, right) => left.localeCompare(right));
}

export async function historicalProviderUsage(validationDirectory: string, currentLedgerPath: string): Promise<HistoricalProviderUsage> {
  const paths = await filesIn(validationDirectory);
  const ledgers: HistoricalProviderUsage["ledgers"] = [];
  for (const path of paths) {
    if (path === currentLedgerPath) continue;
    const file = await stat(path);
    if (!file.isFile()) continue;
    let parsed: HistoricalLedger | null = null;
    try {
      parsed = historicalLedger(JSON.parse(await readFile(path, "utf8")));
    } catch {
      parsed = null;
    }
    if (!parsed || !Array.isArray(parsed.entries)) continue;
    const reservedUpperBoundUsd = parsed.entries.reduce((total, entry) => total + historicalEntryCost(entry), 0);
    ledgers.push({
      path: relative(process.cwd(), path),
      schemaVersion: typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : null,
      entryCount: parsed.entries.length,
      reservedUpperBoundUsd,
    });
  }
  return {
    requestCount: ledgers.reduce((total, ledger) => total + ledger.entryCount, 0),
    reservedUpperBoundUsd: ledgers.reduce((total, ledger) => total + ledger.reservedUpperBoundUsd, 0),
    ledgers,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function textValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function pricing(value: unknown): CatalogPricing | null {
  const row = asObject(value);
  if (!row) return null;
  const promptPerToken = asNumber(row.prompt);
  const completionPerToken = asNumber(row.completion);
  const reportedWebSearchPrice = asNumber(row.web_search);
  if (promptPerToken === null || completionPerToken === null) return null;
  return { promptPerToken, completionPerToken, webSearchPerRequest: reportedWebSearchPrice ?? 0 };
}

export async function readOpenRouterCatalog(): Promise<CatalogModel[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) throw new Error(`OpenRouter model catalog failed with HTTP ${response.status}.`);
  const payload = asObject(await response.json());
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const values: CatalogModel[] = [];
  for (const value of data) {
    const row = asObject(value);
    if (!row || typeof row.id !== "string") continue;
    const rowPricing = pricing(row.pricing);
    if (!rowPricing) continue;
    values.push({
      modelId: row.id,
      displayName: typeof row.name === "string" ? row.name : row.id,
      supportedParameters: textValues(row.supported_parameters),
      pricing: rowPricing,
    });
  }
  return values.sort((left, right) => left.modelId.localeCompare(right.modelId));
}

export class FrozenModelCatalog implements ProductModelCatalog {
  constructor(private readonly models: CatalogModel[]) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    const checkedAt = nowIso();
    return this.models.map((model) => ({
      providerId: "openrouter",
      modelId: model.modelId,
      displayName: model.displayName,
      available: true,
      unavailableReason: null,
      nativeWebSearchSupported: model.pricing.webSearchPerRequest > 0 && model.supportedParameters.includes("tools"),
      checkedAt,
      source: "openrouter_catalog",
    }));
  }
}

export function upperBound(pricingValue: CatalogPricing, webSearchMode: "off" | "provider_native"): number {
  const text = REAL_PROVIDER_MAX_INPUT_TOKENS * pricingValue.promptPerToken
    + REAL_PROVIDER_MAX_OUTPUT_TOKENS * pricingValue.completionPerToken;
  return text + (webSearchMode === "provider_native" ? pricingValue.webSearchPerRequest : 0);
}

function totalReserved(ledger: ProviderLedger): number {
  return ledger.entries.reduce((sum, entry) => sum + (entry.costState === "known" && entry.actualCostUsd !== null ? entry.actualCostUsd : entry.estimatedUpperBoundUsd), 0);
}

function currentRequests(ledger: ProviderLedger): number {
  return ledger.entries.length;
}

function rawProviderRequestId(value: unknown): string | null {
  const row = asObject(value);
  return typeof row?.id === "string" ? row.id : null;
}

export function createLedger(): ProviderLedger {
  return { schemaVersion: "real-provider-ledger/v2", requestLimit: REAL_PROVIDER_REQUEST_LIMIT, costLimitUsd: REAL_PROVIDER_COST_LIMIT_USD, entries: [] };
}

export class LedgeredRecognitionExecutor implements RecognitionAnswerExecutor {
  private ledgerLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly ledgerPath: string,
    private readonly models: Map<string, CatalogModel>,
    private readonly caseReferences: Map<string, CycleCaseReference>,
    private readonly purposeByProject: Map<string, RealProviderPurpose>,
    private readonly previousUsage: HistoricalProviderUsage = { requestCount: 0, reservedUpperBoundUsd: 0, ledgers: [] },
    private readonly delegate: RecognitionAnswerExecutor = new OpenRouterRecognitionAnswerExecutor(),
  ) {}

  async execute(input: {
    baseline: ProductBaseline;
    modelSnapshot: ProductModelSnapshot;
    prompt: string;
    requestParameters: RecognitionRequestParameters;
    executionContext?: RecognitionExecutionContext | undefined;
    structuredOutput?: { name: string; description: string; schema: Record<string, unknown> } | undefined;
  }): Promise<AnswerResult> {
    const caseReference = this.caseReferences.get(input.baseline.projectId);
    if (!caseReference) throw new RealProviderBudgetError("The real Provider case identity is not registered.");
    const purpose = this.purposeByProject.get(input.baseline.projectId);
    if (!purpose) throw new RealProviderBudgetError("The real Provider request purpose is not registered.");
    const model = this.models.get(input.modelSnapshot.modelId);
    if (!model) throw new RealProviderBudgetError("The selected model is not in the frozen pricing catalog.");
    const mode = input.modelSnapshot.webSearchMode;
    const estimatedUpperBoundUsd = upperBound(model.pricing, mode);
    const entry = await this.changeLedger(async (ledger) => {
      if (this.previousUsage.requestCount + currentRequests(ledger) >= ledger.requestLimit) throw new RealProviderBudgetError("The real Provider request limit has been reached across validation cycles.");
      if (this.previousUsage.reservedUpperBoundUsd + totalReserved(ledger) + estimatedUpperBoundUsd > ledger.costLimitUsd) throw new RealProviderBudgetError("The real Provider cost cap would be exceeded across validation cycles.");
      const reserved: ProviderLedgerEntry = {
        id: randomUUID(),
        caseId: caseReference.caseId,
        projectId: caseReference.projectId,
        runId: input.executionContext?.runId || null,
        modelRunId: input.executionContext?.modelRunId || null,
        probeRunId: input.executionContext?.probeRunId || null,
        attemptId: input.executionContext?.attemptId || null,
        purpose,
        providerId: "openrouter",
        requestedModelId: model.modelId,
        requestedWebSearchMode: mode,
        startedAt: nowIso(),
        finishedAt: null,
        status: "reserved",
        estimatedUpperBoundUsd,
        actualCostUsd: null,
        costState: "reserved",
        providerRequestId: null,
        promptHash: await this.hash(input.prompt),
        requestParameters: input.requestParameters,
        rawAnswerHash: null,
        rawEvidencePath: null,
        rawEvidenceError: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        error: null,
      };
      ledger.entries.push(reserved);
      return reserved;
    });
    try {
      const answer = await this.delegate.execute(input);
      const archive = await this.archiveRawEvidence(entry, input, answer);
      await this.changeLedger(async (ledger) => {
        const target = ledger.entries.find((item) => item.id === entry.id);
        if (!target) throw new Error("The reserved Provider ledger entry is missing.");
        target.status = "completed";
        target.finishedAt = nowIso();
        target.actualCostUsd = answer.costUsd === undefined ? null : answer.costUsd;
        target.costState = answer.costUsd === undefined ? "unknown" : "known";
        target.providerRequestId = rawProviderRequestId(answer.rawProviderResponse);
        target.rawAnswerHash = await this.hash(answer.text);
        target.rawEvidencePath = archive.path;
        target.rawEvidenceError = archive.error;
        target.inputTokens = answer.tokenUsage?.input ?? null;
        target.outputTokens = answer.tokenUsage?.output ?? null;
        target.totalTokens = answer.tokenUsage?.total ?? null;
      });
      return answer;
    } catch (error) {
      await this.changeLedger(async (ledger) => {
        const target = ledger.entries.find((item) => item.id === entry.id);
        if (!target) return;
        target.status = "failed";
        target.finishedAt = nowIso();
        target.costState = "unknown";
        target.error = error instanceof Error ? error.message : String(error);
      });
      throw error;
    }
  }

  private async loadLedger(): Promise<ProviderLedger> {
    try {
      return await readJson<ProviderLedger>(this.ledgerPath);
    } catch {
      const ledger = createLedger();
      await writeJson(this.ledgerPath, ledger);
      return ledger;
    }
  }

  private async changeLedger<T>(operation: (ledger: ProviderLedger) => Promise<T>): Promise<T> {
    const previous = this.ledgerLock;
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.ledgerLock = previous.then(() => hold);
    await previous;
    try {
      const ledger = await this.loadLedger();
      const result = await operation(ledger);
      await writeJson(this.ledgerPath, ledger);
      return result;
    } finally {
      release?.();
    }
  }

  private async hash(value: string): Promise<string> {
    const crypto = await import("node:crypto");
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private async archiveRawEvidence(
    entry: ProviderLedgerEntry,
    input: Parameters<RecognitionAnswerExecutor["execute"]>[0],
    answer: AnswerResult,
  ): Promise<{ path: string | null; error: string | null }> {
    const archivePath = join(dirname(this.ledgerPath), "raw", `${entry.id}.json`);
    try {
      await writeJson(archivePath, {
        ledgerEntryId: entry.id,
        projectId: entry.projectId,
        runId: entry.runId,
        modelRunId: entry.modelRunId,
        probeRunId: entry.probeRunId,
        attemptId: entry.attemptId,
        providerId: entry.providerId,
        requestedModelId: entry.requestedModelId,
        requestedWebSearchMode: entry.requestedWebSearchMode,
        promptHash: entry.promptHash,
        requestParameters: input.requestParameters,
        rawAnswer: answer.text,
        rawProviderResponse: answer.rawProviderResponse === undefined ? null : answer.rawProviderResponse,
        providerSearch: answer.search,
        tokenUsage: answer.tokenUsage || null,
        costUsd: answer.costUsd ?? null,
      });
      return { path: relative(process.cwd(), archivePath), error: null };
    } catch (error) {
      return { path: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
