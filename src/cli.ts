#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { AuditRunner } from "./runner/audit-runner.js";
import { AuditPlanner } from "./runner/audit-planner.js";
import { loadDotEnv, monitoringDataDir, runsDir } from "./config/env.js";
import { entityFromInput } from "./utils/domain.js";
import type { Entity, KeywordMode, ProviderTarget } from "./core/types.js";
import { percent } from "./report/format.js";
import { ProjectFileStore } from "./projects/project-store.js";
import { RunOrchestrator } from "./monitoring/run-orchestrator.js";
import { LegacyRunImporter } from "./projects/legacy-run-importer.js";
import { MonitoringService } from "./monitoring/monitoring-service.js";
import type { MonitoringSchedule } from "./monitoring/monitoring-task-schema.js";
import { splitByCharacters, splitLines } from "./utils/text.js";

loadDotEnv();

interface ParsedArgs {
  command: string;
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg || !arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function option(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function requiredOption(options: Record<string, string | boolean>, key: string): string {
  const value = option(options, key);
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function numberOption(options: Record<string, string | boolean>, key: string, fallback: number): number {
  const value = Number(option(options, key) || fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${key}`);
  return value;
}

function optionalNumberOption(options: Record<string, string | boolean>, key: string): number | undefined {
  const raw = option(options, key);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${key}`);
  return value;
}

function optionalNonNegativeIntegerOption(options: Record<string, string | boolean>, key: string): number | undefined {
  const raw = option(options, key);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid --${key}`);
  return value;
}

function webSearchEnabledOption(options: Record<string, string | boolean>): boolean {
  return options["web-search"] === true || option(options, "web-search") === "true";
}

function webSearchModeOption(options: Record<string, string | boolean>): "auto" | "provider_native" {
  const value = option(options, "web-search-mode");
  if (!value) return "provider_native";
  if (value === "auto") return "auto";
  if (value === "provider_native") return "provider_native";
  throw new Error("--web-search-mode must be auto or provider_native");
}

function parseProviderTargets(options: Record<string, string | boolean>): ProviderTarget[] {
  const webSearchEnabled = webSearchEnabledOption(options);
  const webSearchMode = webSearchModeOption(options);
  const targets = option(options, "targets");
  if (targets) {
    return targets.split(",").map((pair) => {
      const [providerId, ...modelParts] = pair.split(":");
      const model = modelParts.join(":");
      if (!providerId || !model) throw new Error(`Invalid target "${pair}". Use provider:model.`);
      return { providerId, model, webSearchEnabled, webSearchMode };
    });
  }
  const providerId = option(options, "provider") || "openrouter";
  const models = option(options, "models");
  if (models) {
    return models
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
      .map((model) => ({ providerId, model, webSearchEnabled, webSearchMode }));
  }
  const model = option(options, "model") || "openai/gpt-4o-mini";
  return [{ providerId, model, webSearchEnabled, webSearchMode }];
}

function competitorsFromDomains(domains: string): Entity[] {
  return domains
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) => entityFromInput({ type: "competitor", domain }));
}

function readManualPrompts(options: Record<string, string | boolean>): string[] | undefined {
  const inline = option(options, "prompts");
  if (inline) return inline.split("|").map((prompt) => prompt.trim()).filter(Boolean);
  const file = option(options, "prompts-file");
  if (!file) return undefined;
  if (!existsSync(file)) throw new Error(`Prompts file does not exist: ${file}`);
  return splitLines(readFileSync(file, "utf8")).map((line) => line.trim()).filter(Boolean);
}

function readKeywords(options: Record<string, string | boolean>): string[] {
  const inline = option(options, "keywords");
  const rows: string[] = [];
  if (inline) rows.push(...splitByCharacters(inline, new Set(["\n", ",", "，", ";", "；", "|"])));
  const file = option(options, "keywords-file");
  if (file) {
    if (!existsSync(file)) throw new Error(`Keywords file does not exist: ${file}`);
    rows.push(...splitLines(readFileSync(file, "utf8")));
  }
  return [...new Set(rows.map((keyword) => keyword.trim()).filter(Boolean))];
}

function keywordModeOption(options: Record<string, string | boolean>, keywords: string[]): KeywordMode | undefined {
  const value = option(options, "keyword-mode");
  if (value === "site_plus_user" || value === "user_only" || value === "site_only") return value;
  if (value) throw new Error("--keyword-mode must be site_plus_user, user_only, or site_only");
  return keywords.length > 0 ? "site_plus_user" : undefined;
}

async function runAudit(options: Record<string, string | boolean>): Promise<void> {
  const domain = option(options, "domain");
  if (!domain) throw new Error("--domain is required");
  const target = entityFromInput({
    type: "target",
    domain,
    name: option(options, "name"),
    aliases: (option(options, "aliases") || "").split(",").map((value) => value.trim()).filter(Boolean),
    githubRepo: option(options, "github"),
  });
  const competitors = competitorsFromDomains(option(options, "competitors") || "");
  const keywords = readKeywords(options);
  const keywordMode = keywordModeOption(options, keywords);
  const plan = await new AuditPlanner().plan({
    target,
    submittedDomain: domain,
    competitors,
    providerTargets: parseProviderTargets(options),
    language: option(options, "language") || "en",
    promptCount: numberOption(options, "prompt-count", 8),
    manualPrompts: readManualPrompts(options),
    keywords,
    keywordMode,
    keywordLimit: keywordMode ? optionalNumberOption(options, "keyword-limit") ?? 6 : undefined,
    promptsPerKeyword: keywordMode ? optionalNumberOption(options, "prompts-per-keyword") ?? 2 : undefined,
    autoDiscover: options["no-auto-discover"] !== true,
    targetNameExplicit: Boolean(option(options, "name")),
  });
  const output = await new AuditRunner().run({
    confirmedPlan: plan,
    maxTokens: numberOption(options, "max-tokens", 900),
  });
  const store = new ProjectFileStore(monitoringDataDir());
  const materialized = await new RunOrchestrator(store).recordAuditOutput(output.audit, output.paths);
  console.log(`Audit completed: ${output.audit.id}`);
  console.log(`Project: ${materialized.project.id}`);
  console.log(`Baseline: ${materialized.baseline.id}`);
  console.log(`Mention Rate: ${percent(output.metrics.mentionRate)}`);
  console.log(`Citation Rate: ${percent(output.metrics.citationRate)}`);
  console.log(`Recommendation Rate: ${percent(output.metrics.recommendationRate)}`);
  console.log(`Share of Voice: ${percent(output.metrics.shareOfVoice)}`);
  console.log("AI Provider Breakdown:");
  for (const slice of output.metrics.slices.filter((item) => item.sliceType === "provider_model")) {
    console.log(`  ${slice.label}: mention=${percent(slice.mentionRate)} citation=${percent(slice.citationRate)} recommendation=${percent(slice.recommendationRate)} sov=${percent(slice.shareOfVoice)}`);
  }
  if (output.metrics.keywordMetrics.length > 0) {
    console.log(
      `Keyword AI Association: ${percent(output.metrics.keywordSummary.aiMentionRate)}; Competitor-only Keywords: ${percent(output.metrics.keywordSummary.competitorOnlyRate)}`,
    );
    for (const metric of output.metrics.keywordMetrics.slice(0, 8)) {
      console.log(
        `  keyword="${metric.phrase}" owned=${Math.round(metric.ownedRelevance * 100)}% mention=${percent(metric.mentionRate)} citation=${percent(metric.citationRate)} competitorOnly=${percent(metric.competitorOnlyRate)} gap=${metric.gapLabel}`,
      );
    }
  }
  console.log(`GEO Gap Findings: ${output.gaps.findings.length}`);
  for (const finding of output.gaps.findings.slice(0, 5)) {
    console.log(`  [${finding.severity}/${finding.area}] ${finding.title}`);
  }
  console.log(`Report HTML: ${output.paths.reportHtml}`);
  console.log(`Report Markdown: ${output.paths.reportMd}`);
  if (output.paths.keywordCsv) console.log(`Keyword CSV: ${output.paths.keywordCsv}`);
  console.log(`Raw evidence: ${output.paths.auditJson}`);
}

function monitoringSchedule(options: Record<string, string | boolean>): MonitoringSchedule {
  const kind = option(options, "schedule") || "manual";
  if (kind !== "manual" && kind !== "daily" && kind !== "weekly" && kind !== "cron") {
    throw new Error("--schedule must be manual, daily, weekly, or cron");
  }
  const schedule: MonitoringSchedule = {
    kind,
    timezone: option(options, "timezone") || "UTC",
  };
  const cron = option(options, "cron");
  if (cron) schedule.cron = cron;
  const hour = optionalNonNegativeIntegerOption(options, "hour");
  if (hour !== undefined) schedule.hour = hour;
  const minute = optionalNonNegativeIntegerOption(options, "minute");
  if (minute !== undefined) schedule.minute = minute;
  const dayOfWeek = optionalNonNegativeIntegerOption(options, "day-of-week");
  if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
  return schedule;
}

async function listProjects(): Promise<void> {
  const store = new ProjectFileStore(monitoringDataDir());
  for (const project of await store.listProjects()) {
    const runs = await store.listRuns(project.id);
    const tasks = await store.listTasks(project.id);
    console.log(`${project.id}\t${project.name}\t${project.domain}\truns=${runs.length}\ttasks=${tasks.length}`);
  }
}

async function importLegacyRuns(options: Record<string, string | boolean>): Promise<void> {
  const root = option(options, "runs-root") || runsDir();
  const summary = await new LegacyRunImporter(new ProjectFileStore(monitoringDataDir())).importRuns(root);
  console.log(JSON.stringify(summary, null, 2));
}

async function runProjectBaseline(options: Record<string, string | boolean>): Promise<void> {
  const projectId = requiredOption(options, "project");
  const baselineId = requiredOption(options, "baseline");
  const store = new ProjectFileStore(monitoringDataDir());
  const project = await store.readProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const baseline = await store.readBaseline(projectId, baselineId);
  if (!baseline) throw new Error(`Baseline not found: ${baselineId}`);
  const output = await new RunOrchestrator(store).runBaseline({ project, baseline });
  console.log(`Run completed: ${output.materialized.run.id}`);
  console.log(`Report HTML: ${output.runnerOutput.paths.reportHtml}`);
}

async function createMonitor(options: Record<string, string | boolean>): Promise<void> {
  const projectId = requiredOption(options, "project");
  const baselineId = requiredOption(options, "baseline");
  const store = new ProjectFileStore(monitoringDataDir());
  const service = new MonitoringService(store, new RunOrchestrator(store));
  const task = await service.createTask({ projectId, baselineId, schedule: monitoringSchedule(options) });
  console.log(JSON.stringify(task, null, 2));
}

async function runMonitor(options: Record<string, string | boolean>): Promise<void> {
  const projectId = requiredOption(options, "project");
  const taskId = requiredOption(options, "task");
  const store = new ProjectFileStore(monitoringDataDir());
  const output = await new MonitoringService(store, new RunOrchestrator(store)).runTask(projectId, taskId);
  console.log(`Run completed: ${output.materialized.run.id}`);
}

async function runDueMonitors(): Promise<void> {
  const store = new ProjectFileStore(monitoringDataDir());
  const results = await new MonitoringService(store, new RunOrchestrator(store)).runDue();
  console.log(JSON.stringify(results.map((result) => ({ taskId: result.task.id, runId: result.output?.materialized.run.id, error: result.error })), null, 2));
}

async function runMonitorWorker(options: Record<string, string | boolean>): Promise<void> {
  const pollSeconds = numberOption(options, "poll-seconds", 60);
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      await runDueMonitors();
    } finally {
      polling = false;
    }
  };
  await poll();
  setInterval(() => {
    poll().catch((error) => console.error(error instanceof Error ? error.message : String(error)));
  }, pollSeconds * 1000);
}

async function verifyReal(options: Record<string, string | boolean>): Promise<void> {
  const providerTarget = parseProviderTargets(options)[0];
  if (!providerTarget) throw new Error("Provider target is required.");
  const domain = requiredOption(options, "domain");
  const name = option(options, "name");
  const competitorInput = option(options, "competitors") || "";
  const plan = await new AuditPlanner().plan({
    target: entityFromInput({ type: "target", domain, name }),
    submittedDomain: domain,
    competitors: competitorsFromDomains(competitorInput),
    providerTargets: [providerTarget],
    language: option(options, "language") || "en",
    promptCount: numberOption(options, "prompt-count", 6),
    autoDiscover: true,
    targetNameExplicit: Boolean(name),
  });
  const output = await new AuditRunner().run({
    confirmedPlan: plan,
    maxTokens: numberOption(options, "max-tokens", 900),
  });
  console.log(`Real provider verification passed: provider=${providerTarget.providerId}, model=${providerTarget.model}, report=${output.paths.reportMd}`);
}

async function schedule(options: Record<string, string | boolean>): Promise<void> {
  const configPath = option(options, "config");
  if (!configPath) throw new Error("--config is required");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  const intervalMinutes = Number(config.intervalMinutes || 1440);
  const runOnce = async () => {
    const optionsFromConfig: Record<string, string | boolean> = {
      domain: String(config.domain || ""),
      name: typeof config.name === "string" ? config.name : "",
      competitors: Array.isArray(config.competitors) ? config.competitors.join(",") : "",
      provider: String(config.provider || "openrouter"),
      model: String(config.model || "openai/gpt-4o-mini"),
      "prompt-count": String(config.promptCount || 8),
      language: String(config.language || "en"),
    };
    if (Array.isArray(config.keywords)) optionsFromConfig.keywords = config.keywords.join(",");
    if (typeof config.keywordMode === "string") optionsFromConfig["keyword-mode"] = config.keywordMode;
    if (typeof config.keywordLimit === "number") optionsFromConfig["keyword-limit"] = String(config.keywordLimit);
    if (typeof config.promptsPerKeyword === "number") optionsFromConfig["prompts-per-keyword"] = String(config.promptsPerKeyword);
    if (config.webSearchEnabled === true) optionsFromConfig["web-search"] = true;
    if (typeof config.webSearchMode === "string") optionsFromConfig["web-search-mode"] = config.webSearchMode;
    await runAudit({
      ...optionsFromConfig,
    });
  };
  await runOnce();
  setInterval(() => {
    runOnce().catch((error) => console.error(error instanceof Error ? error.message : String(error)));
  }, intervalMinutes * 60_000);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "audit") return runAudit(options);
  if (command === "verify-real") return verifyReal(options);
  if (command === "schedule") return schedule(options);
  if (command === "projects") return listProjects();
  if (command === "import-runs") return importLegacyRuns(options);
  if (command === "project-run") return runProjectBaseline(options);
  if (command === "monitor-create") return createMonitor(options);
  if (command === "monitor-run") return runMonitor(options);
  if (command === "monitor-due") return runDueMonitors();
  if (command === "monitor-worker") return runMonitorWorker(options);
  console.log("Usage:");
  console.log("  npm run audit -- --domain example.com --targets openrouter:model-id --prompt-count 8 --web-search");
  console.log("  npm run audit -- --domain example.com --keywords \"keyword one,keyword two\" --keyword-limit 4 --prompts-per-keyword 2");
  console.log("  npm run verify:real -- --domain example.com --provider openrouter --model model-id");
  console.log("  npm run server");
  console.log("  npx tsx src/cli.ts import-runs");
  console.log("  npx tsx src/cli.ts projects");
  console.log("  npx tsx src/cli.ts project-run --project project-id --baseline baseline-id");
  console.log("  npx tsx src/cli.ts monitor-create --project project-id --baseline baseline-id --schedule daily --timezone Asia/Shanghai --hour 9");
  console.log("  npx tsx src/cli.ts monitor-due");
  console.log("  npx tsx src/cli.ts monitor-worker --poll-seconds 60");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
