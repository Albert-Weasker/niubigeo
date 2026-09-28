import { MODEL_PLATFORMS } from "./model-directory.js";
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { customConnection, customConnections, customProviderFetch, withCustomConnection, normalizeCustomBaseUrl, validCustomModel, type CustomConnection } from "../../providers/custom-connection.js";
import { resolveProviderKey, redactRequestSecrets } from "../../config/env.js";
import { OpenAICompatibleProvider } from "../../providers/openai-compatible.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../configuration/model-selection-schema.js";
import { ProviderConnectionInputError } from "./connection-errors.js";

export function requestCustomConnection(req: IncomingMessage): CustomConnection | undefined {
  const base = req.headers["x-niubigeo-base-url"];
  if (base === undefined) return undefined;
  try {
    if (typeof base !== "string") throw new Error();
    const baseUrl = normalizeCustomBaseUrl(base);
    const raw = req.headers["x-niubigeo-models"];
    const models: unknown = raw === undefined ? [] : JSON.parse(typeof raw === "string" ? raw : "null");
    if (!Array.isArray(models) || models.length > 30 || !models.every(validCustomModel)) throw new Error();
    return { baseUrl, models: [...new Set(models)] };
  } catch { throw new ProviderConnectionInputError("自定义接口配置无效。请使用公网 HTTPS Base URL 和有效模型 ID。"); }
}

export function connectionKey(baseUrl: string): string { return "custom-" + createHash("sha256").update(baseUrl).digest("hex"); }
export function customModelId(baseUrl: string, modelId: string): string { return "custom:" + Buffer.from(JSON.stringify([baseUrl, modelId])).toString("base64url"); }
export function resolveCustomModel(id: string): { connection: CustomConnection; modelId: string } | undefined {
  if (!id.startsWith("custom:")) return undefined;
  try {
    const [baseUrl, modelId] = JSON.parse(Buffer.from(id.slice(7), "base64url").toString("utf8"));
    const connection = customConnections().find(item => item.baseUrl === baseUrl);
    if (!connection || !validCustomModel(modelId) || customModelId(baseUrl, modelId) !== id) throw new Error();
    return { connection, modelId };
  } catch { throw new ProviderConnectionInputError("请连接所选模型对应的接口，并重新选择模型。", 422); }
}

export function customModel(modelId: string): ProviderModelCatalogItem {
  if (!validCustomModel(modelId)) throw new ProviderConnectionInputError("模型 ID 无效。");
  return { providerId: "openai-compatible", baseUrl: customConnection()!.baseUrl, modelId: customModelId(customConnection()!.baseUrl, modelId), upstreamModelId: modelId, vendor: MODEL_PLATFORMS.find(item => item.baseUrl === customConnection()!.baseUrl)?.vendors.join(",") || new URL(customConnection()!.baseUrl).hostname, displayName: modelId + " · " + customConnection()!.baseUrl, available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: new Date().toISOString(), source: "custom_endpoint" };
}

async function listCustom(connection: CustomConnection): Promise<ProviderModelCatalogItem[]> {
  return withCustomConnection(connection, async () => {
    if (connection.models.length) return connection.models.map(customModel);
    let response: Response;
    try { response = await customProviderFetch(connection.baseUrl + "/models", { headers: { Authorization: "Bearer " + resolveProviderKey(connectionKey(connection.baseUrl)) }, signal: AbortSignal.timeout(10000) }); }
    catch { throw new ProviderConnectionInputError("无法读取模型目录，可手动填写模型 ID 后连接。", 422); }
    if (response.status === 401 || response.status === 403) throw new ProviderConnectionInputError("Key 验证失败，请检查是否有效或已被撤销。", 401);
    let data: unknown;
    try { data = redactRequestSecrets(await response.json()); } catch { data = null; }
    const rows = data && typeof data === "object" && "data" in data ? (data as { data: unknown }).data : undefined;
    if (!response.ok || !Array.isArray(rows)) throw new ProviderConnectionInputError("无法读取模型目录，可手动填写模型 ID 后连接。", 422);
    const ids = rows.map(row => row && typeof row === "object" ? (row as { id: unknown }).id : undefined).filter(validCustomModel);
    return [...new Set(ids)].slice(0, 2000).map(customModel);
  });
}
export function connectionCatalog(fallback: ProductModelCatalog): ProductModelCatalog {
  return { async list() {
    const active = customConnections();
    // A single-connection discovery request does not require OpenRouter.
    if (customConnection()) return listCustom(customConnection()!);
    const results = await Promise.allSettled([fallback.list(), ...active.map(listCustom)]);
    const models = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (!models.length) { const failure = results.find(result => result.status === "rejected"); if (failure?.status === "rejected") throw failure.reason; }
    return models;
  } };
}
export function selectedCustomModel(id: string): ProviderModelCatalogItem | undefined {
  const custom = resolveCustomModel(id);
  return custom && withCustomConnection(custom.connection, () => customModel(custom.modelId));
}
export function requestConnections(req: IncomingMessage): { connections: CustomConnection[]; keys: Record<string, string> } {
  const raw = req.headers["x-niubigeo-connections"];
  if (raw === undefined) return { connections: [], keys: {} };
  try {
    const values: unknown = JSON.parse(typeof raw === "string" ? raw : "null");
    if (!Array.isArray(values) || values.length > 8) throw new Error();
    const connections: CustomConnection[] = []; const keys: Record<string, string> = {};
    for (const item of values) {
      if (!item || typeof item.apiKey !== "string" || item.apiKey.length < 1 || item.apiKey.length > 512 || ![...item.apiKey].every(c => c >= "!" && c <= "~")) throw new Error();
      if (item.baseUrl === null) { if (keys.openrouter) throw new Error(); keys.openrouter = item.apiKey; continue; }
      const baseUrl = normalizeCustomBaseUrl(item.baseUrl);
      if (connections.some(connection => connection.baseUrl === baseUrl)) throw new Error();
      const models = item.models || [];
      if (!Array.isArray(models) || models.length > 30 || !models.every(validCustomModel)) throw new Error();
      connections.push({ baseUrl, models }); keys[connectionKey(baseUrl)] = item.apiKey;
    }
    return { connections, keys };
  } catch { throw new ProviderConnectionInputError("模型连接配置无效，请重新连接。", 422); }
}

export function customAnswerProvider(baseUrl: string) {
  if (customConnection()?.baseUrl !== baseUrl) throw new ProviderConnectionInputError("请重新连接此监测配置使用的自定义接口。", 409);
  return new OpenAICompatibleProvider({
    definition: { id: "openai-compatible", label: new URL(baseUrl).hostname, sourceType: "api", envKeys: [], defaultModels: [], supportsAnyModel: true, supportsWebSearch: false, supportsNativeCitations: false, resultCaveat: "User-configured OpenAI-compatible API; native search is not verified." },
    endpoint: baseUrl + "/chat/completions", endpointKind: "custom_gateway",
  });
}
