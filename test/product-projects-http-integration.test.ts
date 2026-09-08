import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { productDataDir } from "../src/config/env.js";

type ApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

type ProductRecord = {
  id: string;
  name: string;
  normalizedDomain: string;
  status: string;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function startServer(root: string, port: number): Promise<{ child: ChildProcess; baseUrl: string; output: string[] }> {
  const output: string[] = [];
  const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PRODUCT_DATA_DIR: root,
      RUNS_DIR: join(root, "runs"),
      MONITORING_DATA_DIR: join(root, "monitoring"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      if (response.status === 200) return { child, baseUrl, output };
    } catch {
      // The server process is still starting.
    }
    await wait(50);
  }
  await stopServer(child);
  throw new Error(`Product server did not start. Output: ${output.join("")}`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
}

async function api(baseUrl: string, method: string, path: string, body?: Record<string, unknown>): Promise<ApiResponse> {
  const options = body
    ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method };
  const response = await fetch(`${baseUrl}${path}`, options);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function projectFrom(response: ApiResponse): ProductRecord {
  return response.body.project as ProductRecord;
}

async function directoryEntries(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

test("Phase 1 product API persists isolated projects through an actual server restart", { concurrency: false }, async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase1-http-"));
  const productionRoot = resolve(productDataDir());
  const productionEntriesBefore = await directoryEntries(productionRoot);
  let server: { child: ChildProcess; baseUrl: string; output: string[] } | undefined;

  try {
    assert.notEqual(resolve(temporaryRoot), productionRoot);
    const port = await unusedPort();
    server = await startServer(temporaryRoot, port);

    const empty = await api(server.baseUrl, "GET", "/api/projects");
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.projects, []);

    const alphaCreate = await api(server.baseUrl, "POST", "/api/projects", { domain: "example.com", name: "Alpha" });
    assert.equal(alphaCreate.status, 201);
    const alpha = projectFrom(alphaCreate);
    assert.equal(alpha.status, "draft");
    const storedAlpha = JSON.parse(await readFile(join(temporaryRoot, "projects", alpha.id, "project.json"), "utf8")) as ProductRecord;
    assert.equal(storedAlpha.id, alpha.id);
    assert.equal(storedAlpha.name, "Alpha");

    const duplicate = await api(server.baseUrl, "POST", "/api/projects", { domain: "https://www.example.com/" });
    assert.equal(duplicate.status, 409);
    const afterDuplicate = await api(server.baseUrl, "GET", "/api/projects");
    assert.equal((afterDuplicate.body.projects as ProductRecord[]).length, 1);

    const betaCreate = await api(server.baseUrl, "POST", "/api/projects", { domain: "example.org", name: "Beta" });
    assert.equal(betaCreate.status, 201);
    const beta = projectFrom(betaCreate);
    const alphaUpdated = await api(server.baseUrl, "PATCH", `/api/projects/${alpha.id}`, { name: "Alpha saved", domain: "alpha.example.com" });
    assert.equal(alphaUpdated.status, 200);
    assert.equal(projectFrom(alphaUpdated).id, alpha.id);
    assert.equal(projectFrom(alphaUpdated).normalizedDomain, "alpha.example.com");
    const betaUpdated = await api(server.baseUrl, "PATCH", `/api/projects/${beta.id}`, { name: "Beta saved" });
    assert.equal(betaUpdated.status, 200);

    const alphaRead = await api(server.baseUrl, "GET", `/api/projects/${alpha.id}`);
    assert.equal(alphaRead.status, 200);
    assert.equal(JSON.stringify(alphaRead.body).includes(beta.id), false);
    assert.equal(JSON.stringify(alphaRead.body).includes("Beta saved"), false);
    const foreignNestedResource = await api(server.baseUrl, "GET", `/api/projects/${alpha.id}/nested/${beta.id}`);
    assert.equal(foreignNestedResource.status, 404);

    const archived = await api(server.baseUrl, "POST", `/api/projects/${alpha.id}/archive`);
    assert.equal(archived.status, 200);
    const defaultAfterArchive = await api(server.baseUrl, "GET", "/api/projects");
    assert.deepEqual((defaultAfterArchive.body.projects as ProductRecord[]).map((project) => project.id), [beta.id]);
    const archivedList = await api(server.baseUrl, "GET", "/api/projects?includeArchived=true");
    assert.deepEqual(
      (archivedList.body.projects as ProductRecord[]).filter((project) => project.status === "archived").map((project) => project.id),
      [alpha.id],
    );

    const restored = await api(server.baseUrl, "POST", `/api/projects/${alpha.id}/restore`);
    assert.equal(restored.status, 200);
    const deleted = await api(server.baseUrl, "DELETE", `/api/projects/${alpha.id}`);
    assert.equal(deleted.status, 200);
    const hiddenAfterDelete = await api(server.baseUrl, "GET", `/api/projects/${alpha.id}`);
    assert.equal(hiddenAfterDelete.status, 404);
    const defaultAfterDelete = await api(server.baseUrl, "GET", "/api/projects");
    assert.deepEqual((defaultAfterDelete.body.projects as ProductRecord[]).map((project) => project.id), [beta.id]);
    const currentProjectNavigationTargets = defaultAfterDelete.body.projects as ProductRecord[];
    assert.equal(currentProjectNavigationTargets.length, 1);
    assert.equal(currentProjectNavigationTargets[0]?.id, beta.id);

    await stopServer(server.child);
    server = await startServer(temporaryRoot, port);
    const afterRestart = await api(server.baseUrl, "GET", "/api/projects");
    assert.deepEqual((afterRestart.body.projects as ProductRecord[]).map((project) => project.id), [beta.id]);
    const deletedAfterRestart = await api(server.baseUrl, "GET", `/api/projects/${alpha.id}`);
    assert.equal(deletedAfterRestart.status, 404);

    const purged = await api(server.baseUrl, "DELETE", `/api/projects/${alpha.id}/purge`);
    assert.equal(purged.status, 200);
    await assert.rejects(() => access(join(temporaryRoot, "projects", alpha.id, "project.json")));
    assert.equal((await directoryEntries(join(temporaryRoot, "projects"))).includes(alpha.id), false);
    assert.deepEqual(await directoryEntries(productionRoot), productionEntriesBefore);
  } finally {
    if (server) await stopServer(server.child);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
