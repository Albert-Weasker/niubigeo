import type {KeywordMonitorRun} from "./keyword-monitor-schema.js";
import {keywordRunSummary} from "./keyword-monitor-insights.js";
export interface KeywordHistoryFilter {from?:string;to?:string;modelId?:string;}
function day(value:string|undefined,end:boolean):number|undefined {
  if(value===undefined||value==="")return undefined;
  const date=new Date(value+"T00:00:00.000Z");
  if(value.length!==10||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error("Dates must be valid YYYY-MM-DD dates (UTC).");
  return date.getTime()+(end?86400000:0);
}
export function filterKeywordHistory(runs:KeywordMonitorRun[],filter:KeywordHistoryFilter={}) {
  const from=day(filter.from,false),to=day(filter.to,true);
  if(from!==undefined&&to!==undefined&&from>=to)throw new Error("Start date must not follow end date.");
  return runs.filter(run=>{const time=Date.parse(run.startedAt);return (from===undefined||time>=from)&&(to===undefined||time<to)}).map(run=>{
    const results=filter.modelId?(run.modelResults||[]).filter(row=>row.modelId===filter.modelId):run.modelResults;
    return {...run,...(results?{modelResults:results}:{}),...(filter.modelId?{answer:(results||[]).map(row=>row.answer).join("\n\n"),mentioned:[...new Set((results||[]).flatMap(row=>row.mentioned))],positions:Object.fromEntries((results||[]).map(row=>[row.modelId,row.position]))}:{}),summary:keywordRunSummary({...run,...(results?{modelResults:results}:{})})};
  }).filter(run=>!filter.modelId||run.modelResults?.length);
}
const cell=(value:unknown)=>{let text=String(value??"");if(["=","+","-","@","\t","\n","\r"].some(c=>text.startsWith(c)||text.trimStart().startsWith(c)))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
export function exportKeywordHistory(runs:KeywordMonitorRun[],filter:KeywordHistoryFilter,format:"csv"|"json") {
  const selected=filterKeywordHistory(runs,filter);
  if(format==="json")return {format,content:JSON.stringify({schemaVersion:1,filter,runs:selected},null,2)+"\n"};
  const rows:unknown[][]=[["project_id","monitor_id","keyword","run_id","date_utc","status","model_id","model","sample","mentions","recommendations","position","sources","answer","error","retry_of","carried_from","conditions"]];
  for(const run of selected){const results=run.modelResults?.length?run.modelResults:[undefined];for(const row of results)rows.push([run.projectId,run.monitorId,run.keyword,run.id,run.startedAt,run.status,row?.modelId,row?.modelName,row?.sampleIndex||1,JSON.stringify(row?.mentioned||[]),JSON.stringify(row?.recommended||[]),row?.position==null?"":row.position+1,JSON.stringify(row?.citations||[]),row?.answer||"",row?.error||run.error||"",run.retryOfRunId,row?.carriedFromRunId,JSON.stringify(run.conditions||null)]);}
  return {format,content:"\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n"};
}
