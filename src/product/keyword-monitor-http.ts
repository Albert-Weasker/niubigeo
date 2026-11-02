import type { ProductProjectService } from "./projects/project-service.js";
import { KeywordMonitorService } from "./keyword-monitor-service.js";
import type { KeywordMonitorFrequency, KeywordMonitorKind } from "./keyword-monitor-schema.js";
type Send = (status: number, body: unknown) => void;
type Read = () => Promise<Record<string, unknown>>;
const text = (v: unknown) => typeof v === "string" ? v : undefined;
const list = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === "string") ? (v as string[]) : undefined;
export async function handleKeywordMonitorApi(input: {
    method: string;
    route: string[];
    readJson: Read;
    send: Send;
    projects: ProductProjectService;
    service: KeywordMonitorService;
}): Promise<boolean> { const { method, route, readJson, send, service } = input; if (route[0] !== "api" || route[1] !== "projects" || route[3] !== "keyword-monitors")
    return false; const projectId = route[2]; if (!projectId)
    return false; try {
    if (route.length === 4 && method === "GET")
        return send(200, { monitors: await service.list(projectId) }), true;
    if (route.length === 4 && method === "POST") {
        const b = await readJson();
        const keywords = list(b.keywords);
        if ("keywords" in b && !keywords)
            throw new Error("关键词列表必须为字符串数组。");
        if ("tags" in b && !list(b.tags))
            throw new Error("Tags must be a string array.");
        if ("repeats" in b && typeof b.repeats !== "number")
            throw new Error("Repeats must be a number.");
        const brand = text(b.brandName);
        const base = { ...(list(b.tags) ? { tags: list(b.tags)! } : {}), ...(typeof b.repeats === "number" ? { repeats: b.repeats } : {}), ...(text(b.kind) ? { kind: text(b.kind) as KeywordMonitorKind } : {}), ...(text(b.frequency) ? { frequency: text(b.frequency) as KeywordMonitorFrequency } : {}), ...(brand ? { brandName: brand } : {}), ...(list(b.aliases) ? { aliases: list(b.aliases)! } : {}) };
        if (keywords)
            return send(201, { monitors: await service.createBatch(projectId, { ...base, keywords }) }), true;
        return send(201, { monitor: await service.create(projectId, { ...base, keyword: text(b.keyword) || "" }) }), true;
    }
    if (route.length === 5 && route[4] === "templates" && method === "GET")
        return send(200, { templates: service.templates() }), true;
    const id = route[4];
    if (!id)
        return false;
    if (route.length === 5 && method === "GET")
        return send(200, { runs: await service.history(projectId, id) }), true;
    if(route.length===6&&route[5]==="export"&&method==="POST"){const b=await readJson();if(!text(b.previousRunId)||!text(b.latestRunId))throw new Error("Select two observations.");send(200,await service.exportDiff(projectId,id,text(b.previousRunId),text(b.latestRunId)));return true;}
    if (route.length === 6 && route[5] === "export" && method === "GET")
        return send(200, await service.exportDiff(projectId, id)), true;
    if (route.length === 6 && route[5] === "retry" && method === "POST") {
        const b = await readJson();
        return send(202, { run: await service.retry(projectId, id, text(b.runId) || "", text(b.modelId) || "") }), true;
    }
    if (route.length === 6 && route[5] === "diff" && method === "GET")
        return send(200, { diff: await service.diff(projectId, id) }), true;
    if (route.length === 6 && route[5] === "run" && method === "POST")
        return send(202, { run: await service.run(projectId, id) }), true;
    if (route.length === 5 && method === "PATCH") {
        const b = await readJson();
        if ("tags" in b && !list(b.tags))
            throw new Error("Tags must be a string array.");
        if ("repeats" in b && typeof b.repeats !== "number")
            throw new Error("Repeats must be a number.");
        const patch = { ...(list(b.tags) ? { tags: list(b.tags)! } : {}), ...(typeof b.repeats === "number" ? { repeats: b.repeats } : {}), ...(text(b.frequency) ? { frequency: text(b.frequency) as KeywordMonitorFrequency } : {}), ...(typeof b.enabled === "boolean" ? { enabled: b.enabled } : {}), ...(typeof b.brandName === "string" ? { brandName: b.brandName } : {}), ...(list(b.aliases) ? { aliases: list(b.aliases)! } : {}), ...(text(b.kind) ? { kind: text(b.kind) as KeywordMonitorKind } : {}) };
        return send(200, { monitor: await service.update(projectId, id, patch) }), true;
    }
    if (route.length === 5 && method === "DELETE")
        return send(200, await service.remove(projectId, id)), true;
    return false;
}
catch (e) {
    return send(422, { code: "keyword_monitor_invalid", error: e instanceof Error ? e.message : String(e) }), true;
} }
