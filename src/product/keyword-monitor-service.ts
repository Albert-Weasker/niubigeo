import {containsConfiguredIdentity} from "../prompts/brand-question.js";
import {filterKeywordHistory,exportKeywordHistory,type KeywordHistoryFilter} from "./keyword-history.js";
import { randomUUID } from "node:crypto";
import { KEYWORD_MONITOR_TEMPLATES, type KeywordMonitor, type KeywordMonitorDiff, type KeywordMonitorFrequency, type KeywordMonitorKind, type KeywordMonitorRun } from "./keyword-monitor-schema.js";
import type { ProductProjectService } from "./projects/project-service.js";
import type { ProductBaselineService } from "./configuration/baseline-service.js";
import type { RecognitionAnswerExecutor } from "./recognition/recognition-service.js";
import { keywordDiscoveryPrompt, KEYWORD_DISCOVERY_SCHEMA_NAME, KEYWORD_DISCOVERY_TOOL_DESCRIPTION, keywordDiscoveryResponseSchema } from "./measurements/keyword-discovery-protocol.js";
import { KeywordMonitorStore } from "./keyword-monitor-store.js";
import { buildKeywordDiff, keywordDiffCsv, keywordRunSummary } from "./keyword-monitor-insights.js";
const now = () => new Date().toISOString();
const normalize = (v: string) => v.normalize("NFKC").trim().split(" ").filter(Boolean).join(" ").toLocaleLowerCase();
const valid = (v: string) => typeof v === "string" && v.trim().length >= 2 && v.trim().length <= 240;
const languageFor = (value: string): "zh" | "en" | "pt-BR" => value.toLocaleLowerCase().startsWith("pt") ? "pt-BR" : value.toLocaleLowerCase().startsWith("zh") ? "zh" : "en";
function structured(value: unknown): {
    mentions?: Array<{
        name?: unknown;
        recommendation?: unknown;
    }>;
} | null { try {
    const parsed = typeof value === "string"?JSON.parse(value) as unknown:value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) && "mentions" in parsed && Array.isArray(parsed.mentions) ? parsed as {
        mentions?: Array<{
            name?: unknown;
            recommendation?: unknown;
        }>;
    } : null;
}
catch {
    return null;
} }
function ranking(value: unknown, names: string[]): number | null { const mentions = structured(value)?.mentions || []; const positive = mentions.filter(item => item && typeof item === "object" && item.recommendation === "positive" && typeof item.name === "string"); const wanted = new Set(names.map(normalize)); const index = positive.findIndex(item => wanted.has(normalize(item.name as string))); return index < 0 ? null : index; }
function next(f: KeywordMonitorFrequency, from = new Date()) { const d = new Date(from); if (f === "hourly")
    d.setHours(d.getHours() + 1);
else if (f === "daily")
    d.setDate(d.getDate() + 1);
else
    d.setDate(d.getDate() + 7); return d.toISOString(); }
export class KeywordMonitorService {
    constructor(private readonly projects: ProductProjectService, private readonly store: KeywordMonitorStore, private readonly baselines?: ProductBaselineService, private readonly executor?: RecognitionAnswerExecutor) { }
    async list(projectId: string) { await this.projects.get(projectId); return this.store.listMonitors(projectId); }
    async runs(projectId: string, monitorId?: string) { await this.projects.get(projectId); return this.store.listRuns(projectId, monitorId); }
    templates() { return KEYWORD_MONITOR_TEMPLATES; }
    async create(projectId: string, input: {
        keyword: string;
        kind?: KeywordMonitorKind;
        frequency?: KeywordMonitorFrequency;
        brandName?: string;
        aliases?: string[];
        tags?: string[];
        repeats?: number;
    }) { await this.projects.get(projectId); if (!valid(input.keyword))
        throw new Error("关键词需要 2 到 240 个字符。"); const frequency = input.frequency || "daily"; if (!["hourly", "daily", "weekly"].includes(frequency))
        throw new Error("关键词监控频率无效。"); validateOptions(input); const created = now(); const v: KeywordMonitor = { id: `keyword-monitor-${randomUUID()}`, projectId, keyword: input.keyword.trim(), normalizedKeyword: normalize(input.keyword), kind: input.kind || "discovery", frequency, enabled: true, tags: cleanTags(input.tags), repeats: input.repeats || 1, aliases: [...(input.aliases || [])].map(v => v.trim()).filter(Boolean), createdAt: created, updatedAt: created, nextRunAt: next(frequency), ...(input.brandName?.trim() ? { brandName: input.brandName.trim() } : {}) }; await this.store.saveMonitor(v); return v; }
    async createBatch(projectId: string, input: {
        keywords: string[];
        kind?: KeywordMonitorKind;
        frequency?: KeywordMonitorFrequency;
        brandName?: string;
        aliases?: string[];
        tags?: string[];
        repeats?: number;
    }) { if (!Array.isArray(input.keywords) || input.keywords.length === 0)
        throw new Error("请至少输入一个关键词。"); if (!input.keywords.every(valid))
        throw new Error("关键词需要 2 到 240 个字符。"); validateOptions(input); const out = []; const seen = new Set<string>(); for (const keyword of input.keywords) {
        const n = normalize(keyword);
        if (!seen.has(n)) {
            seen.add(n);
            out.push(await this.create(projectId, { ...input, keyword }));
        }
    } return out; }
    async diff(projectId: string, id: string): Promise<KeywordMonitorDiff | null> { const rows = (await this.runs(projectId, id)).filter(r => r.status !== "queued"); return rows.length < 2 ? null : buildKeywordDiff(rows[1]!, rows[0]!); }
    async exportDiff(projectId:string,id:string,previousRunId?:string,latestRunId?:string){
      const rows=(await this.runs(projectId,id)).filter(r=>r.status!=="queued");
      const previous=previousRunId?rows.find(row=>row.id===previousRunId):rows[1];
      const latest=latestRunId?rows.find(row=>row.id===latestRunId):rows[0];
      if(!previous||!latest||previous.id===latest.id)throw new Error("Two completed observations are required.");
      return {filename:`keyword-diff-${id}.csv`,csv:keywordDiffCsv(previous,latest)};
    }
    async history(projectId:string,id:string,filter:KeywordHistoryFilter={}){return filterKeywordHistory(await this.runs(projectId,id),filter);}
    async exportHistory(projectId:string,id:string,filter:KeywordHistoryFilter,format:"csv"|"json"){return {filename:`keyword-history-${id}.${format}`,...exportKeywordHistory(await this.runs(projectId,id),filter,format)}}
    async estimate(projectId:string,id:string,repeats?:number){validateOptions({...(repeats===undefined?{}:{repeats})});const monitor=await this.store.getMonitor(projectId,id);if(!monitor)throw new Error("Keyword monitor not found.");const project=await this.projects.get(projectId);if(!this.baselines||!project.activeBaselineId)throw new Error("Save a model baseline first.");const baseline=await this.baselines.get(projectId,project.activeBaselineId);const samples=repeats??monitor.repeats??1;const requests=baseline.modelSnapshots.length*samples;if(requests>100)throw new Error("Maximum 100 model requests per observation.");return {models:baseline.modelSnapshots.length,repeats:samples,requests,maxOutputTokens:requests*1200,costUsd:null,additionalProviderRetriesPossible:true};}

    async retry(projectId: string, id: string, runId: string, modelId: string) { const guarded = await this.projects.withProjectLock(projectId, async () => { const runs = await this.runs(projectId, id); const original = runs.find(run => run.id === runId); if (!original?.conditions || original.conditions.protocolVersion!=="keyword-monitor-v2" || original.status === "queued")
        throw new Error("Retry requires a completed run with recorded conditions."); if (runs[0]?.id !== runId)
        throw new Error("Open the latest history before retrying."); if (!(original.modelResults || []).some(row => row.modelId === modelId && row.error))
        throw new Error("No failed samples for this model."); return this.runUnlocked(projectId, id, original, modelId); }); if (!guarded.acquired || !guarded.value)
        throw new Error("A keyword monitor run is already in progress for this project."); return guarded.value; }
    async runDue(at = new Date()) { const projects = await this.projects.list({ includeArchived: false }); const completed = []; for (const project of projects) {
        for (const monitor of await this.store.listMonitors(project.id)) {
            if (!monitor.enabled || !monitor.nextRunAt || Date.parse(monitor.nextRunAt) > at.getTime())
                continue;
            try {
                completed.push(await this.run(project.id, monitor.id));
            }
            catch (error) {
                if (error instanceof Error && error.message.includes("already in progress"))
                    continue;
                const failed: KeywordMonitorRun = { id: `keyword-run-${randomUUID()}`, projectId: project.id, monitorId: monitor.id, keyword: monitor.keyword, status: "failed", startedAt: now(), completedAt: now(), mentioned: [], positions: {}, error: error instanceof Error ? error.message : String(error) };
                await this.store.saveRun(failed);
                await this.update(project.id, monitor.id, { lastRunAt: failed.completedAt!, nextRunAt: next(monitor.frequency) });
                completed.push(failed);
            }
        }
    } return completed; }
    async run(projectId: string, id: string,options:{repeats?:number}={}) { validateOptions(options); const guarded = await this.projects.withProjectLock(projectId, () => this.runUnlocked(projectId, id,undefined,undefined,options.repeats)); if (!guarded.acquired || !guarded.value)
        throw new Error("A keyword monitor run is already in progress for this project."); return guarded.value; }
    private async runUnlocked(projectId: string, id: string, original?: KeywordMonitorRun, retryModelId?: string,repeatsOverride?:number) { const monitor = await this.store.getMonitor(projectId, id); if (!monitor)
        throw new Error("关键词监控不存在。"); if (!this.baselines || !this.executor)
        throw new Error("关键词监控执行器未配置。"); const project = await this.projects.get(projectId); if(project.status==="archived"||project.status==="deleted")throw new Error("Restore the project before running a monitor."); if (!project.activeBaselineId)
        throw new Error("请先保存模型配置。"); const baseline = await this.baselines.get(projectId, original?.conditions?.baselineId || project.activeBaselineId); const conditions = original?.conditions || { baselineId: baseline.id, language: languageFor(project.defaultLanguage), prompt: keywordDiscoveryPrompt({ keyword: monitor.keyword, language: languageFor(project.defaultLanguage) }), brandName: monitor.brandName || "", aliases: [...monitor.aliases], repeats: repeatsOverride??monitor.repeats??1, models: baseline.modelSnapshots, protocolVersion: "keyword-monitor-v2" }; if (conditions.models.length * conditions.repeats > 100)
        throw new Error("Maximum 100 model requests per observation."); const preceding=(await this.runs(projectId,id))[0]; const startedAt = new Date(Math.max(Date.now(),preceding?Date.parse(preceding.startedAt)+1:0)).toISOString(); const runId = `keyword-run-${randomUUID()}`; const modelResults: NonNullable<KeywordMonitorRun["modelResults"]> = []; for (const model of conditions.models) {
        for (let sampleIndex = 1; sampleIndex <= conditions.repeats; sampleIndex++) {
            const old = original?.modelResults?.find(row => row.modelId === model.modelId && (row.sampleIndex || 1) === sampleIndex);
            if (original && (!old?.error || model.modelId !== retryModelId)) {
                if (old)
                    modelResults.push({ ...old, carriedFromRunId: original.id });
                continue;
            }
            try {
                const answer = await this.executor.execute({ baseline, modelSnapshot: model, prompt: conditions.prompt, requestParameters: { model: model.modelId, maxTokens: 1200, temperature: 0, requireProviderParameters: model.providerId === "openrouter", webSearchEnabled: model.webSearchMode === "provider_native", webSearchMode: model.webSearchMode, structuredOutputTransport: "response_json_schema", responseSchemaName: KEYWORD_DISCOVERY_SCHEMA_NAME, responseSchemaHash: "keyword-monitor-v1" }, structuredOutput: { name: KEYWORD_DISCOVERY_SCHEMA_NAME, description: KEYWORD_DISCOVERY_TOOL_DESCRIPTION, schema: keywordDiscoveryResponseSchema } });
                const names = [conditions.brandName, ...conditions.aliases].filter((v): v is string => Boolean(v));
                const mentioned = names.filter(name => containsConfiguredIdentity(answer.text,name));
                const parsed = structured(answer.structuredOutput?.value);
                const recommended = (parsed?.mentions || []).filter(item => item && typeof item === "object" && item.recommendation === "positive" && typeof item.name === "string").map(item => item.name as string);
                modelResults.push({ sampleIndex, modelId: model.modelId, modelName: model.displayName, modelVersion: answer.modelVersion, ...(answer.search ? { searchUsed: answer.search.used } : {}), answer: answer.text, mentioned, recommended, position: ranking(answer.structuredOutput?.value, names), citations: answer.citations.map(c => c.url) });
            }
            catch (error) {
                modelResults.push({ sampleIndex, modelId: model.modelId, modelName: model.displayName, answer: "", mentioned: [], recommended: [], position: null, citations: [], error: error instanceof Error ? error.message : String(error) });
            }
        }
    } const all = [...new Set(modelResults.flatMap(v => v.mentioned))]; const status: "completed" | "failed" = modelResults.some(v => v.answer) ? "completed" : "failed"; const result = { id: runId, monitorId: id, projectId, keyword: monitor.keyword, status, startedAt, completedAt: now(), answer: modelResults.map(v => v.answer).filter(Boolean).join("\n\n"), mentioned: all, positions: Object.fromEntries(modelResults.map(v => [v.modelId, v.position])), modelResults, conditions, ...(original ? { retryOfRunId: original.id, retryModelId: retryModelId! } : {}) }; await this.store.saveRun(result); if (!original)
        await this.update(projectId, id, { lastRunAt: result.completedAt, nextRunAt: next(monitor.frequency, new Date(result.completedAt)) } as never); return result; }
    async update(projectId: string, id: string, input: Partial<Pick<KeywordMonitor, "frequency" | "enabled" | "brandName" | "aliases" | "kind" | "lastRunAt" | "nextRunAt" | "tags" | "repeats">>) { const v = await this.store.getMonitor(projectId, id); if (!v)
        throw new Error("关键词监控不存在。"); validateOptions(input); const nextValue = { ...v, ...input, ...(input.tags ? { tags: cleanTags(input.tags) } : {}), updatedAt: now() }; if (input.frequency)
        nextValue.nextRunAt = next(input.frequency); await this.store.saveMonitor(nextValue); return nextValue; }
    async remove(projectId: string, id: string) { if (!await this.store.deleteMonitor(projectId, id))
        throw new Error("关键词监控不存在。"); return { deleted: true }; }
}
function cleanTags(tags?: string[]) { return [...new Set((tags || []).map(tag => tag.trim()).filter(Boolean))]; }
function validateOptions(input: {
    repeats?: number;
    tags?: string[];
    frequency?: string;
    kind?: string;
}) { if (input.repeats !== undefined && (!Number.isInteger(input.repeats) || input.repeats < 1 || input.repeats > 10))
    throw new Error("Repeats must be an integer from 1 to 10."); if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some(tag => typeof tag !== "string" || tag.length > 50)))
    throw new Error("Use at most 20 tags, each up to 50 characters."); if (input.frequency !== undefined && !["hourly", "daily", "weekly"].includes(input.frequency))
    throw new Error("Invalid monitoring frequency."); if (input.kind !== undefined && !["discovery", "alternative", "comparison", "brand", "use_case"].includes(input.kind))
    throw new Error("Invalid keyword type."); }
