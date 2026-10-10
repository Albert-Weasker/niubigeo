import { customConnection, customConnections, withCustomConnection, withCustomConnections, withCustomProviderTransport, type customProviderFetch } from "../providers/custom-connection.js";
import { connectionCatalog, requestCustomConnection, requestConnections, connectionKey } from "./connections/provider-connections.js";
import { requestOpenRouterKey, validateOpenRouterKey } from "./connections/connection-http.js";
import { ProviderConnectionInputError } from "./connections/connection-errors.js";
import { renderProviderConnectionsUi } from "../ui/provider-connections-ui.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadDotEnv, productDataDir, withRequestProviderKeys, resolveProviderKey } from "../config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../providers/catalog.js";
import { ProductConfigurationFileStore } from "./configuration/configuration-store.js";
import { handleProductConfigurationApi } from "./configuration/configuration-http.js";
import { OpenRouterProductModelCatalog } from "./configuration/model-catalog.js";
import { ProductModelSelectionService } from "./configuration/model-selection-service.js";
import type { ProductModelCatalog } from "./configuration/model-selection-schema.js";
import { ProductBaselineService } from "./configuration/baseline-service.js";
import { handleProductProjectApi } from "./projects/project-http.js";
import { ProductProjectService } from "./projects/project-service.js";
import { ProductProjectFileStore } from "./projects/project-store.js";
import { handleProductRecognitionApi, handleProductRecognitionRetryApi } from "./recognition/recognition-http.js";
import type { RecognitionAnswerExecutor } from "./recognition/recognition-service.js";
import { ProductRecognitionRunService } from "./recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "./recognition/recognition-store.js";
import { RecognitionReportFileStore } from "./reports/report-store.js";
import { RecognitionReportService } from "./reports/report-service.js";
import { handleRecognitionReportApi } from "./reports/report-http.js";
import { renderProductPhase4AppHtml } from "../ui/product-phase4-app.js";
import { ProductMeasurementFileStore } from "./measurements/measurement-store.js";
import { ProductWatchSetService } from "./measurements/watchset-service.js";
import { ProductMeasurementRunService } from "./measurements/measurement-service.js";
import { ProductMeasurementStatsService } from "./measurements/measurement-stats.js";
import { handleMeasurementApi } from "./measurements/measurement-http.js";
import { ProductScheduleFileStore } from "./scheduling/schedule-store.js";
import { ProductScheduleService } from "./scheduling/schedule-service.js";
import { handleScheduleApi } from "./scheduling/schedule-http.js";
import { renderProductPhase5AppHtml } from "../ui/product-phase5-app.js";
import { renderKeywordMonitoringAppHtml } from "../ui/keyword-monitoring-app.js";
import { KeywordMonitorStore } from "./keyword-monitor-store.js";
import { KeywordMonitorService } from "./keyword-monitor-service.js";
import { handleKeywordMonitorApi } from "./keyword-monitor-http.js";

loadDotEnv();

export interface ProductServerDependencies {
  customProviderFetch?: typeof customProviderFetch | undefined;
  keyValidationFetch?: typeof fetch | undefined;
  modelCatalog?: ProductModelCatalog | undefined;
  recognitionExecutor?: RecognitionAnswerExecutor | undefined;
  measurementExecutor?: RecognitionAnswerExecutor | undefined;
}

function send(res: ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(contentType === "application/json" ? JSON.stringify(body, null, 2) : String(body));
}

function assetContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function sendAsset(res: ServerResponse, path: string): Promise<void> {
  res.writeHead(200, {
    "Content-Type": assetContentType(path),
    "Cache-Control": "public, max-age=3600",
  });
  res.end(await readFile(path));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function handle(req: IncomingMessage, res: ServerResponse, dependencies: ProductServerDependencies): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const projectStore = new ProductProjectFileStore(productDataDir());
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const catalog = connectionCatalog(dependencies.modelCatalog || new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  const selections = new ProductModelSelectionService(projects, configurationStore, catalog);
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const recognition = new ProductRecognitionRunService(projects, baselines, recognitionStore, dependencies.recognitionExecutor);
  const reportStore = new RecognitionReportFileStore(projectStore);
  const reports = new RecognitionReportService(projects, baselines, recognitionStore, reportStore);
  const measurementStore = new ProductMeasurementFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, measurementStore, recognitionStore, reportStore);
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, measurementStore, dependencies.measurementExecutor || dependencies.recognitionExecutor);
  const stats = new ProductMeasurementStatsService(projects, measurementStore);
  const keywordMonitors = new KeywordMonitorService(projects, new KeywordMonitorStore(projectStore), baselines, dependencies.measurementExecutor || dependencies.recognitionExecutor);
  const schedules = new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));

  if (method === "GET" && url.pathname === "/") {
    const measurementView = url.searchParams.get("view") === "measurements";
    const keywordView = url.searchParams.get("view") === "keyword-monitoring";
    const html = keywordView ? renderKeywordMonitoringAppHtml() : measurementView ? renderProductPhase5AppHtml() : renderProductPhase4AppHtml();
    return send(res, 200, html.replace("<body>", "<body>" + renderProviderConnectionsUi()), "text/html; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (method === "GET" && route[0] === "assets" && route.length > 1) {
    const root = resolve("assets");
    const path = resolve(root, route.slice(1).join("/"));
    if (path === root || !path.startsWith(root + sep) || !existsSync(path)) return send(res, 404, { error: "asset not found" });
    if (!(await stat(path)).isFile()) return send(res, 404, { error: "asset not found" });
    return sendAsset(res, path);
  }

  if (method === "POST" && url.pathname === "/api/openrouter/key") return send(res, 200, await validateOpenRouterKey(resolveProviderKey("openrouter"), dependencies.keyValidationFetch));
  if (method === "POST" && url.pathname === "/api/custom-provider/connect") {
    if (!customConnection()) throw new ProviderConnectionInputError("请填写接口地址和 API Key。", 401);
    resolveProviderKey(connectionKey(customConnection()!.baseUrl));
    return send(res, 200, { connected: true, baseUrl: customConnection()!.baseUrl, models: await catalog.list(), verified: customConnection()!.models.length === 0 });
  }
  if (await handleProductConfigurationApi({ method, route, projects, selections, baselines, catalog, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  if (await handleMeasurementApi({ method, route, readJson: () => readJson(req), send: (status, body) => send(res, status, body), projects, watchSets, measurements, stats })) return;
  if (await handleKeywordMonitorApi({ method, route, readJson: () => readJson(req), send: (status, body) => send(res, status, body), projects, service: keywordMonitors })) return;
  if (await handleScheduleApi({ method, route, readJson: () => readJson(req), send: (status, body) => send(res, status, body), service: schedules, keywordService: keywordMonitors })) return;
  if (await handleRecognitionReportApi({ method, route, service: reports, send: (status, body) => send(res, status, body) })) return;
  if (await handleProductRecognitionRetryApi({ method, route, service: recognition, send: (status, body) => send(res, status, body) })) return;
  if (await handleProductRecognitionApi({ method, route, service: recognition, idempotencyKey: typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : undefined, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  if (await handleProductProjectApi({ method, url, route, service: projects, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  return send(res, 404, { error: "not found" });
}

export function createProductServer(dependencies: ProductServerDependencies = {}) {
  return createServer((req, res) => {
    const execute = async () => {
      const origin = req.headers.origin;
      if (req.headers["sec-fetch-site"] === "cross-site" || (origin && new URL(origin).host !== req.headers.host)) throw new ProviderConnectionInputError("Cross-origin requests are not allowed.", 403);
      const single = requestCustomConnection(req);
      const multiple = requestConnections(req);
      const key = requestOpenRouterKey(req);
      const work = () => handle(req, res, dependencies);
      if (!single && !multiple.connections.length && !Object.keys(multiple.keys).length && !key) return work();
      const keys = { [single ? connectionKey(single.baseUrl) : "openrouter"]: key, ...multiple.keys };
      return withCustomConnections(single ? [single] : multiple.connections, () => withCustomConnection(single, () => withRequestProviderKeys(keys, work)));
    };
    void withCustomProviderTransport(dependencies.customProviderFetch, execute).catch(error => send(res, error instanceof ProviderConnectionInputError ? error.status : 500, { error: error instanceof ProviderConnectionInputError ? error.message : "Provider operation failed." }));
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const port = Number(process.env.PORT || 8787);
  createProductServer().listen(port, "127.0.0.1", () => {
    console.log(`niubigeo product server listening on http://localhost:${port}`);
  });
}
