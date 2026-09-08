import type { AuditPlan, MonitoringPrompt, ProviderTarget } from "../core/types.js";
import type { ProjectStore } from "../projects/project-store.js";
import type { BaselineStore } from "./baseline-store.js";
import { BaselineBuilder } from "./baseline-builder.js";
import type { MonitoringBaseline } from "./baseline-schema.js";

type BaselineServiceStore = ProjectStore & BaselineStore;

export class BaselineService {
  private readonly builder = new BaselineBuilder();

  constructor(private readonly store: BaselineServiceStore) {}

  async createDraft(projectId: string, plan: AuditPlan, name?: string): Promise<MonitoringBaseline> {
    return this.createFromPlan(projectId, plan, "draft", name);
  }

  async createFromConfirmedPlan(projectId: string, plan: AuditPlan, name?: string): Promise<MonitoringBaseline> {
    return this.createFromPlan(projectId, plan, "active", name);
  }

  private async createFromPlan(
    projectId: string,
    plan: AuditPlan,
    status: "draft" | "active",
    name?: string,
  ): Promise<MonitoringBaseline> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const built = this.builder.fromAuditPlan(project, plan);
    const baseline: MonitoringBaseline = {
      ...built,
      name: name?.trim() || built.name,
      status,
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveBaseline(baseline);
    return baseline;
  }

  async activate(projectId: string, baselineId: string): Promise<MonitoringBaseline> {
    const baseline = await this.requireBaseline(projectId, baselineId);
    if (!baseline.trendEligible) throw new Error(baseline.nonComparableReason || "This baseline cannot be used for trends.");
    const active: MonitoringBaseline = { ...baseline, status: "active", updatedAt: new Date().toISOString() };
    await this.store.saveBaseline(active);
    return active;
  }

  async retire(projectId: string, baselineId: string): Promise<MonitoringBaseline> {
    const baseline = await this.requireBaseline(projectId, baselineId);
    const retired: MonitoringBaseline = { ...baseline, status: "retired", updatedAt: new Date().toISOString() };
    await this.store.saveBaseline(retired);
    return retired;
  }

  async derive(
    projectId: string,
    baselineId: string,
    changes: {
      selectedPromptIds?: string[] | undefined;
      providerTargets?: ProviderTarget[] | undefined;
      language?: string | undefined;
      runCountPerPrompt?: number | undefined;
    },
    name?: string,
  ): Promise<MonitoringBaseline> {
    const project = await this.store.readProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const source = await this.requireBaseline(projectId, baselineId);
    const selected = changes.selectedPromptIds
      ? new Set(changes.selectedPromptIds)
      : undefined;
    const prompts: MonitoringPrompt[] = selected
      ? source.prompts.filter((prompt) => selected.has(prompt.id))
      : source.prompts;
    const providerTargets = changes.providerTargets || source.providerTargets;
    if (prompts.filter((prompt) => prompt.enabled).length === 0) throw new Error("A monitoring baseline requires at least one enabled question.");
    if (providerTargets.length === 0) throw new Error("A monitoring baseline requires at least one provider model.");
    const built = this.builder.derive(project, source, {
      prompts,
      providerTargets,
      language: changes.language,
      runCountPerPrompt: changes.runCountPerPrompt,
    });
    const existing = await this.store.readBaseline(projectId, built.id);
    if (existing) return existing;
    const baseline: MonitoringBaseline = {
      ...built,
      name: name?.trim() || built.name,
      status: "active",
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveBaseline(baseline);
    return baseline;
  }

  private async requireBaseline(projectId: string, baselineId: string): Promise<MonitoringBaseline> {
    const baseline = await this.store.readBaseline(projectId, baselineId);
    if (!baseline) throw new Error(`Baseline not found: ${baselineId}`);
    if (baseline.projectId !== projectId) throw new Error("Baseline does not belong to the project.");
    return baseline;
  }
}
