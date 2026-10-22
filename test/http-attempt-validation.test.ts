import test from "node:test";
import assert from "node:assert/strict";
import { postJsonWithRetry } from "../src/providers/http.js";
test("invalid explicit HTTP attempt limits fail before a provider request", async () => {
 const original=globalThis.fetch; let requests=0;
 globalThis.fetch=async () => {requests++;return Response.json({ok:true});};
 try {for(const attempts of [0,-1,1.5,9,Infinity,NaN]) await assert.rejects(postJsonWithRetry("https://fixture.example/api",{},attempts),e => e instanceof Error && e.message === "Invalid HTTP attempt limit");assert.equal(requests,0);}
 finally {globalThis.fetch=original;}
});
