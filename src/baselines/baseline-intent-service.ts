import { resolveProviderKey } from "../config/env.js";
import { ProviderCatalog } from "../providers/catalog.js";
import { analysisModelFor } from "../providers/provider-role.js";
import { MonitoringPromptIntentClassifier } from "../prompts/monitoring-prompt-intent-classifier.js";
import type { ProjectMonitoringStore } from "../projects/project-store.js";
import { BaselineBuilder } from "./baseline-builder.js";
import type { MonitoringBaseline } from "./baseline-schema.js";

export class BaselineIntentService {
  private readonly catalog = new ProviderCatalog();
  private readonly classifier = new MonitoringPromptIntentClassifier();
  private readonly builder = new BaselineBuilder();

  constructor(private readonly store: ProjectMonitoringStore) {}

  async classify(projectId: string, baselineId: string): Promise<MonitoringBaseline> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const source = await this.store.readBaseline(projectId, baselineId);
    if (!source) throw new Error(`Baseline not found: ${baselineId}`);
    if (source.prompts.every((prompt) => !prompt.enabled || prompt.intentProfile?.status === "completed")) return source;
    const providerTarget = source.providerTargets[0];
    if (!providerTarget) throw new Error("A baseline needs at least one provider model to classify its questions.");
    const provider = this.catalog.get(providerTarget.providerId);
    const apiKey = resolveProviderKey(providerTarget.providerId);
    const prompts = await this.classifier.classify({
      target: project.target,
      language: source.language,
      prompts: source.prompts,
      provider,
      model: analysisModelFor(provider, providerTarget.model),
      apiKey,
    });
    const built = this.builder.derive(project, source, { prompts });
    const baseline: MonitoringBaseline = {
      ...built,
      name: source.name,
      status: "active",
      updatedAt: new Date().toISOString(),
    };
    if (source.status === "active") {
      await this.store.saveBaseline({ ...source, status: "retired", updatedAt: baseline.updatedAt });
    }
    await this.store.saveBaseline(baseline);
    const tasks = await this.store.listTasks(projectId);
    for (const task of tasks.filter((row) => row.baselineId === source.id)) {
      await this.store.saveTask({ ...task, baselineId: baseline.id, updatedAt: baseline.updatedAt });
    }
    return baseline;
  }
}
