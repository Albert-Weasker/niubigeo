import { ProviderRequestError } from "./provider-error.js";

export type OpenRouterSearchProtocol = "server_tool" | "built_in_grounding" | "unsupported";

export interface OpenRouterModelCapability {
  model: string;
  name: string;
  vendor?: string | undefined;
  releasedAt?: string | null | undefined;
  supportedParameters: string[];
  nativeWebSearchSupported: boolean;
  searchProtocol: OpenRouterSearchProtocol;
}

export interface OpenRouterModelCapabilitySource {
  capability(model: string): Promise<OpenRouterModelCapability>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasOwn(object: Record<string, unknown> | null, key: string): boolean {
  return object ? Object.prototype.hasOwnProperty.call(object, key) : false;
}

function protocol(parameters: string[], nativeWebSearchPriced: boolean): OpenRouterSearchProtocol {
  if (!nativeWebSearchPriced) return "unsupported";
  const supported = new Set(parameters);
  if (supported.has("tools")) return "server_tool";
  if (supported.has("web_search_options")) return "built_in_grounding";
  return "unsupported";
}

function vendorName(name: string, modelId: string): string {
  const separator = name.indexOf(":");
  if (separator > 0) return name.slice(0, separator).trim();
  const namespaceEnd = modelId.indexOf("/");
  return namespaceEnd > 0 ? modelId.slice(0, namespaceEnd) : modelId;
}

function releasedAt(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

export class OpenRouterModelCatalog implements OpenRouterModelCapabilitySource {
  private modelsPromise: Promise<Map<string, OpenRouterModelCapability>> | null = null;

  async capability(model: string): Promise<OpenRouterModelCapability> {
    const models = await this.models();
    const found = models.get(model);
    if (!found) {
      throw new ProviderRequestError({
        code: "unsupported_capability",
        message: `OpenRouter model capability metadata is unavailable for ${model}.`,
      });
    }
    return found;
  }

  async list(): Promise<OpenRouterModelCapability[]> {
    return [...(await this.models()).values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  private models(): Promise<Map<string, OpenRouterModelCapability>> {
    if (!this.modelsPromise) {
      this.modelsPromise = this.load().catch((error) => {
        this.modelsPromise = null;
        throw error;
      });
    }
    return this.modelsPromise;
  }

  private async load(): Promise<Map<string, OpenRouterModelCapability>> {
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/models");
    } catch (cause) {
      throw new ProviderRequestError({
        code: "upstream_unavailable",
        message: "OpenRouter model capability catalog could not be reached.",
        cause,
      });
    }
    if (!response.ok) {
      throw new ProviderRequestError({
        code: "upstream_unavailable",
        message: `OpenRouter model capability catalog failed with HTTP ${response.status}.`,
        status: response.status,
      });
    }
    const payload = asObject(await response.json());
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const models = new Map<string, OpenRouterModelCapability>();
    for (const value of data) {
      const row = asObject(value);
      if (typeof row?.id !== "string") continue;
      const supportedParameters = stringValues(row.supported_parameters);
      const pricing = asObject(row.pricing);
      const searchProtocol = protocol(supportedParameters, hasOwn(pricing, "web_search"));
      const name = typeof row.name === "string" ? row.name : row.id;
      models.set(row.id, {
        model: row.id,
        name,
        vendor: vendorName(name, row.id),
        releasedAt: releasedAt(row.created),
        supportedParameters,
        nativeWebSearchSupported: searchProtocol !== "unsupported",
        searchProtocol,
      });
    }
    return models;
  }
}
