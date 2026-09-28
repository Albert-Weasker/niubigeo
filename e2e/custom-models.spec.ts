import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProductServer } from "../src/product/product-server.js";
import { customModelId } from "../src/product/connections/provider-connections.js";

let root = "", base = "", server: ReturnType<typeof createProductServer>;
let oldRoot: string | undefined;
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "niubigeo-mixed-browser-")); oldRoot=process.env.PRODUCT_DATA_DIR; process.env.PRODUCT_DATA_DIR=root;
  server=createProductServer({ modelCatalog:{ async list(){return [{providerId:"openrouter",modelId:"openai/test-model",displayName:"OpenAI Test",vendor:"OpenAI",available:true,nativeWebSearchSupported:true,unavailableReason:null,checkedAt:"2026-09-28",source:"local_capability_registry"}];}},keyValidationFetch:(async()=>new Response(JSON.stringify({data:{}}))) as typeof fetch });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error();base="http://127.0.0.1:"+address.port;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));if(oldRoot===undefined)delete process.env.PRODUCT_DATA_DIR;else process.env.PRODUCT_DATA_DIR=oldRoot;await rm(root,{recursive:true,force:true});});

test("connect multiple sources, choose same-name models and retain separate monitoring snapshots",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const created=await page.request.post(base+"/api/projects",{data:{primaryDomain:"example.org"}});const {project}=await created.json();
  await page.goto(base+"/?projectId="+project.id);
  await page.locator('.nav-item[data-page="models"]').click();
  await expect(page.getByTestId("catalog-model")).toHaveCount(1);
  await page.locator('[data-connect-key]').click();
  await page.locator('#openrouter-key-input').fill('test-browser-router-key');await page.locator('#save-openrouter-key').click();await expect(page.locator('#openrouter-key-dialog')).not.toBeVisible();
  for(const baseUrl of ["https://one.example/v1","https://two.example/v1"]){
    await page.locator('[data-connect-key]').click();await page.locator('#provider-kind').selectOption('custom');
    await page.locator('#provider-base-url').fill(baseUrl);await page.locator('#provider-model-ids').fill('same-model');await page.locator('#openrouter-key-input').fill('test-browser-custom-key');await page.locator('#save-openrouter-key').click();await expect(page.locator('#openrouter-key-dialog')).not.toBeVisible();
  }
  await expect(page.getByTestId('catalog-model')).toHaveCount(3);
  for(const id of ['openai/test-model',customModelId('https://one.example/v1','same-model'),customModelId('https://two.example/v1','same-model')])await page.locator('[data-model-checkbox]').evaluateAll((inputs,modelId)=>{const input=inputs.find(item=>item.getAttribute('data-model-checkbox')===modelId) as HTMLInputElement;if(!input)throw new Error('Model missing');input.click();},id);
  await page.locator('[data-model-mode="openai/test-model"]').selectOption('provider_native');
  await page.getByTestId('save-models').click();await expect(page.locator('#models-status')).toContainText('已保存');
  const selections=await (await page.request.get(base+'/api/projects/'+project.id+'/models')).json();expect(selections.selections).toHaveLength(3);expect(new Set(selections.selections.map((row:any)=>row.modelId)).size).toBe(3);
  expect(selections.selections.find((row:any)=>row.modelId==='openai/test-model').webSearchMode).toBe('provider_native');
  await page.locator('.nav-item[data-page="configuration"]').click();await page.getByTestId('save-monitoring-configuration').click();
  const saved=await (await page.request.get(base+'/api/projects/'+project.id+'/baselines')).json();expect(saved.baselines[0].modelSnapshots).toHaveLength(3);
  await page.locator('.nav-item[data-page="models"]').click();await page.locator('#model-source-filter').selectOption('custom');await expect(page.getByTestId('catalog-model')).toHaveCount(2);
  await expect(page.locator('#model-platform-filter')).toHaveValue('');
  await page.locator('#model-platform-filter').selectOption({label:'Poe'});await expect(page.getByTestId('catalog-model')).toHaveCount(0);
  await page.locator('#model-platform-filter').selectOption('');await expect(page.getByTestId('catalog-model')).toHaveCount(2);
  await mkdir('validation/multi-model-2026-09-28',{recursive:true});await page.screenshot({path:'validation/multi-model-2026-09-28/mixed-models.png',fullPage:true});
  expect(errors).toEqual([]);
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('test-browser');
  await page.reload();await page.locator('[data-connect-key]').click();await expect(page.locator('#provider-connections')).toBeEmpty();
});
