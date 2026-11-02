import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
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
        await rename(temp, path);
    }
    async read(at = new Date()) {
        const dir = join(this.root, "worker-status");
        let files: string[];
        try {
            files = await readdir(dir);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT")
                return { state: "unavailable", reason: "worker_not_started" };
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
        const fresh = (row: WorkerHeartbeat) => at.getTime() - Date.parse(row.heartbeatAt) <= Math.max(30, row.pollSeconds * 3) * 1000;
        const worker = rows.find(row => row.state === "running" && fresh(row)) || rows[0];
        if (!worker)
            return { state: "unavailable", reason: "worker_not_started" };
        return { ...worker, state: worker.state === "running" && !fresh(worker) ? "stale" : worker.state, reason: worker.state === "running" ? (fresh(worker) ? null : "heartbeat_expired") : "worker_" + worker.state };
    }
}
