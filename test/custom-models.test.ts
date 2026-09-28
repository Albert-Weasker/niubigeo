import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createProductServer } from "../src/product/product-server.js";
import { customModelId } from "../src/product/connections/provider-connections.js";
import { normalizeCustomBaseUrl, publicIPv4 } from "../src/providers/custom-connection.js";


const first = "https://first.example/v1", second = "https://second.example/v1";
const firstKey = "test-first-private-api-key", secondKey = "test-second-private-api-key", routerKey = "test-router-private-api-key";
const catalog = { async list() { return [{ providerId: "openrouter" as const, modelId: "test/same", displayName: "Same", available: true, unavailableReason: null, nativeWebSearchSupported: false, checkedAt: "2026-09-28", source: "local_capability_registry" as const }]; } };
const connections = [{ baseUrl: null, apiKey: routerKey }, { baseUrl: first, apiKey: firstKey, models: ["same"] }, { baseUrl: second, apiKey: secondKey, models: ["same"] }];
const headers = { "Content-Type": "application/json", "X-Niubigeo-Connections": JSON.stringify(connections) };

async function serverTest(work: (base: string, root: string, calls: { url: string; auth: string | null; body: Record<string, unknown> }[]) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "niubigeo-custom-"));
  const old = process.env.PRODUCT_DATA_DIR; process.env.PRODUCT_DATA_DIR = root;
  const calls: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  const server = createProductServer({ modelCatalog: catalog, customProviderFetch: async (url, init) => {
    const auth = new Headers(init?.headers).get("Authorization");
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    calls.push({ url, auth, body });
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "same" }, { id: "another" }] }));
    if (url.startsWith(second)) return new Response(JSON.stringify({ error: { message: secondKey } }), { status: 401 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ analysisStatus: "recognized", domainRecognition: "recognized", recognizedBrand: { value: "Brand", citationUrls: [] }, businessDescription: { value: "Answer " + firstKey, citationUrls: [] }, productCategory: { value: "Tools", citationUrls: [] }, competitors: [], brandKeywords: [], unknowns: [] }) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }));
  } });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await work("http://127.0.0.1:" + address.port, root, calls); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); if(old===undefined)delete process.env.PRODUCT_DATA_DIR;else process.env.PRODUCT_DATA_DIR=old; await rm(root,{recursive:true,force:true}); }
}
async function finished(base: string, projectId: string, id: string): Promise<any> {
  for(let i=0;i<100;i++){ const body=await (await fetch(base+"/api/projects/"+projectId+"/recognition-runs/"+id)).json() as any; if(!["queued","running"].includes(body.run.status))return body; await new Promise(resolve=>setTimeout(resolve,10)); }
  throw new Error("Run did not finish");
}

test("custom endpoints normalize common paths and reject non-public URL forms and reserved addresses", () => {
  assert.equal(normalizeCustomBaseUrl(first+"/chat/completions/"),first);
  for(const url of ["http://api.example/v1", "https://localhost/v1", "https://127.0.0.1", "https://[::1]", "https://user:secret@api.example/v1", "https://api.example/v1?key=secret"]) assert.throws(()=>normalizeCustomBaseUrl(url));
  for(const ip of ["127.0.0.1","10.1.2.3","172.16.1.2","192.168.1.2","169.254.169.254","100.64.1.1","198.18.0.1","224.0.0.1","::1","::ffff:127.0.0.1"])assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4("8.8.8.8"),true);
});

test("directory discovery and manual entries keep endpoint identities separate without inference", async () => serverTest(async(base,_root,calls)=>{
  const response=await fetch(base+"/api/custom-provider/connect",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+firstKey,"X-Niubigeo-Base-Url":first+"/"},body:"{}"});
  assert.equal(response.status,200); const result=await response.json() as any;
  assert.equal(result.baseUrl,first);assert.equal(result.models.length,2);assert.equal(result.models[0].upstreamModelId,"same");assert.equal(result.verified,true);
  assert.equal(calls[0]?.auth,"Bearer "+firstKey);assert.ok(calls.every(call=>call.url.endsWith("/models")));
  const listed=await (await fetch(base+"/api/provider-models",{headers})).json() as any;
  assert.equal(new Set(listed.models.map((m:any)=>m.modelId)).size,3);
  assert.notEqual(customModelId(first,"same"),customModelId(second,"same"));
}));

test("mixed recognition uses isolated keys and actual model IDs, preserving partial results without storing secrets", async () => {
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=(async(url,init)=>{
    if(String(url)==="https://openrouter.ai/api/v1/chat/completions") {
      assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer "+routerKey);
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({analysisStatus:"recognized",domainRecognition:"recognized",recognizedBrand:{value:"Router",citationUrls:[]},businessDescription:{value:"Tools",citationUrls:[]},productCategory:{value:"Tools",citationUrls:[]},competitors:[],brandKeywords:[],unknowns:[]})},finish_reason:"stop"}]}));
    }
    return nativeFetch(url,init);
  }) as typeof fetch;
  try { await serverTest(async(base,root,calls)=>{
    const project=await (await fetch(base+"/api/projects",{method:"POST",headers,body:JSON.stringify({primaryDomain:"example.org"})})).json() as any;
    const path=base+"/api/projects/"+project.project.id;
    const selections=["test/same",customModelId(first,"same"),customModelId(second,"same")].map(modelId=>({modelId,webSearchMode:"off"}));
    assert.equal((await fetch(path+"/models",{method:"PUT",headers,body:JSON.stringify({selections})})).status,200);
    assert.equal((await fetch(path+"/baselines",{method:"POST",headers,body:"{}"})).status,201);
    const request={method:"POST",headers:{...headers,"Idempotency-Key":randomUUID()},body:"{}"};
    const response=await fetch(path+"/recognition-runs",request);assert.equal(response.status,202);
    const started=await response.json() as any;const result=await finished(base,project.project.id,started.run.id);
    assert.equal(result.modelRuns.length,3);
    assert.equal(result.modelRuns.filter((m:any)=>m.status==="completed").length,2);
    const custom=result.modelRuns.find((m:any)=>m.modelSnapshot.baseUrl===first);
    const detail=await (await fetch(path+"/recognition-runs/"+started.run.id+"/model-runs/"+custom.id)).json() as any;
    assert.equal(detail.attempts[0].providerModel,"same");assert.ok(detail.attempts[0].rawAnswer.includes("[REDACTED]"));
    assert.deepEqual(calls.map(call=>[call.url,call.auth,call.body.model]).sort(),[[first+"/chat/completions","Bearer "+firstKey,"same"],[second+"/chat/completions","Bearer "+secondKey,"same"]].sort());
    assert.ok(calls.every(call=>!("provider" in call.body)),"No OpenRouter-only parameters reach custom APIs");
    assert.equal((await fetch(path+"/recognition-runs",request)).status,202);assert.equal(calls.length,2);
    async function inspect(directory:string):Promise<void>{ for(const entry of await readdir(directory,{withFileTypes:true})){const file=join(directory,entry.name);if(entry.isDirectory())await inspect(file);else{const saved=await readFile(file,"utf8");for(const key of [firstKey,secondKey,routerKey])assert.ok(!saved.includes(key));}} }
    await inspect(root);
  }); } finally {globalThis.fetch=nativeFetch;}
});

test("mixed monitoring configuration retains endpoint and raw model snapshots and rejects invented search capability", async()=>serverTest(async(base,_root,calls)=>{
  const created=await (await fetch(base+"/api/projects",{method:"POST",headers,body:JSON.stringify({primaryDomain:"example.org"})})).json() as any;
  const path=base+"/api/projects/"+created.project.id;
  const ids=[customModelId(first,"same"),customModelId(second,"same")];
  assert.equal((await fetch(path+"/models",{method:"PUT",headers,body:JSON.stringify({selections:ids.map(modelId=>({modelId,webSearchMode:"off"}))})})).status,200);
  const baseline=await (await fetch(path+"/baselines",{method:"POST",headers,body:"{}"})).json() as any;
  assert.deepEqual(new Set(baseline.baseline.modelSnapshots.map((m:any)=>m.baseUrl)),new Set([first,second]));
  assert.ok(baseline.baseline.modelSnapshots.every((m:any)=>m.upstreamModelId==="same"));
  assert.equal((await fetch(path+"/models",{method:"PUT",headers,body:JSON.stringify({selections:[{modelId:ids[0],webSearchMode:"provider_native"}]})})).status,422);
  assert.equal(calls.length,0);
}));

test("self-hosted local HTTP model servers require explicit opt-in and redirects are never followed", async () => {
  const { createServer } = await import("node:http");
  const { customProviderFetch } = await import("../src/providers/custom-connection.js");
  const server = createServer((req,res) => { if(req.url === "/redirect") {res.writeHead(302,{location:"http://127.0.0.1/private"});res.end();} else {res.writeHead(200,{"Content-Type":"application/json"});res.end('{"data":[{"id":"local-model"}]}');} });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();assert.ok(address && typeof address!=="string");
  const base="http://127.0.0.1:"+address.port, old=process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS;
  try {
    delete process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS; await assert.rejects(customProviderFetch(base+"/models"));
    process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS="true";
    assert.equal(normalizeCustomBaseUrl(base+"/v1/"),base+"/v1");
    assert.equal((await (await customProviderFetch(base+"/models")).json() as any).data[0].id,"local-model");
    await assert.rejects(customProviderFetch(base+"/redirect"));
  } finally {if(old===undefined)delete process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS;else process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS=old;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
