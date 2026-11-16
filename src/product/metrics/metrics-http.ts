import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { productDataDir } from "../../config/env.js";
import { sha256 } from "../../utils/hash.js";
import { KeywordMonitorStore } from "../keyword-monitor-store.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductProjectFileStore } from "../projects/project-store.js";
import { WorkerStatusStore } from "../scheduling/worker-status.js";
import { collectProductMetrics } from "./product-metrics.js";
import { PROMETHEUS_CONTENT_TYPE } from "./prometheus-format.js";

async function readVersion(): Promise<string> {
  // In the build, dist/ adds one level between this module and the package root.
  const text = await readFile(new URL("../../../package.json", import.meta.url), "utf8").catch(error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readFile(new URL("../../../../package.json", import.meta.url), "utf8");
  });
  const { version } = JSON.parse(text) as { version: string };
  return version;
}

export function createMetricsHandler() {
  if (process.env.METRICS_ENABLED !== "true") return undefined;

  const includeNames = process.env.METRICS_INCLUDE_NAMES === "true";
  const token = process.env.METRICS_TOKEN;
  const expected = token ? Buffer.from(sha256("bearer " + token), "hex") : undefined;
  const configuredMs = Number(process.env.METRICS_CACHE_SECONDS?.trim() || "30") * 1000;
  const cacheMs = Number.isFinite(configuredMs) && configuredMs >= 0 ? configuredMs : 30_000;
  const root = productDataDir();
  const projectStore = new ProductProjectFileStore(root);
  const stores = {
    projects: new ProductProjectService(projectStore),
    keywords: new KeywordMonitorStore(projectStore),
    workers: new WorkerStatusStore(root),
  };
  let version: string | undefined;
  let cached: { body: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;

  async function scrape(): Promise<string> {
    if (cached && performance.now() < cached.expiresAt) return cached.body;
    pending ??= (async () => {
      version ??= await readVersion();
      const body = await collectProductMetrics(stores, { version, includeNames });
      cached = { body, expiresAt: performance.now() + cacheMs };
      return body;
    })().finally(() => { pending = undefined; });
    return pending;
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    if (expected) {
      const authorization = req.headers.authorization ?? "";
      const normalized = authorization.slice(0, 7).toLowerCase() + authorization.slice(7);
      if (!timingSafeEqual(Buffer.from(sha256(normalized), "hex"), expected)) {
        res.writeHead(401, { "WWW-Authenticate": "Bearer" });
        res.end("Unauthorized\n");
        return;
      }
    }

    let body: string;
    try {
      body = await scrape();
    } catch {
      res.writeHead(503);
      res.end("Metrics unavailable\n");
      return;
    }
    res.writeHead(200, { "Content-Type": PROMETHEUS_CONTENT_TYPE });
    res.end(body);
  };
}
