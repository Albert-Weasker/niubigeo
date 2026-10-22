import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises"; import { join } from "node:path"; import { tmpdir } from "node:os";
import { createProductServer } from "../src/product/product-server.js";
let root="",base="";let server:ReturnType<typeof createProductServer>;
test.beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),"niubigeo-keyword-browser-"));process.env.PRODUCT_DATA_DIR=root;server=createProductServer({modelCatalog:{async list(){return []}}});await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const a=server.address();if(!a||typeof a==="string")throw Error();base=`http://127.0.0.1:${a.port}`});
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
