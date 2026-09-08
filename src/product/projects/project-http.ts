import {
  ProductProjectConflictError,
  ProductProjectInputError,
  ProductProjectNotFoundError,
  ProductProjectStateError,
} from "./project-errors.js";
import type { CreateProductProjectInput, UpdateProductProjectInput } from "./project-schema.js";
import { ProductProjectService } from "./project-service.js";

export type ProjectJsonReader = () => Promise<Record<string, unknown>>;
export type ProjectJsonSender = (status: number, body: unknown) => void;

function optionalText(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === "string" ? body[key] : undefined;
}

function textList(body: Record<string, unknown>, key: string): string[] | undefined {
  if (!Array.isArray(body[key])) return undefined;
  return (body[key] as unknown[]).filter((value): value is string => typeof value === "string");
}

function createInput(body: Record<string, unknown>): CreateProductProjectInput {
  return {
    primaryDomain: optionalText(body, "primaryDomain") || optionalText(body, "domain") || "",
    name: optionalText(body, "name"),
    brandName: optionalText(body, "brandName"),
    aliases: textList(body, "aliases"),
    defaultLanguage: optionalText(body, "defaultLanguage"),
  };
}

function updateInput(body: Record<string, unknown>): UpdateProductProjectInput {
  return {
    primaryDomain: optionalText(body, "primaryDomain") || optionalText(body, "domain"),
    name: optionalText(body, "name"),
    brandName: optionalText(body, "brandName"),
    aliases: textList(body, "aliases"),
    defaultLanguage: optionalText(body, "defaultLanguage"),
  };
}

function queryFlag(url: URL, key: string): boolean {
  return url.searchParams.get(key) === "true";
}

function sendError(send: ProjectJsonSender, error: unknown): void {
  if (error instanceof ProductProjectInputError) return send(400, { error: error.message, code: "invalid_project_input" });
  if (error instanceof ProductProjectNotFoundError) return send(404, { error: error.message, code: "project_not_found" });
  if (error instanceof ProductProjectConflictError) return send(409, { error: error.message, code: "project_domain_conflict" });
  if (error instanceof ProductProjectStateError) return send(409, { error: error.message, code: "project_state_conflict" });
  return send(500, { error: error instanceof Error ? error.message : String(error), code: "project_operation_failed" });
}

/**
 * Phase 1 has no dependency on legacy audit objects. It only owns the
 * persistent project lifecycle and its projectId boundary.
 */
export async function handleProductProjectApi(input: {
  method: string;
  url: URL;
  route: string[];
  service: ProductProjectService;
  readJson: ProjectJsonReader;
  send: ProjectJsonSender;
}): Promise<boolean> {
  const { method, route, service, readJson, send, url } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  try {
    if (route.length === 2 && method === "GET") {
      return send(200, {
        projects: await service.list({
          includeArchived: queryFlag(url, "includeArchived"),
          includeDeleted: queryFlag(url, "includeDeleted"),
        }),
      }), true;
    }
    if (route.length === 2 && method === "POST") {
      return send(201, { project: await service.createDraft(createInput(await readJson())) }), true;
    }

    const projectId = route[2];
    if (!projectId) return false;
    if (route.length === 3 && method === "GET") {
      return send(200, { project: await service.get(projectId, queryFlag(url, "includeDeleted")) }), true;
    }
    if (route.length === 3 && method === "PATCH") {
      return send(200, { project: await service.update(projectId, updateInput(await readJson())) }), true;
    }
    if (route.length === 3 && method === "DELETE") {
      return send(200, { project: await service.delete(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "archive" && method === "POST") {
      return send(200, { project: await service.archive(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "restore" && method === "POST") {
      return send(200, { project: await service.restore(projectId) }), true;
    }
    if (route.length === 4 && route[3] === "purge" && method === "DELETE") {
      await service.purge(projectId);
      return send(200, { projectId, purged: true }), true;
    }
    send(404, { error: "project endpoint not found", code: "project_endpoint_not_found" });
    return true;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}
