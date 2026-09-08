import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleProductProjectApi } from "../src/product/projects/project-http.js";
import { ProductProjectConflictError, ProductProjectNotFoundError } from "../src/product/projects/project-errors.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { renderProductProjectAppHtml } from "../src/ui/product-project-app.js";

async function temporaryRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "niubigeo-product-projects-"));
}

function uuidShape(value: string): boolean {
  const segments = value.split("-");
  return segments.length === 5 && segments.every(Boolean);
}

async function withService(callback: (service: ProductProjectService, root: string) => Promise<void>): Promise<void> {
  const root = await temporaryRoot();
  try {
    await callback(new ProductProjectService(new ProductProjectFileStore(root)), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("domain submission immediately persists an independent draft project", async () => {
  await withService(async (service, root) => {
    const created = await service.createDraft({ primaryDomain: "https://www.alpha.example/path", defaultLanguage: "en" });

    assert.equal(created.status, "draft");
    assert.equal(created.normalizedDomain, "alpha.example");
    assert.equal(created.primaryDomain, "alpha.example");
    assert.equal(uuidShape(created.id), true);
    assert.equal(created.id.includes("alpha.example"), false);

    const reloaded = new ProductProjectService(new ProductProjectFileStore(root));
    assert.deepEqual(await reloaded.get(created.id), created);
    const raw = JSON.parse(await readFile(join(root, "projects", created.id, "project.json"), "utf8")) as { id: string };
    assert.equal(raw.id, created.id);
  });
});

test("normalized duplicate domains conflict and never silently merge projects", async () => {
  await withService(async (service) => {
    const original = await service.createDraft({ primaryDomain: "https://www.beta.example" });
    await assert.rejects(
      () => service.createDraft({ primaryDomain: "beta.example/docs" }),
      (error: unknown) => error instanceof ProductProjectConflictError,
    );

    const afterConflict = await service.get(original.id);
    assert.equal(afterConflict.id, original.id);
    assert.equal(afterConflict.name, original.name);
    assert.equal((await service.list()).length, 1);
  });
});

test("a project can change its primary domain without changing its opaque projectId", async () => {
  await withService(async (service) => {
    const project = await service.createDraft({ primaryDomain: "before.example", name: "Before" });
    const updated = await service.update(project.id, { primaryDomain: "https://www.after.example/path", name: "After" });

    assert.equal(updated.id, project.id);
    assert.equal(updated.primaryDomain, "after.example");
    assert.equal(updated.normalizedDomain, "after.example");
    assert.equal(updated.name, "After");
    assert.equal((await service.list()).length, 1);
  });
});

test("projects are isolated by opaque projectId and a fresh store has no fallback project", async () => {
  await withService(async (service, root) => {
    assert.deepEqual(await service.list(), []);
    const first = await service.createDraft({ primaryDomain: "first.example", name: "First" });
    const second = await service.createDraft({ primaryDomain: "second.example", name: "Second" });

    assert.notEqual(first.id, second.id);
    assert.equal((await service.get(first.id)).normalizedDomain, "first.example");
    assert.equal((await service.get(second.id)).normalizedDomain, "second.example");
    await assert.rejects(() => new ProductProjectService(new ProductProjectFileStore(root)).get("missing-project"), ProductProjectNotFoundError);
  });
});

test("archive restore delete and purge preserve a deliberate project lifecycle", async () => {
  await withService(async (service, root) => {
    const project = await service.createDraft({ primaryDomain: "lifecycle.example" });
    const archived = await service.archive(project.id);
    assert.equal(archived.status, "archived");
    assert.deepEqual(await service.list(), []);
    assert.equal((await service.list({ includeArchived: true })).length, 1);

    const restored = await service.restore(project.id);
    assert.equal(restored.status, "draft");
    const deleted = await service.delete(project.id);
    assert.equal(deleted.status, "deleted");
    assert.deepEqual(await service.list(), []);
    assert.equal((await new ProductProjectService(new ProductProjectFileStore(root)).list({ includeDeleted: true })).length, 1);
    await assert.rejects(() => service.get(project.id), ProductProjectNotFoundError);

    await service.purge(project.id);
    assert.equal(await new ProductProjectFileStore(root).read(project.id), null);
    assert.deepEqual(await service.list({ includeDeleted: true }), []);
  });
});

test("a deleted project releases its domain and cannot be restored over a new project", async () => {
  await withService(async (service) => {
    const deleted = await service.createDraft({ primaryDomain: "replaceable.example" });
    await service.delete(deleted.id);
    const replacement = await service.createDraft({ primaryDomain: "https://www.replaceable.example" });

    assert.notEqual(replacement.id, deleted.id);
    await assert.rejects(
      () => service.restore(deleted.id),
      (error: unknown) => error instanceof ProductProjectConflictError,
    );
  });
});

test("project API exposes only the phase 1 lifecycle routes", async () => {
  await withService(async (service) => {
    let status = 0;
    let response: unknown;
    const call = async (method: string, pathname: string, body: Record<string, unknown> = {}) => {
      status = 0;
      response = undefined;
      const url = new URL(pathname, "http://localhost");
      const route = url.pathname.split("/").filter(Boolean);
      const handled = await handleProductProjectApi({
        method,
        url,
        route,
        service,
        readJson: async () => body,
        send: (nextStatus, nextResponse) => {
          status = nextStatus;
          response = nextResponse;
        },
      });
      return { handled, status, response };
    };

    const created = await call("POST", "/api/projects", { domain: "api-project.example" });
    assert.equal(created.handled, true);
    assert.equal(created.status, 201);
    const project = (created.response as { project: { id: string } }).project;
    assert.equal(uuidShape(project.id), true);

    assert.equal((await call("GET", "/api/projects")).status, 200);
    const updated = await call("PATCH", `/api/projects/${project.id}`, { name: "Changed", domain: "changed-api-project.example" });
    assert.equal(updated.status, 200);
    assert.equal((updated.response as { project: { normalizedDomain: string } }).project.normalizedDomain, "changed-api-project.example");
    assert.equal((await call("POST", `/api/projects/${project.id}/archive`)).status, 200);
    assert.equal((await call("POST", `/api/projects/${project.id}/restore`)).status, 200);
    assert.equal((await call("DELETE", `/api/projects/${project.id}`)).status, 200);
    assert.equal((await call("GET", `/api/projects/${project.id}`)).status, 404);
    assert.equal((await call("GET", `/api/projects/${project.id}?includeDeleted=true`)).status, 200);
    assert.equal((await call("DELETE", `/api/projects/${project.id}/purge`)).status, 200);
  });
});

test("phase 1 app has no default audit project and uses only product project APIs", () => {
  const html = renderProductProjectAppHtml();
  assert.equal(html.includes("/api/projects"), true);
  assert.equal(html.includes('request("/projects'), false);
  assert.equal(html.includes("还没有项目"), true);
  assert.equal(html.includes("default-project"), false);
  assert.equal(html.includes("audit-plan"), false);
  assert.equal(html.includes("openrouter"), false);
  assert.equal(html.includes("edit-domain"), true);
  assert.equal(html.includes("projectId"), true);
});
