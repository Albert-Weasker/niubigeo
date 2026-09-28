const isVisibleAscii = (value: string) => [...value].every(character => character >= "!" && character <= "~");
import type { IncomingMessage } from "node:http";
import { ProviderConnectionInputError } from "./connection-errors.js";

export function requestOpenRouterKey(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const key = header.slice(7);
  if (header.slice(0, 7).toLowerCase() !== "bearer " || (req.headers["x-niubigeo-base-url"] ? key.length < 1 : key.length < 16) || key.length > 512 || !isVisibleAscii(key)) {
    throw new ProviderConnectionInputError("OpenRouter Key 格式无效，请重新输入。", 401);
  }
  return key;
}

export async function validateOpenRouterKey(key: string, request: typeof fetch = fetch): Promise<{ connected: true; billing: "user" }> {
  let response: Response;
  try {
    response = await request("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(10000) });
  } catch { throw new ProviderConnectionInputError("暂时无法连接 OpenRouter，请稍后重试。", 502); }
  if (response.status === 401 || response.status === 403) throw new ProviderConnectionInputError("Key 验证失败，请检查是否有效或已被撤销。", 401);
  if (!response.ok) throw new ProviderConnectionInputError("OpenRouter 暂时无法验证 Key，请稍后重试。", 502);
  let body: { data?: unknown };
  try { body = await response.json() as { data?: unknown }; } catch { throw new ProviderConnectionInputError("OpenRouter 验证响应无效，请稍后重试。", 502); }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new ProviderConnectionInputError("OpenRouter 验证响应无效，请稍后重试。", 502);
  // Return no account identity, key label or raw upstream errors.
  return { connected: true, billing: "user" };
}
