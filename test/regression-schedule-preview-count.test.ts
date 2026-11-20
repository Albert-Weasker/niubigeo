import assert from "node:assert/strict";
import test from "node:test";
import { ProductScheduleService } from "../src/product/scheduling/schedule-service.js";
test("schedule previews reject unbounded or fractional counts",async()=>{const service=new ProductScheduleService({get:async()=>({})} as never,{} as never,{} as never,{} as never,{} as never);for(const count of [0,-1,1.5,21,NaN,Infinity])await assert.rejects(service.preview("p",{frequency:"daily",timezone:"UTC"},count),{message:"Preview count must be between 1 and 20."});assert.equal((await service.preview("p",{frequency:"daily",timezone:"UTC"},20)).length,20)});
