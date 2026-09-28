import { AsyncLocalStorage } from "node:async_hooks";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { request as httpRequest } from "node:http";
import { isIP } from "node:net";

export interface CustomConnection { baseUrl: string; models: string[]; }
const connectionsScope = new AsyncLocalStorage<CustomConnection[]>();
export const customConnections = () => connectionsScope.getStore() || (customConnection() ? [customConnection()!] : []);
export function withCustomConnections<T>(connections: CustomConnection[], work: () => T): T { return connectionsScope.run(connections, work); }
const transportScope = new AsyncLocalStorage<typeof customProviderFetch>();
export function withCustomProviderTransport<T>(transport: typeof customProviderFetch | undefined, work: () => T): T { return transport ? transportScope.run(transport, work) : work(); }
const scope = new AsyncLocalStorage<CustomConnection | undefined>();
export const customConnection = () => scope.getStore();
export function withCustomConnection<T>(connection: CustomConnection | undefined, work: () => T): T { return scope.run(connection, work); }

export function normalizeCustomBaseUrl(value: string): string {
  const url = new URL(value);
  if (value.length > 2048 || (url.protocol !== "https:" && !(process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS === "true" && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443" && process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS !== "true")) throw new Error("请填写不含凭据、查询参数的公网 HTTPS Base URL。");
  if (process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS !== "true" && (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || isIP(url.hostname) || url.hostname.includes(":"))) throw new Error("Base URL 必须使用公网域名。");
  let path = url.pathname;
  while (path.endsWith("/")) path = path.slice(0, -1);
  for (const suffix of ["/chat/completions", "/models"]) if (path.endsWith(suffix)) path = path.slice(0, -suffix.length);
  return url.origin + path;
}

export function validCustomModel(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && value === value.trim() && [...value].every(c => c >= "!" && c <= "~");
}

export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

/** Resolve and pin a public address for each connection; never follow redirects. */
export async function customProviderFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const transport = transportScope.getStore();
  if (transport) return transport(url, init);
  const target = new URL(url);
  normalizeCustomBaseUrl(target.origin);
  const addresses = await lookup(target.hostname, { family: 4, all: true });
  if (!addresses.length || (process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS !== "true" && addresses.some(item => !publicIPv4(item.address)))) throw new Error("接口地址不能指向内网或保留地址。");
  const address = addresses[0]!.address;
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, name) => { headers[name] = value; });
  return new Promise((resolve, reject) => {
    const req = (target.protocol === "http:" ? httpRequest : request)(target, {
      method: init.method || "GET", headers, family: 4,
      signal: init.signal || AbortSignal.timeout(45000),
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, res => {
      const chunks: Buffer[] = []; let bytes = 0;
      res.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) { res.destroy(new Error("接口响应过大。")); return; } chunks.push(chunk); });
      res.on("error", reject);
      res.on("end", () => {
        const status = res.statusCode || 502;
        if (status >= 300 && status < 400) { reject(new Error("接口重定向不受支持，请填写最终 Base URL。")); return; }
        resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status }));
      });
    });
    req.on("error", reject);
    req.end(typeof init.body === "string" ? init.body : undefined);
  });
}
