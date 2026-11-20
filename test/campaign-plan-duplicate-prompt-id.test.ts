import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicPlanBuilder } from "../src/planning/deterministic-plan-builder.js";
import { entityFromInput } from "../src/utils/domain.js";
function spec() {
 return {target:entityFromInput({type:"target",name:"Acme",domain:"acme.test"}),competitors:[entityFromInput({type:"competitor",name:"Beta",domain:"beta.test",aliases:["Beta One"]})],questions:[{id:"q1",text:"Is Acme useful?"}],providerTargets:[{providerId:"openrouter",model:"model",webSearchEnabled:false}],language:"en",scopeConfirmed:true as const};
}
test("duplicate question IDs cannot produce ambiguous observation identities",()=>{const s=spec();s.questions.push({id:"q1",text:"Is Acme suitable for teams?"});assert.throws(()=>new DeterministicPlanBuilder().build(s),(error: unknown) => error instanceof Error && error.message === "duplicate_question_id");s.questions[1]!.id="q2";assert.equal(new DeterministicPlanBuilder().build(s).prompts.length,2);});
