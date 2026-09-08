import { ProductProjectNotFoundError } from "../projects/project-errors.js";
import { ProductProjectService } from "../projects/project-service.js";
import {
  ProductBaselineConflictError,
  ProductBaselineNotFoundError,
  ProductConfigurationInputError,
  ProductModelCatalogUnavailableError,
} from "./configuration-errors.js";
import { ProductBaselineService } from "./baseline-service.js";
import { ProductModelSelectionService } from "./model-selection-service.js";
import type { ProductModelCatalog, ProductModelSelectionInput, ProductWebSearchMode } from "./model-selection-schema.js";

export type ProductConfigurationJsonReader = () => Promise<Record<string, unknown>>;
export type ProductConfigurationJsonSender = (status: number, body: unknown) => void;

function selectionInputs(body: Record<string, unknown>): ProductModelSelectionInput[] {
  if (!Array.isArray(body.selections)) throw new ProductConfigurationInputError("selections must be an array.");
  const inputs: ProductModelSelectionInput[] = [];
  for (const value of body.selections) {
    if (!value || typeof value !== "object") throw new ProductConfigurationInputError("Each model selection must be an object.");
    const row = value as Record<string, unknown>;
    if (typeof row.modelId !== "string" || typeof row.webSearchMode !== "string") {
      throw new ProductConfigurationInputError("Each model selection needs modelId and webSearchMode.");
    }
    inputs.push({ modelId: row.modelId, webSearchMode: row.webSearchMode as ProductWebSearchMode });
  }
  return inputs;
}

function sendError(send: ProductConfigurationJsonSender, error: unknown): void {
  if (error instanceof ProductProjectNotFoundError) return send(404, { error: error.message, code: "project_not_found" });
  if (error instanceof ProductBaselineNotFoundError) return send(404, { error: error.message, code: "baseline_not_found" });
  if (error instanceof ProductConfigurationInputError) return send(422, { error: error.message, code: "configuration_invalid" });
  if (error instanceof ProductBaselineConflictError) return send(409, { error: error.message, code: "baseline_unchanged" });
  if (error instanceof ProductModelCatalogUnavailableError) return send(503, { error: error.message, code: "model_catalog_unavailable" });
  return send(500, { error: error instanceof Error ? error.message : String(error), code: "configuration_operation_failed" });
}

export async function handleProductConfigurationApi(input: {
  method: string;
  route: string[];
  readJson: ProductConfigurationJsonReader;
  send: ProductConfigurationJsonSender;
  projects: ProductProjectService;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  catalog: ProductModelCatalog;
}): Promise<boolean> {
  const { method, route, readJson, send, projects, selections, baselines, catalog } = input;
  try {
    if (route.length === 2 && route[0] === "api" && route[1] === "provider-models" && method === "GET") {
      return send(200, { providerId: "openrouter", models: await catalog.list() }), true;
    }
    if (route.length < 4 || route[0] !== "api" || route[1] !== "projects") return false;
    const projectId = route[2];
    if (!projectId) return false;
    if (route.length === 4 && route[3] === "models" && method === "GET") {
      return send(200, { selections: await selections.list(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "models" && method === "PUT") {
      return send(200, { selections: await selections.replace(projectId, selectionInputs(await readJson())) }), true;
    }
    if (route.length === 4 && route[3] === "monitoring-configuration" && method === "GET") {
      return send(200, { configuration: await baselines.currentConfiguration(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "baselines" && method === "GET") {
      return send(200, { baselines: await baselines.list(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "baselines" && method === "POST") {
      return send(201, { baseline: await baselines.create(projectId), project: await projects.get(projectId) }), true;
    }
    if (route.length === 5 && route[3] === "baselines" && method === "GET") {
      return send(200, { baseline: await baselines.get(projectId, route[4] || "") }), true;
    }
    return false;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}
