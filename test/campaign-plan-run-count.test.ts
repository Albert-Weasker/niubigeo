import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { entityFromInput } from "../src/utils/domain.js";
function spec() {
 return {target:entityFromInput({type:"target",name:"Acme",domain:"acme.test"}),competitors:[entityFromInput({type:"competitor",name:"Beta",domain:"beta.test",aliases:["Beta One"]})],questions:[{id:"q1",text:"Is Acme useful?"}],providerTargets:[{providerId:"openrouter",model:"model",webSearchEnabled:false}],language:"en",scopeConfirmed:true as const};
}
test("explicit invalid repetition counts cannot become one paid sample",()=>{for(const n of [0,NaN,-1,1.5,Infinity])assert.throws(()=>new DeterministicPlanBuilder().build({...spec(),runCountPerQuestion:n}),(error: unknown) => error instanceof Error && error.message === "invalid_run_count");assert.equal(new DeterministicPlanBuilder().build(spec()).runCountPerPrompt,1);});
