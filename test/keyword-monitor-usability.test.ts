import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProductServer } from "../src/product/product-server.js";
import { buildKeywordDiff, keywordDiffCsv, keywordRunSummary } from "../src/product/keyword-monitor-insights.js";
import type { KeywordMonitorRun } from "../src/product/keyword-monitor-schema.js";
import { WorkerStatusStore } from "../src/product/scheduling/worker-status.js";
const sample: KeywordMonitorRun = { id: "a", monitorId: "monitor", projectId: "project", keyword: "=SUM(1)", startedAt: "2026-01-01", status: "completed", mentioned: [], positions: {}, modelResults: [{ modelId: "a", modelName: "A", answer: "Brand", mentioned: ["Brand"], recommended: ["Brand"], position: 1, citations: ["https://example.com"] }] };
test("diff warns on legacy, failed, missing and changed conditions; export protects spreadsheet formulas", () => {
    const next = structuredClone(sample);
    next.id = "b";
    next.modelResults![0]!.position = 0;
    assert.ok(buildKeywordDiff(sample, next).warnings?.includes("conditions_unknown"));
    assert.equal(buildKeywordDiff(sample, next).comparable, false);
    assert.ok(keywordDiffCsv(sample, next).includes('"\'=SUM(1)"'));
    assert.ok(keywordDiffCsv(sample, next).includes('"position_change"'));
    next.modelResults![0]!.error = "timeout";
    assert.deepEqual(buildKeywordDiff(sample, next).removedRecommendations, []);
    assert.ok(buildKeywordDiff(sample, next).warnings?.includes("failed_or_missing_results"));
    assert.equal(keywordRunSummary(next)[0]?.mentionRate, null);
    const original = structuredClone(sample);
    original.conditions = { baselineId: "b", language: "en", prompt: "before", brandName: "Brand", aliases: [], repeats: 1, models: [], protocolVersion: "v1" };
    next.conditions = { ...original.conditions, prompt: "after" };
    assert.ok(buildKeywordDiff(original, next).warnings?.includes("prompt_changed"));
    assert.deepEqual(buildKeywordDiff(original, next).movedMentions, []);
});
test("worker heartbeat distinguishes missing, stale, stopped and multiple live workers", async () => {
    const root = await mkdtemp(join(tmpdir(), "worker-status-"));
    try {
        const store = new WorkerStatusStore(root);
        const at = new Date("2026-10-01T00:01:00Z");
        assert.equal((await store.read(at)).state, "unavailable");
        await store.write({ id: "a", heartbeatAt: "2026-10-01T00:00:00Z", pollSeconds: 10, state: "running" });
        assert.equal((await store.read(at)).state, "stale");
        await store.write({ id: "b", heartbeatAt: at.toISOString(), pollSeconds: 10, state: "running" });
        assert.equal((await store.read(at)).state, "running");
        await store.write({ id: "a", heartbeatAt: at.toISOString(), pollSeconds: 10, state: "stopped" });
        assert.equal((await store.read(at)).state, "running");
        await store.write({ id: "b", heartbeatAt: at.toISOString(), pollSeconds: 10, state: "stopped" });
        assert.equal((await store.read(at)).state, "stopped");
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("API repeats and single-model retry preserve successes, old failures and project isolation", async () => {
    const root = await mkdtemp(join(tmpdir(), "monitor-usability-"));
    const previous = process.env.PRODUCT_DATA_DIR;
    process.env.PRODUCT_DATA_DIR = root;
    const calls: string[] = [];
    let fail = true;
    const server = createProductServer({ modelCatalog: { async list() { return ["a", "b"].map(modelId => ({ providerId: "openrouter" as const, modelId, displayName: modelId, available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: new Date().toISOString(), source: "openrouter_catalog" as const })); } }, recognitionExecutor: { async execute(input) { calls.push(input.modelSnapshot.modelId); if (input.modelSnapshot.modelId === "b" && fail)
                throw new Error("fixture failure"); return { providerId: "openrouter", providerName: "fixture", sourceType: "api", sourceLabel: "fixture", resultCaveat: "", model: input.modelSnapshot.modelId, modelVersion: "v1", text: "Brand", citations: [], webQueries: [], latencyMs: 1, createdAt: new Date().toISOString() }; } } });
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const request = async (path: string, method = "GET", body?: unknown) => { const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, data: await response.json() as any }; };
    try {
        const { data: { project } } = await request("/api/projects", "POST", { primaryDomain: "example.com" });
        const path = "/api/projects/" + project.id;
        assert.equal((await request(path + "/models", "PUT", { selections: [{ modelId: "a", webSearchMode: "off" }, { modelId: "b", webSearchMode: "off" }] })).status, 200);
        assert.equal((await request(path + "/baselines", "POST", {})).status, 201);
        for (const repeats of [0, 11, 1.5, "2"])
            assert.equal((await request(path + "/keyword-monitors", "POST", { keyword: "best tools", repeats })).status, 422);
        const { data: { monitor } } = await request(path + "/keyword-monitors", "POST", { keyword: "best tools", brandName: "Brand", tags: [" group ", "group"], repeats: 2 });
        assert.deepEqual(monitor.tags, ["group"]);
        const monitorPath = path + "/keyword-monitors/" + monitor.id;
        const { data: { run } } = await request(monitorPath + "/run", "POST", {});
        assert.equal(calls.length, 4);
        assert.equal(run.conditions.repeats, 2);
        assert.equal(run.modelResults.filter((r: any) => r.error).length, 2);
        fail = false;
        const { data: { run: retried }, status } = await request(monitorPath + "/retry", "POST", { runId: run.id, modelId: "b" });
        assert.equal(status, 202);
        assert.equal(calls.length, 6);
        assert.equal(calls.filter(c => c === "a").length, 2);
        assert.equal(retried.retryOfRunId, run.id);
        const history = (await request(monitorPath)).data.runs;
        assert.equal(history.length, 2);
        assert.deepEqual(history.find((r: any) => r.id === run.id).modelResults, run.modelResults);
        assert.equal(history[0].summary[1].mentioned, 2);
        assert.equal((await request(monitorPath + "/retry", "POST", { runId: run.id, modelId: "b" })).status, 422);
        assert.equal(calls.length, 6);
        assert.equal((await request(monitorPath + "/retry", "POST", { runId: retried.id, modelId: "a" })).status, 422);
        assert.ok((await request(monitorPath + "/diff")).data.diff.warnings.includes("retry_snapshot"));
        assert.ok((await request(monitorPath + "/export")).data.csv.includes("fixture failure"));
        const { data: { project: other } } = await request("/api/projects", "POST", { primaryDomain: "other.example" });
        assert.equal((await request("/api/projects/" + other.id + "/keyword-monitors/" + monitor.id + "/retry", "POST", { runId: run.id, modelId: "b" })).status, 422);
        assert.equal((await request(monitorPath, "PATCH", { tags: ["new"], repeats: 3 })).data.monitor.repeats, 3);
        assert.equal(calls.length, 6);
        const pinned=(await request(monitorPath+"/export","POST",{previousRunId:run.id,latestRunId:retried.id})).data.csv;
        assert.equal((await request(monitorPath+"/export","POST",{previousRunId:run.id,latestRunId:"foreign"})).status,422);
        await request(monitorPath+"/run","POST",{});
        assert.equal((await request(monitorPath+"/export","POST",{previousRunId:run.id,latestRunId:retried.id})).data.csv,pinned);
    }
    finally {
        await new Promise<void>(r => server.close(() => r()));
        if (previous === undefined)
            delete process.env.PRODUCT_DATA_DIR;
        else
            process.env.PRODUCT_DATA_DIR = previous;
        await rm(root, { recursive: true, force: true });
    }
});

test("Diff excludes a changed model connection or search mode, but preserves comparable evidence",()=>{
 const model={selectionId:"s",providerId:"openrouter" as const,modelId:"a",displayName:"A",webSearchMode:"off" as const,nativeWebSearchSupported:true,capabilityCheckedAt:"2026-01-01"};
 const old=structuredClone(sample);old.conditions={baselineId:"b",language:"en",prompt:"prompt",brandName:"Brand",aliases:[],repeats:1,models:[model],protocolVersion:"v1"};
 const current=structuredClone(old);current.id="b";current.conditions!.models[0]!.webSearchMode="provider_native";current.modelResults![0]!.recommended=["Other"];
 const diff=buildKeywordDiff(old,current);assert.equal(diff.comparable,false);assert.ok(diff.warnings?.includes("model_or_search_changed"));assert.deepEqual(diff.removedRecommendations,[]);assert.deepEqual(diff.addedRecommendations,[]);
 current.conditions=structuredClone(old.conditions);assert.equal(buildKeywordDiff(old,current).comparable,true);assert.deepEqual(buildKeywordDiff(old,current).addedRecommendations,["Other"]);
});

test("a real worker records setup failure and publishes its heartbeat",async()=>{
 const {spawn}=await import("node:child_process");
 const {ProductProjectFileStore}=await import("../src/product/projects/project-store.js");
 const {ProductProjectService}=await import("../src/product/projects/project-service.js");
 const {KeywordMonitorStore}=await import("../src/product/keyword-monitor-store.js");
 const {KeywordMonitorService}=await import("../src/product/keyword-monitor-service.js");
 const root=await mkdtemp(join(tmpdir(),"monitor-worker-process-"));let child:ReturnType<typeof spawn>|undefined;
 try{
 const projectsStore=new ProductProjectFileStore(root),projects=new ProductProjectService(projectsStore),store=new KeywordMonitorStore(projectsStore);const service=new KeywordMonitorService(projects,store);
 const project=await projects.createDraft({primaryDomain:"worker.example"});const monitor=await service.create(project.id,{keyword:"best tools"});await service.update(project.id,monitor.id,{nextRunAt:"2020-01-01T00:00:00Z"});
 child=spawn(process.execPath,[fileURLToPath(new URL("../src/product/scheduling/schedule-worker.js",import.meta.url)),"10"],{env:{...process.env,PRODUCT_DATA_DIR:root},stdio:"ignore"});
 const status=new WorkerStatusStore(root);let observed=false;
 for(let i=0;i<100;i++){const heartbeat=await status.read();if("lastExecutionResult" in heartbeat&&heartbeat.lastExecutionResult==="failed"){observed=true;assert.equal(heartbeat.state,"running");break;}await new Promise(r=>setTimeout(r,50))}
 assert.equal(observed,true);const history=await service.runs(project.id,monitor.id);assert.equal(history.length,1);assert.equal(history[0]?.status,"failed");assert.ok(history[0]?.error);assert.ok(Date.parse((await store.getMonitor(project.id,monitor.id))!.nextRunAt!)>Date.now());
 }finally{if(child&&child.exitCode===null){const stopped=new Promise<void>(resolve=>child!.once("exit",()=>resolve()));child.kill("SIGKILL");await stopped;}await rm(root,{recursive:true,force:true})}
});
