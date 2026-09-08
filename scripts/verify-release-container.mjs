import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const image = process.env.RELEASE_IMAGE;
const version = process.env.RELEASE_VERSION;
const source = process.env.RELEASE_SOURCE_SHA;
const platform = process.argv[2];
assert.ok(image && version && source, "RELEASE_IMAGE, RELEASE_VERSION and RELEASE_SOURCE_SHA are required");
assert.ok(["linux/amd64", "linux/arm64"].includes(platform), "Choose a supported platform");
const name = `niubigeo-release-${randomUUID()}`;
const volume = `${name}-data`;
const report = { image, version, source, platform, checks: [], providerInferenceCalls: 0, status: "failed" };
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", timeout: 300000 }).trim();
const sha = value => createHash("sha256").update(value).digest("hex");
let base;
function verify(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  report.checks.push({ label, passed: true });
}
async function request(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
async function start() {
  docker("run", "-d", "--name", name, "--platform", platform,
    "-p", "127.0.0.1::8787", "-v", `${volume}:/app/data/product-v2`, image);
  const container = JSON.parse(docker("inspect", name))[0];
  base = `http://127.0.0.1:${container.NetworkSettings.Ports["8787/tcp"][0].HostPort}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await request("/health")).body.ok === true) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Container did not become healthy within 60 seconds");
}
try {
  if (image.includes("@sha256:")) docker("pull", "--platform", platform, image);
  docker("volume", "create", volume);
  await start();
  const config = JSON.parse(docker("inspect", name))[0];
  report.imageId = config.Image;
  verify("OCI source revision", config.Config.Labels["org.opencontainers.image.revision"], source);
  verify("OCI version", config.Config.Labels["org.opencontainers.image.version"], version);
  const pkg = JSON.parse(docker("exec", name, "node", "-p", "JSON.stringify(require('./package.json'))"));
  verify("Packaged version", pkg.version, version.slice(1));
  verify("Fresh installation has no seeded projects", (await request("/api/projects")).body.projects, []);
  const html = await (await fetch(base)).text();
  verify("Product HTML delivered", html.includes("data-testid=\"new-project\"") || html.includes("data-testid='new-project'"), true);
  for (const asset of ["niubigeo-emblem.svg", "niubigeo-lockup.svg"]) {
    const local = await readFile(`assets/brand/${asset}`);
    const response = await fetch(`${base}/assets/brand/${asset}`);
    verify(`${asset} status`, response.status, 200);
    verify(`${asset} content`, sha(Buffer.from(await response.arrayBuffer())), sha(local));
  }
  const created = await request("/api/projects", "POST", { primaryDomain: "example.com", name: "Release acceptance" });
  verify("Create project", created.status, 201);
  const id = created.body.project.id;
  report.projectId = id;
  const recordPath = `/app/data/product-v2/projects/${id}/project.json`;
  const original = docker("exec", name, "cat", recordPath);
  verify("Persisted project ID", JSON.parse(original).id, id);
  verify("Duplicate domain rejected", (await request("/api/projects", "POST", { primaryDomain: "https://www.example.com/" })).status, 409);
  verify("Conflict does not create another project", (await request("/api/projects")).body.projects.length, 1);
  docker("rm", "-f", name);
  await start();
  verify("Recreated container retains project", (await request(`/api/projects/${id}`)).body.project.id, id);
  verify("Recreation preserves record bytes", sha(docker("exec", name, "cat", recordPath)), sha(original));
  verify("Delete project", (await request(`/api/projects/${id}`, "DELETE")).status, 200);
  verify("Deleted project hidden", (await request(`/api/projects/${id}`)).status, 404);
  docker("rm", "-f", name);
  await start();
  verify("Deleted project stays deleted after recreation", (await request("/api/projects")).body.projects, []);
  report.status = "passed";
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  try { docker("rm", "-f", name); } catch {}
  try { docker("volume", "rm", volume); } catch {}
  report.finishedAt = new Date().toISOString();
  const path = process.env.RELEASE_CONTAINER_REPORT || `release-container-${platform.split("/")[1]}.json`;
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
