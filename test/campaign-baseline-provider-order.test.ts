import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { entityFromInput } from "../src/utils/domain.js";
function spec() {
 return {target:entityFromInput({type:"target",name:"Acme",domain:"acme.test"}),competitors:[entityFromInput({type:"competitor",name:"Beta",domain:"beta.test",aliases:["Beta One"]})],questions:[{id:"q1",text:"Is Acme useful?"}],providerTargets:[{providerId:"openrouter",model:"model",webSearchEnabled:false}],language:"en",scopeConfirmed:true as const};
}
import { BaselineBuilder, baselineComparableKey } from "../src/baselines/baseline-builder.js";
import type { MonitoringProject } from "../src/projects/project-schema.js";
function baselineFixture() {
 const s=spec(); const project:MonitoringProject={id:"project",name:"Acme",domain:s.target.domain,aliases:[],target:s.target,competitors:s.competitors,defaultLanguage:"en",status:"active",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z"};
 const plan=new DeterministicPlanBuilder().build(s);
 const builder=new BaselineBuilder(); const baseline=builder.fromAuditPlan(project,plan);
 return {project,plan,builder,baseline};
}
test("reordering equivalent provider selections keeps comparable identity",()=>{const {baseline}=baselineFixture();const targets=[{providerId:"p",model:"m",webSearchEnabled:false,webSearchMode:"auto" as const},{providerId:"p",model:"m",webSearchEnabled:false,webSearchMode:"provider_native" as const}];const input={...baseline,prompts:baseline.prompts,providerTargets:targets};assert.equal(baselineComparableKey(input),baselineComparableKey({...input,providerTargets:[...targets].reverse()}));});
