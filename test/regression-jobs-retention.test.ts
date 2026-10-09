import assert from "node:assert/strict";
import test from "node:test";
import {AsyncJobRegistry} from "../src/jobs/async-job-registry.js";
test("completion trims overflow without dropping active jobs", async()=>{const registry=new AsyncJobRegistry<number,number>(1);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});const first=registry.create(0,async()=>{await gate;return 1});const second=registry.create(0,async()=>2);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(registry.read(first.id)?.status,"running");release();await new Promise(resolve=>setImmediate(resolve));assert.equal(registry.read(second.id),null);assert.equal(registry.read(first.id)?.status,"completed")});
