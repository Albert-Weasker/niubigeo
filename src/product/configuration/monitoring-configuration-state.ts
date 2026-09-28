import type { ProductProject } from "../projects/project-schema.js";
import type { ProductBaseline, ProductModelSnapshot } from "./baseline-schema.js";
import type { ProductModelSelection } from "./model-selection-schema.js";
import { recognitionProtocolLanguage, recognitionProtocolSnapshot, type RecognitionProtocolSnapshot } from "./recognition-protocol.js";

export type MonitoringConfigurationStatus = "no_version" | "unchanged" | "changed";

export interface ModelIdentity {
  modelId: string;
  displayName: string;
}

export interface WebSearchModeChange extends ModelIdentity {
  previousMode: ProductModelSnapshot["webSearchMode"];
  currentMode: ProductModelSnapshot["webSearchMode"];
}

export interface MonitoringConfigurationDiff {
  addedModels: ModelIdentity[];
  removedModels: ModelIdentity[];
  webSearchModeChanges: WebSearchModeChange[];
  protocolVersionChange: { previous: string; current: string } | null;
  domainChange: { previous: string; current: string } | null;
  languageChange: { previous: "zh" | "en" | "pt-BR"; current: "zh" | "en" | "pt-BR" } | null;
}

export interface MonitoringConfigurationState {
  status: MonitoringConfigurationStatus;
  currentVersion: number | null;
  nextVersion: number;
  currentBaseline: ProductBaseline | null;
  currentProtocol: RecognitionProtocolSnapshot;
  currentDomain: string;
  currentLanguage: "zh" | "en" | "pt-BR";
  currentModelSnapshots: ProductModelSnapshot[];
  diff: MonitoringConfigurationDiff;
}

function currentSnapshots(selections: ProductModelSelection[]): ProductModelSnapshot[] {
  return selections
    .filter((selection) => selection.enabled && selection.available)
    .map((selection) => ({
      selectionId: selection.id,
      providerId: selection.providerId,
      ...(selection.baseUrl ? { baseUrl: selection.baseUrl, upstreamModelId: selection.upstreamModelId } : {}),
      modelId: selection.modelId,
      displayName: selection.displayName,
      webSearchMode: selection.webSearchMode,
      nativeWebSearchSupported: selection.nativeWebSearchSupported,
      capabilityCheckedAt: selection.updatedAt,
    }))
    .sort((left, right) => left.modelId.localeCompare(right.modelId));
}

function modelIdentity(snapshot: ProductModelSnapshot): ModelIdentity {
  return { modelId: snapshot.modelId, displayName: snapshot.displayName };
}

function noChangeDiff(): MonitoringConfigurationDiff {
  return {
    addedModels: [],
    removedModels: [],
    webSearchModeChanges: [],
    protocolVersionChange: null,
    domainChange: null,
    languageChange: null,
  };
}

function hasDiff(diff: MonitoringConfigurationDiff): boolean {
  return diff.addedModels.length > 0
    || diff.removedModels.length > 0
    || diff.webSearchModeChanges.length > 0
    || diff.protocolVersionChange !== null
    || diff.domainChange !== null
    || diff.languageChange !== null;
}

function modelKey(model: ProductModelSnapshot): string { return JSON.stringify([model.providerId, model.baseUrl || "", model.modelId]); }

function compare(project: ProductProject, baseline: ProductBaseline, selections: ProductModelSelection[]): MonitoringConfigurationDiff {
  const protocol = recognitionProtocolSnapshot();
  const language = recognitionProtocolLanguage(project.defaultLanguage);
  const current = currentSnapshots(selections);
  const previousByModel = new Map(baseline.modelSnapshots.map((snapshot) => [modelKey(snapshot), snapshot]));
  const currentByModel = new Map(current.map((snapshot) => [modelKey(snapshot), snapshot]));
  const addedModels = current.filter((snapshot) => !previousByModel.has(modelKey(snapshot))).map(modelIdentity);
  const removedModels = baseline.modelSnapshots.filter((snapshot) => !currentByModel.has(modelKey(snapshot))).map(modelIdentity);
  const webSearchModeChanges: WebSearchModeChange[] = [];

  for (const snapshot of current) {
    const previous = previousByModel.get(modelKey(snapshot));
    if (previous && previous.webSearchMode !== snapshot.webSearchMode) {
      webSearchModeChanges.push({
        ...modelIdentity(snapshot),
        previousMode: previous.webSearchMode,
        currentMode: snapshot.webSearchMode,
      });
    }
  }

  const previousProtocol = `${baseline.recognitionProtocol.protocolId}/${baseline.recognitionProtocol.protocolVersion}`;
  const currentProtocol = `${protocol.protocolId}/${protocol.protocolVersion}`;
  const protocolChanged = previousProtocol !== currentProtocol
    || baseline.recognitionProtocol.promptTemplateHash !== protocol.promptTemplateHash;

  return {
    addedModels,
    removedModels,
    webSearchModeChanges,
    protocolVersionChange: protocolChanged ? { previous: previousProtocol, current: currentProtocol } : null,
    domainChange: baseline.normalizedDomain === project.normalizedDomain
      ? null
      : { previous: baseline.normalizedDomain, current: project.normalizedDomain },
    languageChange: baseline.language === language ? null : { previous: baseline.language, current: language },
  };
}

export function monitoringConfigurationState(input: {
  project: ProductProject;
  baselines: ProductBaseline[];
  selections: ProductModelSelection[];
}): MonitoringConfigurationState {
  const currentProtocol = recognitionProtocolSnapshot();
  const currentDomain = input.project.normalizedDomain;
  const currentLanguage = recognitionProtocolLanguage(input.project.defaultLanguage);
  const currentModelSnapshots = currentSnapshots(input.selections);
  const currentBaseline = input.project.activeBaselineId
    ? input.baselines.find((baseline) => baseline.id === input.project.activeBaselineId) || null
    : null;
  const currentVersion = currentBaseline?.version || null;
  const nextVersion = currentVersion ? currentVersion + 1 : 1;

  if (!currentBaseline) {
    return {
      status: "no_version",
      currentVersion,
      nextVersion,
      currentBaseline: null,
      currentProtocol,
      currentDomain,
      currentLanguage,
      currentModelSnapshots,
      diff: noChangeDiff(),
    };
  }

  const diff = compare(input.project, currentBaseline, input.selections);
  return {
    status: hasDiff(diff) ? "changed" : "unchanged",
    currentVersion,
    nextVersion,
    currentBaseline,
    currentProtocol,
    currentDomain,
    currentLanguage,
    currentModelSnapshots,
    diff,
  };
}
