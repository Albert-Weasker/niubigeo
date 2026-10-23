import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { publicIPv4 } from "../providers/custom-connection.js";

const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
const reservedIPv6 = new BlockList();
for (const [network, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  reservedIPv6.addSubnet(network, prefix, "ipv6");
}

export function isPublicWebAddress(address: string): boolean {
  if (isIP(address) === 4) return publicIPv4(address);
  // Only global unicast; exclude special-use and IPv4 transition ranges.
  return isIP(address) === 6 && globalIPv6.check(address, "ipv6") && !reservedIPv6.check(address, "ipv6");
}

function unbracket(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function validatePublicWebUrl(value: string): URL {
  const url = new URL(value);
  const rawHost = unbracket(url.hostname).toLowerCase();
  const host = rawHost.endsWith(".") ? rawHost.slice(0, -1) : rawHost;
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !host
    || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")
    || (!isIP(host) && !host.includes(".")) || (isIP(host) && !isPublicWebAddress(host))) {
    throw new Error("Website evidence requires a public HTTP(S) address.");
  }
  return url;
}

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
type Transport = (url: URL, addresses: Address[], signal: AbortSignal) => Promise<{ status: number; location?: string | undefined; contentType: string; text: string }>;
const resolveHost: Resolver = hostname => lookup(hostname, { all: true });

const requestPage: Transport = (url, addresses, signal) => new Promise((resolve, reject) => {
  const first = addresses[0]!;
  const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
    signal,
    // Do not reuse a pooled connection or perform another DNS lookup after validation.
    agent: false,
    lookup: (_hostname, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, first.address, first.family);
    },
    headers: { "Accept": "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8", "Accept-Encoding": "identity" },
  }, response => {
    const status = response.statusCode || 502;
    const contentType = response.headers["content-type"] || "";
    if (status >= 300 && status < 400) {
      response.destroy();
      resolve({ status, location: response.headers.location, contentType, text: "" });
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    response.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) {
        response.destroy(new Error("Website evidence response exceeds 2 MiB."));
        return;
      }
      chunks.push(chunk);
    });
    response.on("error", reject);
    response.on("end", () => resolve({ status, contentType, text: Buffer.concat(chunks).toString("utf8") }));
  });
  req.on("error", reject);
  req.end();
});

/** Every redirect is resolved, validated and pinned independently. No local-provider override. */
export function createPublicWebFetcher(resolve: Resolver = resolveHost, transport: Transport = requestPage) {
  return async (input: string): Promise<{ url: string; text: string; contentType: string } | null> => {
    const signal = AbortSignal.timeout(10_000);
    let next = input;
    for (let redirects = 0; redirects <= 5; redirects++) {
      signal.throwIfAborted();
      const url = validatePublicWebUrl(next);
      const hostname = unbracket(url.hostname);
      const family = isIP(hostname);
      const addresses = family ? [{ address: hostname, family }] : await resolve(hostname);
      signal.throwIfAborted();
      if (!addresses.length || addresses.some(item => !isPublicWebAddress(item.address))) {
        throw new Error("Website evidence cannot access private or reserved addresses.");
      }
      const response = await transport(url, addresses, signal);
      if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
        next = new URL(response.location, url).href;
        continue;
      }
      if (response.status < 200 || response.status >= 300) return null;
      return { url: url.href, text: response.text, contentType: response.contentType };
    }
    throw new Error("Too many website redirects.");
  };
}

export const fetchPublicWebText = createPublicWebFetcher();
