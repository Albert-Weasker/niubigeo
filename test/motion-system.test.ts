import test from "node:test";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { AsyncJobRegistry } from "../src/jobs/async-job-registry.js";
import { renderAppHtml } from "../src/ui/app-html.js";

async function waitForFinished<Progress, Result>(
  registry: AsyncJobRegistry<Progress, Result>,
  jobId: string,
): Promise<NonNullable<ReturnType<typeof registry.read>>> {
  for (let index = 0; index < 100; index += 1) {
    const job = registry.read(jobId);
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Timed out waiting for the asynchronous job.");
}

test("async job registry exposes real progress before returning the completed result", async () => {
  const registry = new AsyncJobRegistry<{ completed: number }, { runId: string }>();
  const created = registry.create({ completed: 0 }, async (update) => {
    update({ completed: 1 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    update({ completed: 2 });
    return { runId: "run-complete" };
  });

  assert.equal(created.status, "queued");
  const finished = await waitForFinished(registry, created.id);
  assert.equal(finished.status, "completed");
  assert.deepEqual(finished.progress, { completed: 2 });
  assert.deepEqual(finished.result, { runId: "run-complete" });
});

test("async job registry preserves an actionable failure", async () => {
  const registry = new AsyncJobRegistry<{ stage: string }, never>();
  const created = registry.create({ stage: "preparing" }, async (update) => {
    update({ stage: "provider" });
    throw new Error("Provider request failed");
  });

  const finished = await waitForFinished(registry, created.id);
  assert.equal(finished.status, "failed");
  assert.equal(finished.progress.stage, "provider");
  assert.equal(finished.error, "Provider request failed");
});

test("workbench motion system covers interaction states, real chart geometry, and reduced motion", () => {
  const page = renderAppHtml();
  const document = load(page);
  const script = document("script").text();

  assert.doesNotThrow(() => new Function(script));
  for (const status of ["idle", "loading", "success", "error", "disabled"]) {
    assert.equal(page.includes(status), true, status);
  }
  for (const duration of ["80ms", "100ms", "120ms", "140ms", "160ms", "180ms", "200ms", "300ms", "650ms", "800"]) {
    assert.equal(page.includes(duration), true, duration);
  }
  assert.equal(page.includes("prefers-reduced-motion: reduce"), true);
  assert.equal(page.includes("focus-visible"), true);
  assert.equal(page.includes("getTotalLength()"), true);
  assert.equal(page.includes("data-chart-points"), true);
  assert.equal(page.includes("requestAnimationFrame(frame)"), true);
  assert.equal(page.includes("data-series-key"), true);
  assert.equal(page.includes("chart-point-pulse"), true);
  assert.equal(page.includes("chart-tooltip"), true);
  assert.equal(page.includes("audit-progress"), true);
  assert.equal(page.includes('role="switch"'), true);
  assert.equal(page.includes("runToggle"), true);
  assert.equal(page.includes("setToggle(control, previous)"), true);
  assert.equal(page.includes("/audit-jobs"), true);
  assert.equal(page.includes("/run-job"), true);
  assert.equal(page.includes('setAttribute("aria-busy", "true")'), true);
  assert.equal(page.includes("window.setTimeout(() =>"), true);
  assert.equal(page.includes("}, 3000)"), true);
  assert.equal(script.includes("alert("), false);
});

test("every chart renderer is gated by comparable evidence before motion is applied", () => {
  const page = renderAppHtml();
  const document = load(page);
  const script = document("script").text();

  assert.equal(script.includes('if (!seriesDrawable(series)) return ""'), true);
  assert.equal(script.includes("if (!seriesDrawable(series)) return '<span class=\"sparkline-placeholder\"></span>'"), true);
  assert.equal(script.includes("evidenceChange && point.evidenceChange.comparable"), true);
  assert.equal(script.includes("motion.animateCharts(root)"), true);
});
