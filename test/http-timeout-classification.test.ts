import test from "node:test";
import assert from "node:assert/strict";
import { postJsonWithRetry } from "../src/providers/http.js";
import { providerFailureCode } from "../src/providers/provider-error.js";
test("HTTP deadline aborts are classified as timeout", async () => {
 const original=globalThis.fetch;const prior=process.env.PROVIDER_TIMEOUT_MS;process.env.PROVIDER_TIMEOUT_MS="5";
 globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true}));
 try {await assert.rejects(postJsonWithRetry("https://fixture.example/api",{},1),e=>providerFailureCode(e)==="timeout");}
 finally{globalThis.fetch=original;if(prior===undefined)delete process.env.PROVIDER_TIMEOUT_MS;else process.env.PROVIDER_TIMEOUT_MS=prior;}
});
