import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { entityFromInput } from "../src/utils/domain.js";
function spec() {
 return {target:entityFromInput({type:"target",name:"Acme",domain:"acme.test"}),competitors:[entityFromInput({type:"competitor",name:"Beta",domain:"beta.test",aliases:["Beta One"]})],questions:[{id:"q1",text:"Is Acme useful?"}],providerTargets:[{providerId:"openrouter",model:"model",webSearchEnabled:false}],language:"en",scopeConfirmed:true as const};
}
test("competitor matching changes must change the plan fingerprint",()=>{const s=spec();const first=new DeterministicPlanBuilder().build(s);s.competitors[0]!.aliases.push("Beta Two");const second=new DeterministicPlanBuilder().build(s);assert.notEqual(first.promptSetHash,second.promptSetHash);s.competitors[0]!.githubRepo="beta/product";assert.notEqual(second.promptSetHash,new DeterministicPlanBuilder().build(s).promptSetHash);});
