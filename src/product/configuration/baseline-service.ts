import { randomUUID } from "node:crypto";
import { sha256 } from "../../utils/hash.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductBaselineConflictError, ProductBaselineNotFoundError, ProductConfigurationInputError } from "./configuration-errors.js";
import { ProductConfigurationFileStore } from "./configuration-store.js";
import type { ProductBaseline, ProductModelSnapshot } from "./baseline-schema.js";
import { ProductModelSelectionService } from "./model-selection-service.js";
import { monitoringConfigurationState, type MonitoringConfigurationState } from "./monitoring-configuration-state.js";
import { DOMAIN_RECOGNITION_ANALYSIS_VERSION, recognitionProtocolLanguage, recognitionProtocolSnapshot } from "./recognition-protocol.js";

function snapshots(projectId: string, selections: Awaited<ReturnType<ProductModelSelectionService["list"]>>): ProductModelSnapshot[] {
  return selections
    .filter((selection) => selection.projectId === projectId && selection.enabled && selection.available)
    .map((selection) => ({
      selectionId: selection.id,
      providerId: selection.providerId,
      modelId: selection.modelId,
      displayName: selection.displayName,
      webSearchMode: selection.webSearchMode,
      nativeWebSearchSupported: selection.nativeWebSearchSupported,
      capabilityCheckedAt: selection.updatedAt,
    }))
    .sort((left, right) => left.modelId.localeCompare(right.modelId));
}

function configHash(input: Omit<ProductBaseline, "id" | "version" | "projectId" | "createdAt" | "configHash">): string {
  return sha256(JSON.stringify({
    normalizedDomain: input.normalizedDomain,
    recognitionProtocol: input.recognitionProtocol,
    modelSnapshots: input.modelSnapshots.map((snapshot) => ({
      providerId: snapshot.providerId,
      modelId: snapshot.modelId,
      displayName: snapshot.displayName,
      webSearchMode: snapshot.webSearchMode,
      nativeWebSearchSupported: snapshot.nativeWebSearchSupported,
    })),
    language: input.language,
    analysisVersion: input.analysisVersion,
  }));
}

export class ProductBaselineService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly selections: ProductModelSelectionService,
    private readonly store: ProductConfigurationFileStore,
  ) {}

  async list(projectId: string): Promise<ProductBaseline[]> {
    await this.projects.get(projectId);
    return this.store.listBaselines(projectId);
  }

  async get(projectId: string, baselineId: string): Promise<ProductBaseline> {
    await this.projects.get(projectId);
    const baseline = await this.store.readBaseline(projectId, baselineId);
    if (!baseline) throw new ProductBaselineNotFoundError(baselineId);
    return baseline;
  }

  async currentConfiguration(projectId: string): Promise<MonitoringConfigurationState> {
    const project = await this.projects.get(projectId);
    const [baselines, selections] = await Promise.all([
      this.store.listBaselines(projectId),
      this.selections.list(projectId),
    ]);
    return monitoringConfigurationState({ project, baselines, selections });
  }

  async create(projectId: string): Promise<ProductBaseline> {
    const project = await this.projects.get(projectId);
    const modelSnapshots = snapshots(projectId, await this.selections.list(projectId));
    if (modelSnapshots.length === 0) throw new ProductConfigurationInputError("Select at least one available model before creating a baseline.");
    const recognitionProtocol = recognitionProtocolSnapshot();
    const candidate = {
      normalizedDomain: project.normalizedDomain,
      recognitionProtocol,
      modelSnapshots,
      language: recognitionProtocolLanguage(project.defaultLanguage),
      analysisVersion: DOMAIN_RECOGNITION_ANALYSIS_VERSION,
    };
    const hash = configHash(candidate);
    const existing = await this.store.listBaselines(projectId);
    if (existing.some((baseline) => baseline.configHash === hash)) {
      throw new ProductBaselineConflictError("Current configuration already has a baseline.");
    }
    const baseline: ProductBaseline = {
      id: randomUUID(),
      projectId,
      version: existing.length + 1,
      ...candidate,
      configHash: hash,
      createdAt: new Date().toISOString(),
    };
    await this.store.saveBaseline(baseline);
    await this.projects.setActiveBaseline(projectId, baseline.id);
    return baseline;
  }
}
