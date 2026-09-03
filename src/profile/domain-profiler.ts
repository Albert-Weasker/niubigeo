import type { AnswerProvider, DiscoveryEvidence, DomainProfile, Entity, MonitoringPrompt, PromptType } from "../core/types.js";
import { FileStore } from "../store/file-store.js";
import { entityFromInput, normalizeDomain, titleFromDomain } from "../utils/domain.js";
import { DomainPromptPlanner } from "../prompts/domain-prompt-planner.js";

interface HomepageMetadata {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  textSnippet?: string | undefined;
  evidencePages?: DomainEvidencePage[] | undefined;
}

interface DomainEvidencePage {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  textSnippet?: string | undefined;
}

interface FetchedEvidencePage extends DomainEvidencePage {
  html: string;
}

const EXTRA_PAGE_HINT =
  /(?:^|[-_/])(alternative|alternatives|best|case|cases|compare|comparison|competitor|competitors|customer|customers|docs|documentation|guide|guides|help|learn|pricing|resource|resources|review|reviews|solution|solutions|use-case|use-cases)(?:[-_/]|$)/i;

function stripHtml(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return undefined;
}

function titleContent(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return undefined;
  return decodeEntities(match[1].replace(/\s+/g, " ").trim());
}

function htmlTextSnippet(html: string): string | undefined {
  const text = decodeEntities(
    html
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return text ? text.slice(0, 8000) : undefined;
}

function hostForFetch(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  }
}

function candidateEntryUrls(inputDomain: string): string[] {
  const normalized = normalizeDomain(inputDomain);
  const inputHost = hostForFetch(inputDomain) || normalized;
  const hosts = [inputHost, normalized, `www.${normalized}`].filter(Boolean);
  const uniqueHosts = [...new Set(hosts)];
  return uniqueHosts.flatMap((host) => [`https://${host}`, `http://${host}`]);
}

async function fetchEvidencePage(url: string): Promise<FetchedEvidencePage | null> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;
  const html = stripHtml((await response.text()).slice(0, 260_000));
  return {
    url: response.url || url,
    title: titleContent(html) || metaContent(html, "og:title"),
    description: metaContent(html, "description") || metaContent(html, "og:description"),
    textSnippet: htmlTextSnippet(html),
    html,
  };
}

function extractSameDomainLinks(html: string, baseUrl: string, rootDomain: string): string[] {
  const links = new Map<string, number>();
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      if (normalizeDomain(url.hostname) !== rootDomain) continue;
      url.hash = "";
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      if (pathname === "/") continue;
      if (/\.(?:avif|css|gif|ico|jpg|jpeg|js|json|pdf|png|svg|webp|xml)$/i.test(pathname)) continue;
      const href = url.toString();
      const score = EXTRA_PAGE_HINT.test(pathname) ? 2 : 1;
      links.set(href, Math.max(links.get(href) || 0, score));
    } catch {
      continue;
    }
  }
  return [...links.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([url]) => url)
    .slice(0, 6);
}

export async function fetchHomepageMetadata(domain: string): Promise<HomepageMetadata> {
  const normalized = normalizeDomain(domain);
  const urls = candidateEntryUrls(domain);
  let lastError: unknown;
  for (const url of urls) {
    try {
      const home = await fetchEvidencePage(url);
      if (!home) continue;
      const linkedPages: DomainEvidencePage[] = [];
      for (const link of extractSameDomainLinks(home.html, home.url, normalized)) {
        try {
          const page = await fetchEvidencePage(link);
          if (!page) continue;
          linkedPages.push({
            url: page.url,
            title: page.title,
            description: page.description,
            textSnippet: page.textSnippet,
          });
          if (linkedPages.length >= 4) break;
        } catch {
          continue;
        }
      }
      return {
        url: home.url,
        title: home.title,
        description: home.description,
        textSnippet: home.textSnippet,
        evidencePages: linkedPages,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    url: `https://${normalized}`,
    description: lastError instanceof Error ? `Homepage metadata fetch failed: ${lastError.message}` : "Homepage metadata fetch failed.",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1]);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("Domain profiler did not return a JSON object.");
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function promptType(value: unknown): PromptType {
  return ["brand", "category", "recommendation", "comparison", "alternative", "scenario"].includes(String(value))
    ? (String(value) as PromptType)
    : "category";
}

function competitorRelationship(value: unknown): "direct_competitor" | "adjacent" | "category" | "infrastructure" | "unknown" {
  const normalized = String(value || "direct_competitor");
  if (["direct_competitor", "adjacent", "category", "infrastructure", "unknown"].includes(normalized)) {
    return normalized as "direct_competitor" | "adjacent" | "category" | "infrastructure" | "unknown";
  }
  return "unknown";
}

function confidence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function candidateBrandNames(domain: string, homepage: HomepageMetadata): string[] {
  const normalized = normalizeDomain(domain);
  const root = normalized.split(".")[0] || normalized;
  const candidates = [titleFromDomain(normalized)];
  const searchable = [homepage.title, homepage.description, homepage.textSnippet].filter(Boolean).join(" ");
  const rootMatch = searchable.match(new RegExp(`\\b${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  if (rootMatch?.[0]) candidates.unshift(rootMatch[0]);
  for (const part of (homepage.title || "").split(/\s+[|｜-]\s+|[|｜]/)) {
    const cleaned = part.trim();
    if (cleaned && cleaned.length <= 60) candidates.push(cleaned);
  }
  return [...new Set(candidates.filter(Boolean))];
}

function canonicalBrandName(input: { parsedName: string; domain: string; homepage: HomepageMetadata }): string {
  const root = input.domain.split(".")[0] || input.domain;
  const parsedCompact = compactName(input.parsedName);
  for (const candidate of candidateBrandNames(input.domain, input.homepage)) {
    const candidateCompact = compactName(candidate);
    if (candidateCompact === parsedCompact || candidateCompact === root) return candidate;
  }
  return input.parsedName.trim() || titleFromDomain(input.domain);
}

function parseProfile(text: string, fallbackDomain: string, homepage: HomepageMetadata): DomainProfile {
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Domain profiler JSON is not an object.");
  const row = parsed as Record<string, unknown>;
  const domain = normalizeDomain(typeof row.domain === "string" ? row.domain : fallbackDomain);
  const parsedBrandName = typeof row.brandName === "string" && row.brandName.trim() ? row.brandName.trim() : domain.split(".")[0] || domain;
  const brandName = canonicalBrandName({ parsedName: parsedBrandName, domain, homepage });
  const competitors = Array.isArray(row.competitors)
    ? row.competitors
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.domain === "string" && typeof item.name === "string")
        .map((item) => ({
          name: String(item.name).trim(),
          domain: normalizeDomain(String(item.domain)),
          reason: typeof item.reason === "string" ? item.reason : "AI-discovered competitor",
          relationship: competitorRelationship(item.relationship),
          confidence: confidence(item.confidence),
        }))
        .filter((item) => item.name && item.domain && item.domain !== domain)
        .filter((item) => item.relationship === "direct_competitor")
        .filter((item) => item.confidence === undefined || item.confidence >= 0.55)
        .slice(0, 8)
    : [];
  const promptSuggestions = Array.isArray(row.promptSuggestions)
    ? row.promptSuggestions
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.prompt === "string" && item.prompt.trim())
        .map((item) => ({
          type: promptType(item.type),
          topic: typeof item.topic === "string" && item.topic.trim() ? item.topic.trim() : "discovered",
          prompt: String(item.prompt).trim(),
        }))
        .slice(0, 20)
    : [];

  return {
    domain,
    brandName,
    aliases: stringArray(row.aliases).filter((alias) => alias.toLowerCase() !== brandName.toLowerCase()),
    category: typeof row.category === "string" && row.category.trim() ? row.category.trim() : "unknown",
    description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : "",
    competitors,
    promptSuggestions,
  };
}

function profilePrompt(input: { domain: string; homepage: HomepageMetadata; desiredPrompts: number; language: string }): string {
  const evidencePageLines = (input.homepage.evidencePages || [])
    .map((page, index) =>
      [
        `Page ${index + 1}: ${page.url}`,
        `Title: ${page.title || "unknown"}`,
        `Description: ${page.description || "unknown"}`,
        `Text sample: ${(page.textSnippet || "unknown").slice(0, 2500)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "You are preparing an AI visibility audit from a single domain.",
    "Return only valid JSON. Do not include markdown.",
    "",
    `Domain: ${input.domain}`,
    `Homepage URL checked: ${input.homepage.url}`,
    `Homepage title: ${input.homepage.title || "unknown"}`,
    `Homepage description: ${input.homepage.description || "unknown"}`,
    `Homepage text sample: ${input.homepage.textSnippet || "unknown"}`,
    "",
    "Additional same-domain evidence pages:",
    evidencePageLines || "none",
    `Language for monitoring prompts: ${input.language}`,
    "",
    "Produce this JSON shape:",
    "{",
    "  \"domain\": \"example.com\",",
    "  \"brandName\": \"Brand\",",
    "  \"aliases\": [\"Brand Alias\"],",
    "  \"category\": \"short product/category label\",",
    "  \"description\": \"one sentence about what this brand/product does\",",
    "  \"competitors\": [{\"name\":\"Competitor\",\"domain\":\"competitor.com\",\"relationship\":\"direct_competitor\",\"confidence\":0.8,\"reason\":\"why comparable\"}],",
    "  \"promptSuggestions\": [{\"type\":\"category\",\"topic\":\"topic\",\"prompt\":\"question to send to AI providers\"}]",
    "}",
    "",
    "Use the homepage facts above as the strongest evidence. Do not guess a broad category from the domain name when the homepage text gives a narrower category.",
    "Only list direct product or service competitors. Do not list broad categories, generic concepts, underlying platforms, app stores, marketplaces, payment rails, or infrastructure providers unless they sell the same product to the same buyer.",
    "For each competitor, set relationship to direct_competitor only when it sells a comparable product or service to the same user. Otherwise set adjacent, category, infrastructure, or unknown; non-direct entries will be kept as evidence but not configured as competitors.",
    `Create ${input.desiredPrompts} promptSuggestions in the requested monitoring language. Include brand, recommendation, category, comparison, alternative, and scenario prompts when possible. At least half of the prompts must be natural unbranded discovery questions that do not include the target brand or target domain. Competitors must have real domains when you know them. If uncertain, omit instead of inventing.`,
  ].join("\n");
}

export class DomainProfiler {
  private readonly promptPlanner = new DomainPromptPlanner();

  async discover(input: {
    auditId: string;
    domain: string;
    language: string;
    desiredPrompts: number;
    provider: AnswerProvider;
    model: string;
    apiKey: string;
    store: FileStore;
  }): Promise<{ target: Entity; competitors: Entity[]; prompts: MonitoringPrompt[]; profile: DomainProfile; evidence: DiscoveryEvidence }> {
    const domain = normalizeDomain(input.domain);
    const homepage = await fetchHomepageMetadata(domain);
    const prompt = profilePrompt({ domain, homepage, desiredPrompts: input.desiredPrompts, language: input.language });
    const result = await input.provider.run({
      prompt,
      model: input.model,
      apiKey: input.apiKey,
      maxTokens: 1600,
      temperature: 0.1,
      webSearchEnabled: false,
    });
    const profile = parseProfile(result.text, domain, homepage);
    const target = entityFromInput({
      type: "target",
      domain: profile.domain,
      name: profile.brandName,
      aliases: profile.aliases,
    });
    const competitors = profile.competitors.map((competitor) =>
      entityFromInput({
        type: "competitor",
        domain: competitor.domain,
        name: competitor.name,
      }),
    );
    const prompts = this.promptPlanner.build({
      target,
      competitors,
      profile,
      language: input.language,
      count: input.desiredPrompts,
    });

    return {
      target,
      competitors,
      prompts,
      profile,
      evidence: {
        providerId: input.provider.definition.id,
        model: input.model,
        sourceLabel: result.sourceLabel,
        submittedDomain: input.domain,
        homepageUrl: homepage.url,
        homepageTitle: homepage.title,
        homepageDescription: homepage.description,
        homepageTextSnippet: homepage.textSnippet,
        evidencePages: homepage.evidencePages?.map((page) => ({ url: page.url, title: page.title })),
        prompt,
        text: result.text,
      },
    };
  }
}
