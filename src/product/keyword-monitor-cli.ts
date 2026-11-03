import {productKeywordMonitorService} from "./scheduling/schedule-worker.js";
import {keywordRunSummary} from "./keyword-monitor-insights.js";
export function keywordCliOptions(options:Record<string,string|boolean>){
 const project=options.project,monitor=options.monitor;
 if(typeof project!=="string"||!project||typeof monitor!=="string"||!monitor)throw new Error("--project and --monitor are required.");
 let repeats:number|undefined;
 if(options.repeats!==undefined){if(typeof options.repeats!=="string")throw new Error("--repeats requires a number from 1 to 10.");repeats=Number(options.repeats);if(!Number.isInteger(repeats)||repeats<1||repeats>10)throw new Error("--repeats requires a number from 1 to 10.");}
 return {project,monitor,...(repeats===undefined?{}:{repeats})};
}
export async function runKeywordCli(options:Record<string,string|boolean>){
 const input=keywordCliOptions(options),service=productKeywordMonitorService();
 const estimate=await service.estimate(input.project,input.monitor,input.repeats);
 if(options["dry-run"]===true){console.log(JSON.stringify({estimate},null,2));return;}
 const run=await service.run(input.project,input.monitor,input.repeats===undefined?{}:{repeats:input.repeats});
 console.log(JSON.stringify({estimate,runId:run.id,status:run.status,summary:keywordRunSummary(run)},null,2));
 if(run.status==="failed"||run.modelResults?.some(row=>row.error))process.exitCode=1;
}
