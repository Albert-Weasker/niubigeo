import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
export interface WorkerHeartbeat {
    id: string;
    heartbeatAt: string;
    pollSeconds: number;
    state: "running" | "stopped" | "failed";
    lastCycleAt?: string;
    lastExecutionAt?: string;
    lastExecutionResult?: "completed" | "failed";
    lastResult?: "completed" | "failed";
}
export class WorkerStatusStore {
    constructor(private readonly root: string) { }
    async write(value: WorkerHeartbeat) {
        if (!value.id || [...value.id].some(c => !"abcdefghijklmnopqrstuvwxyz0123456789-".includes(c)))
            throw new Error("Invalid worker ID");
        const dir = join(this.root, "worker-status");
        await mkdir(dir, { recursive: true });
        const path = join(dir, value.id + ".json"), temp = path + "." + randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(value));
        try {
            for(let attempt=0;;attempt++) {
                try {await rename(temp,path);break;}
                catch(error) {const code=(error as NodeJS.ErrnoException).code;if(attempt>=5||!["EPERM","EBUSY","EACCES"].includes(code||""))throw error;await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));}
            }
        } finally {await rm(temp,{force:true}).catch(()=>undefined);}

    }
    private async readHeartbeats(): Promise<WorkerHeartbeat[]> {
        const dir = join(this.root, "worker-status");
        let files: string[];
        try {
            files = await readdir(dir);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT")
                return [];
            throw error;
        }
        const rows: WorkerHeartbeat[] = [];
        for (const file of files.filter(name => name.endsWith(".json"))) {
            try {
                rows.push(JSON.parse(await readFile(join(dir, file), "utf8")) as WorkerHeartbeat);
            }
            catch {
                continue;
            }
        }
        rows.sort((a, b) => b.heartbeatAt.localeCompare(a.heartbeatAt));
        return rows;
    }

    async readAll(at = new Date()) {
        return (await this.readHeartbeats()).map(row => {
            if (row.state !== "running") return { ...row, reason: "worker_" + row.state };
            const fresh = at.getTime() - Date.parse(row.heartbeatAt) <= Math.max(30, row.pollSeconds * 3) * 1000;
            return { ...row, state: fresh ? "running" as const : "stale" as const, reason: fresh ? null : "heartbeat_expired" };
        });
    }

    async read(at = new Date()) {
        const rows = await this.readAll(at);
        return rows.find(row => row.state === "running") ?? rows[0] ?? { state: "unavailable", reason: "worker_not_started" };
    }
}
