#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { AuditRunner } from "./runner/audit-runner.js";
import { loadDotEnv } from "./config/env.js";
import { entityFromInput } from "./utils/domain.js";
import type { Entity, KeywordMode, ProviderTarget } from "./core/types.js";
import { percent } from "./report/format.js";

loadDotEnv();

interface ParsedArgs {
  command: string;
  options: Record<string, string | boolean>;
}

interface BrandCase {
  name: string;
  domain: string;
  category: string;
  competitors: string[];
}

const REAL_VERIFY_BRANDS: BrandCase[] = [
  { name: "Vercel", domain: "vercel.com", category: "frontend deployment platforms", competitors: ["netlify.com", "cloudflare.com"] },
  { name: "Supabase", domain: "supabase.com", category: "open source database platforms", competitors: ["firebase.google.com", "neon.tech"] },
  { name: "Prisma", domain: "prisma.io", category: "TypeScript ORM tools", competitors: ["typeorm.io", "sequelize.org"] },
  { name: "Linear", domain: "linear.app", category: "product issue tracking tools", competitors: ["atlassian.com", "asana.com"] },
  { name: "Notion", domain: "notion.so", category: "team workspace documentation tools", competitors: ["coda.io", "confluence.atlassian.com"] },
  { name: "Slack", domain: "slack.com", category: "team communication platforms", competitors: ["microsoft.com", "discord.com"] },
  { name: "Docker", domain: "docker.com", category: "container developer tools", competitors: ["podman.io", "kubernetes.io"] },
  { name: "Kubernetes", domain: "kubernetes.io", category: "container orchestration platforms", competitors: ["docker.com", "nomadproject.io"] },
  { name: "GitHub", domain: "github.com", category: "software collaboration platforms", competitors: ["gitlab.com", "bitbucket.org"] },
  { name: "Figma", domain: "figma.com", category: "collaborative design tools", competitors: ["sketch.com", "adobe.com"] },
  { name: "Stripe", domain: "stripe.com", category: "developer payment platforms", competitors: ["adyen.com", "paypal.com"] },
  { name: "Shopify", domain: "shopify.com", category: "commerce platforms", competitors: ["bigcommerce.com", "woocommerce.com"] },
  { name: "PostHog", domain: "posthog.com", category: "product analytics platforms", competitors: ["amplitude.com", "mixpanel.com"] },
  { name: "Sentry", domain: "sentry.io", category: "application error monitoring tools", competitors: ["datadoghq.com", "newrelic.com"] },
  { name: "LangSmith", domain: "langsmith.com", category: "LLM observability tools", competitors: ["langfuse.com", "helicone.ai"] },
  { name: "Hugging Face", domain: "huggingface.co", category: "machine learning model hubs", competitors: ["replicate.com", "kaggle.com"] },
  { name: "Tailwind CSS", domain: "tailwindcss.com", category: "CSS frameworks", competitors: ["getbootstrap.com", "bulma.io"] },
  { name: "Next.js", domain: "nextjs.org", category: "React application frameworks", competitors: ["remix.run", "astro.build"] },
  { name: "Redis", domain: "redis.io", category: "in-memory databases", competitors: ["memcached.org", "dragonflydb.io"] },
  { name: "ClickHouse", domain: "clickhouse.com", category: "real-time analytics databases", competitors: ["druid.apache.org", "pinot.apache.org"] },
];

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

function parseProviderTargets(options: Record<string, string | boolean>): ProviderTarget[] {
  const targets = option(options, "targets");
  if (targets) {
    return targets.split(",").map((pair) => {
      const [providerId, ...modelParts] = pair.split(":");
      const model = modelParts.join(":");
      if (!providerId || !model) throw new Error(`Invalid target "${pair}". Use provider:model.`);
      return { providerId, model };
    });
  }
  const providerId = option(options, "provider") || "openrouter";
  const models = option(options, "models");
  if (models) {
    return models
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
      .map((model) => ({ providerId, model }));
  }
  const model = option(options, "model") || "openai/gpt-4o-mini";
  return [{ providerId, model }];
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
  return readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readKeywords(options: Record<string, string | boolean>): string[] {
  const inline = option(options, "keywords");
  const rows: string[] = [];
  if (inline) rows.push(...inline.split(/[\n,，;；|]+/));
  const file = option(options, "keywords-file");
  if (file) {
    if (!existsSync(file)) throw new Error(`Keywords file does not exist: ${file}`);
    rows.push(...readFileSync(file, "utf8").split(/\r?\n/));
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
  const output = await new AuditRunner().run({
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
    maxTokens: numberOption(options, "max-tokens", 900),
  });
  console.log(`Audit completed: ${output.audit.id}`);
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

async function verifyReal(options: Record<string, string | boolean>): Promise<void> {
  const providerTarget = parseProviderTargets(options)[0];
  if (!providerTarget) throw new Error("Provider target is required.");
  const limit = Math.min(numberOption(options, "limit", 20), REAL_VERIFY_BRANDS.length);
  let completed = 0;
  for (const item of REAL_VERIFY_BRANDS.slice(0, limit)) {
    const prompt = `For the category "${item.category}", recommend the strongest tools or products. Include official URLs only if you know them. Do not invent sources.`;
    const output = await new AuditRunner().run({
      target: entityFromInput({ type: "target", domain: item.domain, name: item.name }),
      submittedDomain: item.domain,
      competitors: competitorsFromDomains(item.competitors.join(",")),
      providerTargets: [providerTarget],
      language: "en",
      promptCount: 1,
      manualPrompts: [prompt],
      autoDiscover: false,
      targetNameExplicit: true,
      maxTokens: numberOption(options, "max-tokens", 520),
    });
    completed += 1;
    console.log(
      `[verify:${completed}/${limit}:${item.domain}] mention=${percent(output.metrics.mentionRate)} citation=${percent(output.metrics.citationRate)} recommendation=${percent(output.metrics.recommendationRate)} sov=${percent(output.metrics.shareOfVoice)} report=${output.paths.reportMd}`,
    );
  }
  console.log(`Real provider verification passed: completed=${completed}, failed=0, provider=${providerTarget.providerId}, model=${providerTarget.model}`);
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
  console.log("Usage:");
  console.log("  npm run audit -- --domain www.niubistar.com --targets openrouter:openai/gpt-4o-mini,openrouter:perplexity/sonar --prompt-count 8");
  console.log("  npm run audit -- --domain www.niubistar.com --keywords \"GitHub project promotion,GitHub star growth\" --keyword-limit 4 --prompts-per-keyword 2");
  console.log("  npm run audit -- --domain vercel.com --provider openrouter --models openai/gpt-4o-mini,perplexity/sonar --prompt-count 8");
  console.log("  npm run verify:real");
  console.log("  npm run server");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
