import { test, expect } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises"; import { join } from "node:path"; import { tmpdir } from "node:os";
import { createProductServer } from "../src/product/product-server.js";
let failModel=true;const modelCalls:string[]=[];let root="",base="";let server:ReturnType<typeof createProductServer>;
test.beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),"niubigeo-keyword-browser-"));process.env.PRODUCT_DATA_DIR=root;server=createProductServer({modelCatalog:{async list(){return ["a","b"].map(modelId=>({providerId:"openrouter" as const,modelId,displayName:modelId,available:true,unavailableReason:null,nativeWebSearchSupported:false,checkedAt:new Date().toISOString(),source:"openrouter_catalog" as const}))}},recognitionExecutor:{async execute(input){modelCalls.push(input.modelSnapshot.modelId);if(input.modelSnapshot.modelId==="b"&&failModel)throw new Error("fixture timeout");return {providerId:"openrouter",providerName:"fixture",sourceType:"api",sourceLabel:"fixture",resultCaveat:"",model:input.modelSnapshot.modelId,modelVersion:"v1",text:"Brand",citations:[],webQueries:[],latencyMs:1,createdAt:new Date().toISOString()}}}});await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const a=server.address();if(!a||typeof a==="string")throw Error();base=`http://127.0.0.1:${a.port}`});
test.afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true})});
test("keyword page keeps custom keywords independent from domain page",async({page})=>{const response=await page.request.post(base+"/api/projects",{data:{primaryDomain:"example.com",brandName:"牛逼GEO"}});const {project}=await response.json();await page.goto(base+"/?view=keyword-monitoring&projectId="+project.id);await expect(page.locator("h1")).toHaveText("关键词持续侦测");await expect(page.locator(".template")).toHaveCount(4);await page.locator("[data-template=ai-coding]").click();await page.locator("[name=frequency]").selectOption("weekly");await page.locator("[name=brandName]").fill("牛逼GEO");await page.locator("[name=aliases]").fill("NiubiGEO");await page.locator("#monitor-form .button:not(.secondary)").click();await expect(page.locator(".table tbody tr")).toHaveCount(5);await page.locator("[data-add]").click();await page.locator("[name=keyword]").fill("best CRM for startups\nbest GEO tools");await page.locator("#monitor-form .button:not(.secondary)").click();await expect(page.locator(".table tbody tr")).toHaveCount(7);await page.locator("[data-diff]").first().click();await expect(page.locator(".diff-card")).toContainText("至少完成两次检测");await page.goto(base+"/?view=measurements&projectId="+project.id);await expect(page.locator('[data-testid="phase5-workbench"]')).toBeVisible();});

test("whitespace keywords stay in the form and API errors remain visible", async ({page}) => {
  const response = await page.request.post(base + "/api/projects", {data: {primaryDomain: "validation.example"}});
  const {project} = await response.json();
  await page.goto(base + "/?view=keyword-monitoring&projectId=" + project.id);
  await page.locator("[data-add]").click();
  await page.locator("[name=keyword]").fill("   \n   ");
  let writes = 0;
  page.on("request", request => {if (request.method() === "POST" && request.url().endsWith("/keyword-monitors")) writes++;});
  await page.locator("#monitor-form [type=submit]").click();
  await expect(page.locator("#monitor-dialog")).toBeVisible();
  await expect(page.locator("#monitor-form-error")).toContainText("请至少输入一个关键词");
  expect(writes).toBe(0);
  await page.route("**/keyword-monitors", async route => {
    if(route.request().method() === "POST") await route.fulfill({status:422,contentType:"application/json",body:JSON.stringify({error:"fixture validation error"})});
    else await route.continue();
  });
  await page.locator("[name=keyword]").fill("valid keyword");
  await page.locator("#monitor-form [type=submit]").click();
  await expect(page.locator("#monitor-form-error")).toHaveText("fixture validation error");
  await expect(page.locator("#monitor-dialog")).toBeVisible();
  await expect(page.locator("#monitor-form [type=submit]")).toBeEnabled();
});

test("tags, sample estimates, settings and worker status work in English",async({page})=>{
 const response=await page.request.post(base+"/api/projects",{data:{primaryDomain:"tags.example"}});const {project}=await response.json();
 await page.addInitScript(()=>localStorage.setItem('niubigeo.product.locale','en'));
 await page.goto(base+"/?view=keyword-monitoring&projectId="+project.id);
 await expect(page.locator('#worker-status')).toContainText('Worker not running');
 await page.locator('[data-add]').click();await page.locator('[name=keyword]').fill('best tools');await page.locator('[name=tags]').fill('research, coding');await page.locator('[name=repeats]').fill('5');
 await expect(page.locator('#request-estimate')).toContainText('× 5');
 await page.locator('#monitor-form [type=submit]').click();await expect(page.locator('.table')).toContainText('research');
 await page.locator('[data-edit]').click();await expect(page.locator('[name=repeats]')).toHaveValue('5');await page.locator('[name=tags]').fill('changed');await page.locator('#monitor-form [type=submit]').click();
 await expect(page.locator('.table')).toContainText('changed');await page.locator('#tag-filter').selectOption('changed');await expect(page.locator('.table tbody tr')).toHaveCount(1);
 await page.locator('[data-history]').click();await expect(page.locator('.history-card')).toBeVisible();
});


test("history retries only failures and exports the displayed pair",async({page})=>{
 const {project}=await (await page.request.post(base+"/api/projects",{data:{primaryDomain:"retry.example"}})).json();const path=base+"/api/projects/"+project.id;
 await page.request.put(path+"/models",{data:{selections:[{modelId:"a",webSearchMode:"off"},{modelId:"b",webSearchMode:"off"}]}});await page.request.post(path+"/baselines",{data:{}});
 const {monitor}=await (await page.request.post(path+"/keyword-monitors",{data:{keyword:"best tools",brandName:"Brand",repeats:2}})).json();
 await page.request.post(path+"/keyword-monitors/"+monitor.id+"/run",{data:{}});expect(modelCalls).toHaveLength(4);failModel=false;
 await page.addInitScript(()=>localStorage.setItem('niubigeo.product.locale','en'));await page.goto(base+"/?view=keyword-monitoring&projectId="+project.id);
 await page.locator('[data-history]').click();await expect(page.locator('[data-retry]')).toHaveCount(1);await page.locator('[data-retry]').click();await expect(page.locator('[data-retry]')).toHaveCount(0);expect(modelCalls).toHaveLength(6);expect(modelCalls.filter(id=>id==='a')).toHaveLength(2);
 await expect(page.locator('.history-card')).toContainText('fixture timeout');await page.locator('[data-diff]').click();await expect(page.locator('.diff-card')).toContainText('not an independent observation');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();const download=await downloadPromise;const file=await download.path();expect(file).toBeTruthy();const csv=await readFile(file!,'utf8');expect(csv).toContain('fixture timeout');expect(csv).toContain('retry_snapshot');
 await page.locator('#history-filters [name=modelId]').selectOption('a');await page.locator('#history-filters [type=submit]').click();await expect(page.locator('#history-trend')).toContainText('2 / 2');
 const jsonDownload=page.waitForEvent('download');await page.locator('[data-history-export=json]').click();const downloaded=await jsonDownload;const exported=JSON.parse(await readFile((await downloaded.path())!,'utf8'));expect(exported.filter.modelId).toBe('a');expect(exported.runs.every((r:any)=>r.modelResults.every((m:any)=>m.modelId==='a'))).toBe(true);
 await page.locator('#history-filters [name=from]').fill('2099-01-01');await page.locator('#history-filters [type=submit]').click();await expect(page.locator('#history-trend .muted')).toBeVisible();await expect(page.locator('.history-card article')).toHaveCount(0);
 await page.locator('[data-reset-history]').click();await expect(page.locator('.history-card article')).toHaveCount(2);

});
