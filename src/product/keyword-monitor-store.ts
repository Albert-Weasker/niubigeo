import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "./projects/project-store.js";
import type { KeywordMonitor, KeywordMonitorRun } from "./keyword-monitor-schema.js";
const missing=(e:unknown)=>Boolean(e&&typeof e==="object"&&"code"in e&&e.code==="ENOENT");
const read=async<T>(p:string)=>JSON.parse(await readFile(p,"utf8")) as T;
const write=async(p:string,v:unknown)=>{await mkdir(join(p,".."),{recursive:true});const t=`${p}.${randomUUID()}.tmp`;await writeFile(t,JSON.stringify(v,null,2)+"\n");await rename(t,p);};
export class KeywordMonitorStore {
 constructor(private readonly projects: ProductProjectFileStore) {}
 private root(id:string){return join(this.projects.projectDir(id),"keyword-monitoring");}
 private monitorPath(projectId:string,id:string){return join(this.root(projectId),"monitors",`${id}.json`)}
 private runsPath(projectId:string,id:string){return join(this.root(projectId),"runs",`${id}.json`)}
 async saveMonitor(v:KeywordMonitor){await write(this.monitorPath(v.projectId,v.id),v)}
 async getMonitor(projectId:string,id:string){try{const v=await read<KeywordMonitor>(this.monitorPath(projectId,id));return v.projectId===projectId&&v.id===id?v:null}catch(e){if(missing(e))return null;throw e}}
 async listMonitors(projectId:string){try{const out:KeywordMonitor[]=[];for(const e of await readdir(join(this.root(projectId),"monitors"),{withFileTypes:true})){if(e.isFile()&&e.name.endsWith(".json")){const v=await read<KeywordMonitor>(join(this.root(projectId),"monitors",e.name));if(v.projectId===projectId)out.push(v)}}return out.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}catch(e){if(missing(e))return [];throw e}}
 async deleteMonitor(projectId:string,id:string){const v=await this.getMonitor(projectId,id);if(!v)return false;await write(this.monitorPath(projectId,id),{...v,enabled:false,updatedAt:new Date().toISOString()});return true}
 async saveRun(v:KeywordMonitorRun){await write(this.runsPath(v.projectId,v.id),v)}
 async listRuns(projectId:string,monitorId?:string){try{const out:KeywordMonitorRun[]=[];for(const e of await readdir(join(this.root(projectId),"runs"),{withFileTypes:true})){if(e.isFile()&&e.name.endsWith(".json")){const v=await read<KeywordMonitorRun>(join(this.root(projectId),"runs",e.name));if(v.projectId===projectId&&(!monitorId||v.monitorId===monitorId))out.push(v)}}return out.sort((a,b)=>b.startedAt.localeCompare(a.startedAt))}catch(e){if(missing(e))return [];throw e}}
}
