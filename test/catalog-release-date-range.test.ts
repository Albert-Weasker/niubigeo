import test from "node:test";
import assert from "node:assert/strict";
import { OpenRouterModelCatalog } from "../src/providers/openrouter-model-capabilities.js";
test("out-of-range release timestamps cannot fail the entire model catalog",async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:[{id:"fixture/bad-date",name:"Fixture: Bad date",created:1e20},{id:"fixture/valid-date",name:"Fixture: Valid date",created:1700000000}]});
 try{const models=await new OpenRouterModelCatalog().list();assert.equal(models.length,2);assert.equal(models.find(m=>m.model==="fixture/bad-date")?.releasedAt,null);assert.equal(models.find(m=>m.model==="fixture/valid-date")?.releasedAt,"2023-11-14T22:13:20.000Z");}finally{globalThis.fetch=original;}
});
