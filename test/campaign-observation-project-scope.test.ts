import test from "node:test";
import assert from "node:assert/strict";
import { ObservationDiff } from "../src/changes/observation-diff.js";
import type { Observation } from "../src/observations/observation-schema.js";
function observation(id:string, mentioned:boolean):Observation {
 return {id,projectId:"project",baselineId:"baseline",runId:id,auditRunId:id,promptId:"q1",sampleIndex:0,sampleCount:1,promptText:"Acme?",promptType:"brand",promptAuditCategory:"other",targetIncluded:true,keywordIds:[],providerId:"provider",model:"model",language:"en",sourceType:"api",sourceLabel:"Provider API",webSearchEnabled:false,status:"completed",startedAt:"2026-01-01T00:00:00Z",finishedAt:"2026-01-01T00:00:00Z",answerText:"Acme",citations:[],mentions:[],evidence:{hasAnswer:true,targetMentioned:mentioned,mentionedCompetitors:[],citationCount:0,officialCitationCount:0}};
}
test("comparison pairs cannot cross project or baseline boundaries",()=>{const previous=observation("before",true);const current=observation("after",false);current.projectId="different";assert.deepEqual(new ObservationDiff().compare([current],[previous]),[]);current.projectId=previous.projectId;current.baselineId="different";assert.deepEqual(new ObservationDiff().compare([current],[previous]),[]);current.baselineId=previous.baselineId;assert.equal(new ObservationDiff().compare([current],[previous])[0]?.kind,"brand_disappeared");});
