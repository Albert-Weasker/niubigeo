import test from "node:test";
import assert from "node:assert/strict";
import { postJsonWithRetry } from "../src/providers/http.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";
test("malformed successful response fails once as invalid_response", async () => {
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response("not JSON",{status:200});};
 try {await assert.rejects(postJsonWithRetry("https://fixture.example/api",{},3),e=>e instanceof ProviderRequestError && e.code==="invalid_response");assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test("non-JSON HTTP failures retain their status", async () => {
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response("upstream failure",{status:503});
 try {const response=await postJsonWithRetry("https://fixture.example/api",{},1);assert.equal(response.status,503);assert.equal(response.ok,false);}finally{globalThis.fetch=original;}
});
