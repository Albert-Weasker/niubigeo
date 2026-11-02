import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditPlanner } from "../src/runner/audit-planner.js";
import { AuditRunner } from "../src/runner/audit-runner.js";
import { withRequestProviderKeys } from "../src/config/env.js";
import { entityFromInput } from "../src/utils/domain.js";
import { questionContainsTargetIdentity } from "../src/prompts/brand-question.js";
import { citationFromUrl, dedupeCitations } from "../src/providers/citation-extractors.js";
import { attachCitationTypes } from "../src/analyzer/citation-intelligence.js";
import { ProviderCatalog } from "../src/providers/catalog.js";
import { makeSearchExecution } from "../src/providers/search-execution.js";
import type { AnswerProvider } from "../src/core/types.js";

const target = entityFromInput({type:"target",name:"Example",domain:"example.test",githubRepo:"foo/bar"});
const input = {target,competitors:[],providerTargets:[{providerId:"openai",model:"gpt-4o-mini"},{providerId:"gemini",model:"gemini-1.5-flash"}],language:"en",promptCount:1,manualPrompts:["What does Example do?"],autoDiscover:false};

test("manual planning and execution preserve mixed providers when the first key is missing", async () => {
 const root=await mkdtemp(join(tmpdir(),"niubigeo-mixed-keys-"));
 try { await withRequestProviderKeys({gemini:"fixture-key"},async()=>{
  const plan=await new AuditPlanner().plan({...input,runsRoot:root});
  assert.deepEqual(plan.providerTargets,input.providerTargets);
  const catalog=new ProviderCatalog();
  const calls:string[]=[];
  const provider:AnswerProvider={definition:catalog.get("gemini").definition,run:async()=>{
   calls.push("gemini");return {providerId:"gemini",providerName:"Gemini",sourceType:"api",sourceLabel:"fixture",resultCaveat:"fixture",model:"gemini-1.5-flash",modelVersion:"fixture",text:"Example is a product.",citations:[],webQueries:[],latencyMs:1,createdAt:new Date().toISOString()};
  }};
  const output=await new AuditRunner({catalog:{validate:()=>undefined,get:id=>id==="gemini"?provider:{...provider,run:async()=>{throw new Error("Missing-key provider must not be called");}}},competitorDiscovery:{discover:async()=>[]},intentResultPipeline:{analyze:async()=>{throw new Error("Fixture analysis unavailable");}}}).run({confirmedPlan:plan,runsRoot:root,maxTokens:100});
  assert.deepEqual(output.audit.runs.map(r=>[r.providerId,r.status]),[["openai","failed"],["gemini","completed"]]);
  assert.equal(calls.length,1);
 }); } finally {await rm(root,{recursive:true,force:true});}
});

test("no selected provider key blocks planning clearly", async()=>{
 await withRequestProviderKeys({},()=>assert.rejects(new AuditPlanner().plan(input), {message:"No selected provider has an API key configured."}));
});

test("duplicate URLs retain native citation evidence in either input order",()=>{
 const text=citationFromUrl("https://EXAMPLE.com:443/docs",undefined,0,"answer_text_url")!;
 const native=citationFromUrl("https://example.com/docs","Native title",4,"provider_annotation","annotations[0]")!;
 for(const rows of [[text,native],[native,text]]){
  const result=dedupeCitations(rows);
  assert.equal(result.length,1);assert.equal(result[0]?.source,"provider_annotation");assert.equal(result[0]?.providerPayloadPath,"annotations[0]");assert.equal(result[0]?.citationIndex,0);
 }
 assert.equal(dedupeCitations([text,citationFromUrl("https://example.com/docs?q=1",undefined,1,"answer_text_url")!]).length,2);
});

test("GitHub attribution requires the exact host and repository path",()=>{
 for(const [url,expected] of [
  ["https://github.com/foo/bar","target_github"],["https://github.com/FOO/BAR/issues/1","target_github"],
  ["https://github.com/foo/barista","third_party"],["https://evil.test/github.com/foo/bar","third_party"],
  ["https://github.com.evil.test/foo/bar","third_party"],["https://example.test/?ref=github.com/foo/bar","target_official"],
 ] as const){assert.equal(attachCitationTypes([citationFromUrl(url,undefined,0,"answer_text_url")!],target,[])[0]?.citationType,expected,url);}
});

test("Latin brand identity uses word boundaries while Chinese mentions remain supported",()=>{
 const go=entityFromInput({type:"target",name:"Go",domain:"go.dev",aliases:["Golang"]});
 for(const question of ["What is a good deployment tool?","Should I forgo this?","Try Golangish tools"]){assert.equal(questionContainsTargetIdentity(question,go),false,question);}
 for(const question of ["What is Go?","Go's tooling","Compare Golang with Rust","访问go.dev了解更多","推荐使用Go语言"]){assert.equal(questionContainsTargetIdentity(question,go),true,question);}
 const chinese=entityFromInput({type:"target",name:"牛逼GEO",domain:"niubigeo.ai"});
 assert.equal(questionContainsTargetIdentity("请介绍牛逼GEO的功能",chinese),true);
});

test("requested search without execution evidence is not reported as used",()=>{
 const definition=new ProviderCatalog().get("openai").definition;
 const base={definition,runInput:{prompt:"Example",model:"gpt-4o-mini",apiKey:"fixture",maxTokens:100,temperature:0,webSearchEnabled:true},endpointKind:"official_api" as const,endpointProtocol:"chat_completions" as const,endpointUrl:"https://example.test"};
 const search=makeSearchExecution(base);
 assert.equal(search.requested,true);assert.equal(search.used,false);assert.equal(search.usedMode,"requested_not_confirmed");
 assert.equal(makeSearchExecution({...base,citationCount:1}).used,true);
 assert.equal(makeSearchExecution({...base,alwaysOn:true}).used,true);
});
