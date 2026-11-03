import test from "node:test";
import assert from "node:assert/strict";
import {filterKeywordHistory,exportKeywordHistory} from "../src/product/keyword-history.js";
import {keywordCliOptions} from "../src/product/keyword-monitor-cli.js";
import {containsConfiguredIdentity} from "../src/prompts/brand-question.js";
import type {KeywordMonitorRun} from "../src/product/keyword-monitor-schema.js";
const run:KeywordMonitorRun={id:"run",monitorId:"m",projectId:"p",keyword:"=SUM(1)",status:"completed",startedAt:"2026-10-31T23:59:59.999Z",mentioned:["A","B"],positions:{a:0,b:1},answer:"A answer B answer",modelResults:[{modelId:"a",modelName:"A",answer:"A answer",mentioned:["A"],recommended:["A"],position:0,citations:["https://a.example"]},{modelId:"b",modelName:"B",answer:"B answer",mentioned:["B"],recommended:["B"],position:1,citations:[]}]};
test("history filters use inclusive UTC dates and reject invalid calendars",()=>{
 assert.equal(filterKeywordHistory([run],{from:"2026-10-31",to:"2026-10-31"}).length,1);
 assert.equal(filterKeywordHistory([run],{from:"2026-11-01"}).length,0);
 for(const filter of [{from:"2026-02-30"},{to:"2026-2-1"},{from:"2026-11-02",to:"2026-11-01"}])assert.throws(()=>filterKeywordHistory([run],filter));
 assert.equal(filterKeywordHistory([run],{from:"2024-02-29"}).length,1);
});
test("filtered exports contain only selected model evidence without mutating history",()=>{
 const before=structuredClone(run),selected=filterKeywordHistory([run],{modelId:"a"})[0]!;
 assert.equal(selected.answer,"A answer");assert.deepEqual(selected.mentioned,["A"]);assert.deepEqual(selected.positions,{a:0});assert.equal(selected.summary.length,1);assert.deepEqual(run,before);
 const json=exportKeywordHistory([run],{modelId:"a"},"json").content;assert.equal(json.includes("B answer"),false);
 const csv=exportKeywordHistory([run],{},"csv").content;assert.ok(csv.includes('"\'=SUM(1)"'));assert.ok(csv.includes('https://a.example'));
 assert.equal(filterKeywordHistory([run],{modelId:"missing"}).length,0);
});
test("CLI repetition validation is bounded and never silently falls back",()=>{
 const input={project:"p",monitor:"m"};assert.equal(keywordCliOptions({...input,repeats:"5"}).repeats,5);
 for(const repeats of [true,"0","11","1.5","NaN",""])assert.throws(()=>keywordCliOptions({...input,repeats}));
 assert.throws(()=>keywordCliOptions({project:"p"}));assert.deepEqual(keywordCliOptions(input),input);
});
test("configured aliases support Unicode normalization and reject Latin substring collisions",()=>{
 assert.equal(containsConfiguredIdentity("a good tool","Go"),false);
 assert.equal(containsConfiguredIdentity("Use Golang.","Golang"),true);
 assert.equal(containsConfiguredIdentity("推荐牛逼GEO工具","牛逼GEO"),true);
 assert.equal(containsConfiguredIdentity("ＮｉｕｂｉＧＥＯ","NiubiGEO"),true);
 assert.equal(containsConfiguredIdentity("Niubi   GEO","Niubi GEO"),true);
 assert.equal(containsConfiguredIdentity("anything"," "),false);
});
