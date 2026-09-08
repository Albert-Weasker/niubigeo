import { randomUUID } from "node:crypto";
import { normalizeDomain, titleFromDomain } from "../../utils/domain.js";
import {
  ProductProjectConflictError,
  ProductProjectInputError,
  ProductProjectNotFoundError,
  ProductProjectStateError,
} from "./project-errors.js";
import type {
  CreateProductProjectInput,
  ProductProject,
  ProductProjectListOptions,
  RestorableProductProjectStatus,
  UpdateProductProjectInput,
} from "./project-schema.js";
import { ProductProjectFileStore } from "./project-store.js";

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueText(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values || []) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function restorableStatus(status: ProductProject["status"]): RestorableProductProjectStatus {
  if (status === "active" || status === "archived") return status;
  return "draft";
}

export class ProductProjectService {
  constructor(private readonly store: ProductProjectFileStore) {}

  async createDraft(input: CreateProductProjectInput): Promise<ProductProject> {
    const normalizedDomain = normalizeDomain(input.primaryDomain);
    if (!normalizedDomain) throw new ProductProjectInputError("A valid primary domain is required.");
    return this.store.withDomainLock(normalizedDomain, async () => {
      await this.assertDomainAvailable(normalizedDomain);
      const createdAt = nowIso();
      const defaultName = titleFromDomain(normalizedDomain);
      const project: ProductProject = {
        id: randomUUID(),
        name: cleanOptionalText(input.name) || defaultName,
        primaryDomain: normalizedDomain,
        normalizedDomain,
        brandName: cleanOptionalText(input.brandName) || defaultName,
        aliases: uniqueText(input.aliases),
        defaultLanguage: cleanOptionalText(input.defaultLanguage) || "en",
        status: "draft",
        createdAt,
        updatedAt: createdAt,
      };
      await this.store.save(project);
      return project;
    });
  }

  async list(options: ProductProjectListOptions = {}): Promise<ProductProject[]> {
    return this.store.list(options);
  }

  async get(projectId: string, includeDeleted = false): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status === "deleted" && !includeDeleted) throw new ProductProjectNotFoundError(projectId);
    return project;
  }

  async update(projectId: string, input: UpdateProductProjectInput): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status === "deleted") throw new ProductProjectStateError("A deleted project cannot be edited.");
    const requestedDomain = input.primaryDomain === undefined ? project.normalizedDomain : normalizeDomain(input.primaryDomain);
    if (!requestedDomain) throw new ProductProjectInputError("A valid primary domain is required.");

    const save = async (): Promise<ProductProject> => {
      await this.assertDomainAvailable(requestedDomain, project.id);
      const updated: ProductProject = {
        ...project,
        primaryDomain: requestedDomain,
        normalizedDomain: requestedDomain,
        name: cleanOptionalText(input.name) || project.name,
        brandName: cleanOptionalText(input.brandName) || project.brandName,
        aliases: input.aliases === undefined ? project.aliases : uniqueText(input.aliases),
        defaultLanguage: cleanOptionalText(input.defaultLanguage) || project.defaultLanguage,
        updatedAt: nowIso(),
      };
      await this.store.save(updated);
      return updated;
    };

    if (requestedDomain === project.normalizedDomain) return save();
    return this.store.withDomainLock(requestedDomain, save);
  }

  async archive(projectId: string): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status === "deleted") throw new ProductProjectStateError("A deleted project cannot be archived.");
    if (project.status === "archived") return project;
    const archived: ProductProject = {
      ...project,
      status: "archived",
      statusBeforeArchive: project.status,
      archivedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.store.save(archived);
    return archived;
  }

  async restore(projectId: string): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status !== "archived" && project.status !== "deleted") return project;
    return this.store.withDomainLock(project.normalizedDomain, async () => {
      await this.assertDomainAvailable(project.normalizedDomain, project.id);
      const restoredStatus = project.status === "archived" ? project.statusBeforeArchive || "draft" : project.statusBeforeDelete || "draft";
      const restored: ProductProject = {
        ...project,
        status: restoredStatus,
        statusBeforeArchive: undefined,
        statusBeforeDelete: undefined,
        archivedAt: undefined,
        deletedAt: undefined,
        updatedAt: nowIso(),
      };
      await this.store.save(restored);
      return restored;
    });
  }

  async delete(projectId: string): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status === "deleted") return project;
    const deleted: ProductProject = {
      ...project,
      status: "deleted",
      statusBeforeDelete: restorableStatus(project.status),
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.store.save(deleted);
    return deleted;
  }

  async purge(projectId: string): Promise<void> {
    const project = await this.require(projectId);
    if (project.status !== "deleted") throw new ProductProjectStateError("Only a deleted project can be permanently removed.");
    await this.store.purge(projectId);
  }

  async setActiveBaseline(projectId: string, baselineId: string): Promise<ProductProject> {
    const project = await this.require(projectId);
    if (project.status === "deleted") throw new ProductProjectStateError("A deleted project cannot receive a baseline.");
    const updated: ProductProject = {
      ...project,
      activeBaselineId: baselineId,
      updatedAt: nowIso(),
    };
    await this.store.save(updated);
    return updated;
  }

  private async require(projectId: string): Promise<ProductProject> {
    const project = await this.store.read(projectId);
    if (!project) throw new ProductProjectNotFoundError(projectId);
    return project;
  }

  private async assertDomainAvailable(normalizedDomain: string, exceptProjectId?: string): Promise<void> {
    const projects = await this.store.listAll();
    const conflict = projects.find(
      (project) => project.id !== exceptProjectId && project.normalizedDomain === normalizedDomain && project.status !== "deleted",
    );
    if (conflict) throw new ProductProjectConflictError(normalizedDomain);
  }
}
