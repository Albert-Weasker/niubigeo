import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const screenshotDirectory = join(process.cwd(), "validation", "rebuild-phase-1-2026-09-05", "screenshots");
let temporaryRoot = "";
let server: ChildProcess | undefined;
let baseUrl = "";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function unusedPort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    reservation.once("error", rejectListen);
    reservation.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolveClose, rejectClose) => reservation.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function startProductServer(): Promise<void> {
  const port = await unusedPort();
  temporaryRoot = await mkdtemp(join(tmpdir(), "niubigeo-phase1-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PRODUCT_DATA_DIR: temporaryRoot,
      RUNS_DIR: join(temporaryRoot, "runs"),
      MONITORING_DATA_DIR: join(temporaryRoot, "monitoring"),
    },
    stdio: "ignore",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      if (response.status === 200) return;
    } catch {
      // The product server is still starting.
    }
    await wait(50);
  }
  throw new Error("The product server did not start for browser acceptance.");
}

async function stopProductServer(): Promise<void> {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolveExit) => server?.once("exit", () => resolveExit()));
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: join(screenshotDirectory, name), fullPage: true });
}

function selectedProjectId(url: string): string {
  const id = new URL(url).searchParams.get("projectId");
  if (!id) throw new Error("The selected project id is missing from the URL.");
  return id;
}

async function createProject(page: Page, domain: string, name: string): Promise<string> {
  await page.getByTestId("new-project").click();
  await expect(page.getByTestId("project-drawer")).toHaveAttribute("aria-hidden", "false");
  await page.locator("#project-domain").fill(domain);
  await page.locator("#project-name").fill(name);
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("selected-project-title")).toHaveText(name);
  await expect(page.getByTestId("selected-project-domain")).toHaveText(domain);
  return selectedProjectId(page.url());
}

test.beforeAll(async () => {
  await startProductServer();
});

test.afterAll(async () => {
  await stopProductServer();
});

test("Phase 1 project lifecycle uses the real product UI and API", async ({ page }) => {
  await test.step("A. empty state", async () => {
    await page.goto(baseUrl);
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("project-card")).toHaveCount(0);
    await screenshot(page, "01-empty-state.png");
  });

  let firstProjectId = "";
  let secondProjectId = "";

  await test.step("B. create and persist a draft", async () => {
    firstProjectId = await createProject(page, "example.com", "Example Com");
    await page.getByLabel("关闭").click();
    await page.reload();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Com");
    await expect(page.getByTestId("selected-project-domain")).toHaveText("example.com");
    await expect(page).toHaveURL((url) => new URL(url).searchParams.get("projectId") === firstProjectId);
    await screenshot(page, "02-create-and-refresh.png");
  });

  await test.step("C. switch, edit, archive and restore two projects", async () => {
    secondProjectId = await createProject(page, "example.org", "Example Org");
    await page.getByLabel("关闭").click();
    await page.selectOption("[data-testid=project-select]", firstProjectId);
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Com");
    await expect(page.getByTestId("selected-project-domain")).toHaveText("example.com");
    await expect(page).toHaveURL((url) => new URL(url).searchParams.get("projectId") === firstProjectId);

    await page.locator("#edit-name").fill("Example Net");
    await page.locator("#edit-domain").fill("https://www.example.net/path");
    await page.getByTestId("save-project").click();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Net");
    await expect(page.getByTestId("selected-project-domain")).toHaveText("example.net");
    await expect(page).toHaveURL((url) => new URL(url).searchParams.get("projectId") === firstProjectId);

    await page.getByTestId("archive-project").click();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Org");
    await page.locator("[data-list-mode=archived]").click();
    await expect(page.getByText("Example Net", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "恢复项目" }).click();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Net");

    await page.selectOption("[data-testid=project-select]", secondProjectId);
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Org");
    await expect(page.getByTestId("selected-project-domain")).toHaveText("example.org");
    await expect(page).toHaveURL((url) => new URL(url).searchParams.get("projectId") === secondProjectId);
    await screenshot(page, "03-switch-edit-archive-restore.png");
  });

  await test.step("D. duplicate normalized domain stays a visible conflict", async () => {
    await page.getByTestId("new-project").click();
    await page.locator("#project-domain").fill("https://www.example.net/");
    await page.getByTestId("save-draft").click();
    await expect(page.locator("#form-status")).toHaveClass("form-status error");
    await expect(page.locator("#form-status")).toContainText("这个域名已经被其他项目使用。");
    await expect(page.getByTestId("project-card")).toHaveCount(2);
    await screenshot(page, "04-domain-conflict.png");
  });

  await test.step("E. deleting the current project navigates and survives refresh", async () => {
    await page.getByLabel("关闭").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("delete-project").click();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Net");
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page).toHaveURL((url) => new URL(url).searchParams.get("projectId") === firstProjectId);
    await page.reload();
    await expect(page.getByTestId("selected-project-title")).toHaveText("Example Net");
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await screenshot(page, "05-delete-current-and-refresh.png");
  });
});
