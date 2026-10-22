import assert from "node:assert/strict";
import test from "node:test";
import { pairedRecommendationGap } from "../src/product/measurements/measurement-stats.js";
import type { MeasurementMetricPoint } from "../src/product/measurements/measurement-schema.js";
test("equal denominators do not imply matched included samples",()=>{const base={metric:"positive_recommendation",runId:"run",modelId:"model",webSearchMode:"offline",keywordId:"keyword",denominator:1,value:100} as unknown as MeasurementMetricPoint;const target={...base,samples:[{probeRunId:"a",included:true},{probeRunId:"b",included:false}]} as MeasurementMetricPoint;const competitor={...base,value:0,samples:[{probeRunId:"a",included:false},{probeRunId:"b",included:true}]} as MeasurementMetricPoint;assert.equal(pairedRecommendationGap({target,competitor}),null);assert.equal(pairedRecommendationGap({target,competitor:{...target,value:0}}),100)});
