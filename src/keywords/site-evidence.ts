import type { SiteEvidence, SiteEvidencePage } from "../core/types.js";
import { fetchGithubMetadata } from "../ingest/github.js";
import { normalizeDomain } from "../utils/domain.js";

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
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function attrValue(tag: string, attr: string): string | undefined {
  const pattern = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);
  const value = match?.[2] ?? match?.[3] ?? match?.[4];
  return value ? decodeEntities(value.trim()) : undefined;
}

function metaValues(html: string, names: string[]): string[] {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const values: string[] = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (attrValue(tag, "name") || attrValue(tag, "property") || "").toLowerCase();
    const content = attrValue(tag, "content");
    if (content && wanted.has(key)) values.push(content);
  }
  return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function titleContent(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return undefined;
  return decodeEntities(match[1].replace(/\s+/g, " ").trim());
}

function textFromHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function htmlTextSnippet(html: string): string | undefined {
  const text = textFromHtml(html);
  return text ? text.slice(0, 10000) : undefined;
}

function headings(html: string): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)) {
    const text = textFromHtml(match[1] || "");
    if (text) values.push(text);
  }
  return [...new Set(values)].slice(0, 30);
}

function splitKeywords(value: string): string[] {
  return value
    .split(/[,，;；|]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function jsonLdScripts(html: string): unknown[] {
  const rows: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = decodeEntities((match[1] || "").trim());
    if (!raw) continue;
    try {
      rows.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return rows;
}

function valuesFromJsonLd(input: unknown, key: "name" | "description" | "keywords"): string[] {
  const values: string[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    const found = row[key];
    if (typeof found === "string") {
      if (key === "keywords") values.push(...splitKeywords(found));
      else values.push(found);
    } else if (Array.isArray(found)) {
      for (const item of found) {
        if (typeof item === "string") values.push(item);
      }
    }
    for (const nested of Object.values(row)) {
      if (nested && typeof nested === "object") visit(nested);
    }
  };
  visit(input);
  return [...new Set(values.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 50);
}

export function extractSiteEvidencePage(input: { url: string; html: string }): SiteEvidencePage {
  const jsonLd = jsonLdScripts(input.html);
  const html = stripHtml(input.html);
  const metaKeywords = metaValues(html, ["keywords"]).flatMap(splitKeywords);
  const jsonLdKeywords = jsonLd.flatMap((row) => valuesFromJsonLd(row, "keywords"));
  const jsonLdNames = jsonLd.flatMap((row) => valuesFromJsonLd(row, "name"));
  const jsonLdDescriptions = jsonLd.flatMap((row) => valuesFromJsonLd(row, "description"));

  return {
    url: input.url,
    title: titleContent(html) || metaValues(html, ["og:title"])[0],
    description: metaValues(html, ["description", "og:description"])[0],
    metaKeywords: [...new Set(metaKeywords)].slice(0, 50),
    headings: headings(html),
    ogTitle: metaValues(html, ["og:title"])[0],
    ogDescription: metaValues(html, ["og:description"])[0],
    twitterTitle: metaValues(html, ["twitter:title"])[0],
    twitterDescription: metaValues(html, ["twitter:description"])[0],
    jsonLdKeywords: [...new Set(jsonLdKeywords)].slice(0, 50),
    jsonLdNames: [...new Set(jsonLdNames)].slice(0, 30),
    jsonLdDescriptions: [...new Set(jsonLdDescriptions)].slice(0, 30),
    textSnippet: htmlTextSnippet(html),
  };
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

async function fetchText(url: string): Promise<{ url: string; text: string; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal });
    if (!response.ok) return null;
    return {
      url: response.url || url,
      text: await response.text(),
      contentType: response.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEvidencePage(url: string): Promise<SiteEvidencePage | null> {
  const response = await fetchText(url);
  if (!response) return null;
  if (!response.contentType.includes("text/html") && !response.contentType.includes("application/xhtml")) return null;
  return extractSiteEvidencePage({ url: response.url, html: response.text.slice(0, 260_000) });
}

export function extractSameDomainLinks(html: string, baseUrl: string, rootDomain: string): string[] {
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
      const score = EXTRA_PAGE_HINT.test(pathname) ? 2 : 1;
      links.set(url.toString(), Math.max(links.get(url.toString()) || 0, score));
    } catch {
      continue;
    }
  }
  return [...links.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([url]) => url)
    .slice(0, 8);
}

async function sitemapUrls(domain: string): Promise<string[]> {
  const urls: string[] = [];
  for (const host of [`https://${domain}/sitemap.xml`, `https://www.${domain}/sitemap.xml`]) {
    try {
      const response = await fetchText(host);
      if (!response || !response.contentType.includes("xml")) continue;
      for (const match of response.text.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
        const raw = decodeEntities((match[1] || "").trim());
        try {
          const url = new URL(raw);
          if (normalizeDomain(url.hostname) === domain) urls.push(url.toString());
        } catch {
          continue;
        }
      }
      if (urls.length > 0) break;
    } catch {
      continue;
    }
  }
  return [...new Set(urls)].slice(0, 40);
}

export class SiteEvidenceCollector {
  async collect(input: { submittedDomain: string; maxPages?: number | undefined; githubRepo?: string | undefined }): Promise<SiteEvidence> {
    const canonicalDomain = normalizeDomain(input.submittedDomain);
    const maxPages = Math.max(1, Math.min(input.maxPages ?? 5, 10));
    const pages: SiteEvidencePage[] = [];
    let homeHtml: string | null = null;
    let homeUrl: string | null = null;
    let github: SiteEvidence["github"];

    for (const url of candidateEntryUrls(input.submittedDomain)) {
      try {
        const response = await fetchText(url);
        if (!response) continue;
        if (!response.contentType.includes("text/html") && !response.contentType.includes("application/xhtml")) continue;
        homeUrl = response.url;
        homeHtml = response.text.slice(0, 260_000);
        pages.push(extractSiteEvidencePage({ url: response.url, html: homeHtml }));
        break;
      } catch {
        continue;
      }
    }

    if (homeHtml && homeUrl) {
      for (const link of extractSameDomainLinks(homeHtml, homeUrl, canonicalDomain)) {
        if (pages.length >= maxPages) break;
        try {
          const page = await fetchEvidencePage(link);
          if (page) pages.push(page);
        } catch {
          continue;
        }
      }
    }

    if (input.githubRepo) {
      try {
        const metadata = await fetchGithubMetadata(input.githubRepo);
        github = {
          repo: metadata.repo,
          description: metadata.description,
          topics: metadata.topics,
          readmeSnippet: metadata.readme?.replace(/\s+/g, " ").trim().slice(0, 12_000),
          license: metadata.license,
          stars: metadata.stars,
          forks: metadata.forks,
        };
      } catch {
        github = undefined;
      }
    }

    return {
      submittedDomain: input.submittedDomain,
      canonicalDomain,
      pages,
      sitemapUrls: await sitemapUrls(canonicalDomain),
      github,
      collectedAt: new Date().toISOString(),
    };
  }
}
