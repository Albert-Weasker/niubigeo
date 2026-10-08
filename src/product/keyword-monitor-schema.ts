export type KeywordMonitorFrequency = "hourly" | "daily" | "weekly";
export type KeywordMonitorKind = "discovery" | "alternative" | "comparison" | "brand" | "use_case";
export interface KeywordMonitor {
  id: string; projectId: string; keyword: string; normalizedKeyword: string; kind: KeywordMonitorKind;
  frequency: KeywordMonitorFrequency; enabled: boolean; brandName?: string; aliases: string[];
  createdAt: string; updatedAt: string; lastRunAt?: string; nextRunAt?: string;
}
export interface KeywordMonitorRun {
  id: string; monitorId: string; projectId: string; status: "queued" | "completed" | "failed";
  keyword: string; startedAt: string; completedAt?: string; answer?: string; mentioned: string[]; positions: Record<string, number | null>; modelResults?: Array<{ modelId: string; modelName: string; answer: string; mentioned: string[]; position: number | null; citations: string[]; error?: string }>; error?: string;
}
export interface KeywordMonitorTemplate { id: string; name: string; description: string; kind: KeywordMonitorKind; keywords: string[]; }
export const KEYWORD_MONITOR_TEMPLATES: KeywordMonitorTemplate[] = [
 { id:"ai-coding", name:"AI Coding", description:"观察 AI 是否推荐你的开发工具。", kind:"discovery", keywords:["best AI coding agent","best AI coding tools","best Cursor alternatives","best Claude Code alternatives","AI coding tools for startups"] },
 { id:"saas", name:"SaaS / Product", description:"观察 AI 是否推荐你的 SaaS。", kind:"use_case", keywords:["best CRM for startups","best email marketing tools","best analytics tools for SaaS"] },
 { id:"geo", name:"GEO", description:"观察 AI 是否认识你的品牌。", kind:"brand", keywords:["best GEO tools","What is NiubiGEO?","NiubiGEO alternatives"] },
 { id:"comparison", name:"品牌对比", description:"观察品牌在替代和对比问题中的出现。", kind:"comparison", keywords:["best alternatives to your competitor","tools like your competitor","your competitor vs alternatives"] },
];
