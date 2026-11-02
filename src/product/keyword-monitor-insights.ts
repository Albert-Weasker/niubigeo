import type { KeywordModelResult, KeywordMonitorDiff, KeywordMonitorRun } from "./keyword-monitor-schema.js";
export const sampleKey = (row: KeywordModelResult) => JSON.stringify([row.modelId, row.sampleIndex || 1]);
export function keywordRunSummary(run: KeywordMonitorRun) {
    const ids = [...new Set((run.modelResults || []).map(row => row.modelId))];
    return ids.map(modelId => {
        const rows = (run.modelResults || []).filter(row => row.modelId === modelId);
        const success = rows.filter(row => !row.error);
        const frequencies=(field:"recommended"|"citations")=>[...new Set(success.flatMap(row=>row[field]))].map(value=>({value,count:success.filter(row=>row[field].includes(value)).length,total:success.length}));
        return { recommendations:frequencies("recommended"),sources:frequencies("citations"),modelId, modelName: rows[0]!.modelName, samples: rows.length, successful: success.length, failed: rows.length - success.length,
            mentioned: success.filter(row => row.mentioned.length > 0).length,
            mentionRate: success.length ? success.filter(row => row.mentioned.length > 0).length / success.length : null };
    });
}
export function buildKeywordDiff(previous: KeywordMonitorRun, latest: KeywordMonitorRun): KeywordMonitorDiff {
    const warnings: string[] = [];
    const a = previous.conditions, b = latest.conditions;
    let conditionsMatch = true;
    if (!a || !b)
        warnings.push("conditions_unknown");
    else {
        for (const key of ["prompt", "language", "brandName", "aliases", "repeats", "protocolVersion"] as const) {
            if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
                warnings.push(`${key}_changed`);
                conditionsMatch = false;
            }
        }
    }
    if (previous.error || latest.error)
        warnings.push("failed_or_missing_results");
    if (latest.retryOfRunId || previous.retryOfRunId)
        warnings.push("retry_snapshot");
    const old = new Map((previous.modelResults || []).map(row => [sampleKey(row), row]));
    const current = new Map((latest.modelResults || []).map(row => [sampleKey(row), row]));
    const excluded = new Set<string>();
    const pairs: Array<[
        KeywordModelResult,
        KeywordModelResult
    ]> = [];
    for (const key of new Set([...old.keys(), ...current.keys()])) {
        const left = old.get(key), right = current.get(key);
        const id = (left || right)!.modelId;
        if (!left || !right || left.error || right.error) {
            warnings.push("failed_or_missing_results");
            excluded.add(id);
            continue;
        }
        const leftModel = a?.models.find(model => model.modelId === id), rightModel = b?.models.find(model => model.modelId === id);
        const config = (model: typeof leftModel) => model && [model.providerId, model.baseUrl || "", model.upstreamModelId || model.modelId, model.webSearchMode];
        if ((a && b && (!leftModel || !rightModel || JSON.stringify(config(leftModel)) !== JSON.stringify(config(rightModel)))) || left.modelVersion !== right.modelVersion || left.searchUsed !== right.searchUsed) {
            warnings.push("model_or_search_changed");
            excluded.add(id);
            continue;
        }
        if (conditionsMatch)
            pairs.push([left, right]);
        else
            excluded.add(id);
    }
    if (!pairs.length)
        warnings.push("no_comparable_results");
    const values = (index: 0 | 1, field: "recommended" | "citations") => [...new Set(pairs.flatMap(pair => pair[index][field]))];
    const oldNames = values(0, "recommended"), newNames = values(1, "recommended"), oldSources = values(0, "citations"), newSources = values(1, "citations");
    const movedMentions = pairs.filter(([left, right]) => left.position !== right.position).map(([left, right]) => ({ modelId: right.modelId, modelName: `${right.modelName}${(b?.repeats || 1) > 1 ? ` [${right.sampleIndex || 1}]` : ""}`, from: left.position, to: right.position }));
    const diff: KeywordMonitorDiff = { monitorId: latest.monitorId, previousRunId: previous.id, latestRunId: latest.id, previousAt: previous.startedAt, latestAt: latest.startedAt,
        addedRecommendations: newNames.filter(v => !oldNames.includes(v)), removedRecommendations: oldNames.filter(v => !newNames.includes(v)), movedMentions,
        addedSources: newSources.filter(v => !oldSources.includes(v)), removedSources: oldSources.filter(v => !newSources.includes(v)), changedModels: new Set(movedMentions.map(row => row.modelId)).size, hasChanges: false,
        warnings: [...new Set(warnings)], comparable: Boolean(a && b && conditionsMatch && pairs.length && !excluded.size && !latest.retryOfRunId && !previous.retryOfRunId), excludedModels: [...excluded] };
    diff.hasChanges = Boolean(diff.addedRecommendations.length || diff.removedRecommendations.length || diff.movedMentions.length || diff.addedSources.length || diff.removedSources.length);
    return diff;
}
function csvCell(value: unknown): string {
    let text = String(value ?? "");
    if (["=", "+", "-", "@", "\t", "\r", "\n"].some(prefix => text.trimStart().startsWith(prefix) || text.startsWith(prefix)))
        text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}
export function keywordDiffCsv(previous: KeywordMonitorRun, latest: KeywordMonitorRun): string {
    const diff = buildKeywordDiff(previous, latest);
    const old = new Map((previous.modelResults || []).map(row => [sampleKey(row), row]));
    const current = new Map((latest.modelResults || []).map(row => [sampleKey(row), row]));
    const rows: unknown[][] = [["keyword", "model_id", "model_name", "sample", "previous_run", "current_run", "previous_at", "current_at", "previous_position", "current_position", "previous_mentions", "current_mentions", "previous_recommendations", "current_recommendations", "previous_sources", "current_sources", "previous_error", "current_error", "comparability_warnings", "position_change", "added_recommendations", "removed_recommendations", "added_sources", "removed_sources"]];
    for (const key of new Set([...old.keys(), ...current.keys()])) {
        const a = old.get(key), b = current.get(key), row = (b || a)!;
        rows.push([latest.keyword, row.modelId, row.modelName, row.sampleIndex || 1, previous.id, latest.id, previous.startedAt, latest.startedAt, a?.position == null ? "" : a.position + 1, b?.position == null ? "" : b.position + 1, JSON.stringify(a?.mentioned || []), JSON.stringify(b?.mentioned || []), JSON.stringify(a?.recommended || []), JSON.stringify(b?.recommended || []), JSON.stringify(a?.citations || []), JSON.stringify(b?.citations || []), a?.error || "", b?.error || "", (diff.warnings || []).join("; "), a?.position != null && b?.position != null ? a.position - b.position : "", JSON.stringify((b?.recommended || []).filter(v => !(a?.recommended || []).includes(v))), JSON.stringify((a?.recommended || []).filter(v => !(b?.recommended || []).includes(v))), JSON.stringify((b?.citations || []).filter(v => !(a?.citations || []).includes(v))), JSON.stringify((a?.citations || []).filter(v => !(b?.citations || []).includes(v)))]);
    }
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
