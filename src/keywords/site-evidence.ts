import type { SiteEvidence, SiteEvidencePage } from "../core/types.js";
import { fetchGithubMetadata } from "../ingest/github.js";
import { normalizeDomain } from "../utils/domain.js";
import { load, type CheerioAPI } from "cheerio";
import { compactWhitespace, lastPathExtension, splitByCharacters, trimTrailingCharacters } from "../utils/text.js";

const KEYWORD_SEPARATORS = new Set([",", "，", ";", "；", "|", "｜"]);
const NON_HTML_EXTENSIONS = new Set(["avif", "css", "gif", "ico", "jpg", "jpeg", "js", "json", "pdf", "png", "svg", "webp", "xml"]);
const TRAILING_SLASH = new Set(["/"]);

function metaValues(document: CheerioAPI, names: string[]): string[] {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const values: string[] = [];
  document("meta").each((_index, element) => {
    const row = document(element);
    const key = (row.attr("name") || row.attr("property") || "").toLowerCase();
    const content = row.attr("content");
    if (content && wanted.has(key)) values.push(content);
  });
  return [...new Set(values.map(compactWhitespace).filter(Boolean))];
}

function titleContent(document: CheerioAPI): string | undefined {
  const title = compactWhitespace(document("title").first().text());
  return title || undefined;
}

function htmlTextSnippet(document: CheerioAPI): string | undefined {
  const copy = load(document.html());
  copy("script, style, noscript, svg").remove();
  const text = compactWhitespace(copy.root().text());
  return text ? text.slice(0, 10000) : undefined;
}

function headings(document: CheerioAPI): string[] {
  const values: string[] = [];
  document("h1, h2").each((_index, element) => {
    const text = compactWhitespace(document(element).text());
    if (text) values.push(text);
  });
  return [...new Set(values)].slice(0, 30);
}

function splitKeywords(value: string): string[] {
  return splitByCharacters(value, KEYWORD_SEPARATORS);
}

function jsonLdScripts(document: CheerioAPI): unknown[] {
  const rows: unknown[] = [];
  document("script").each((_index, element) => {
    const row = document(element);
    if ((row.attr("type") || "").toLowerCase() !== "application/ld+json") return;
    const raw = row.text().trim();
    if (!raw) return;
    try {
      rows.push(JSON.parse(raw));
    } catch {
      return;
    }
  });
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
  return [...new Set(values.map(compactWhitespace).filter(Boolean))].slice(0, 50);
}

export function extractSiteEvidencePage(input: { url: string; html: string }): SiteEvidencePage {
  const document = load(input.html);
  const jsonLd = jsonLdScripts(document);
  const metaKeywords = metaValues(document, ["keywords"]).flatMap(splitKeywords);
  const jsonLdKeywords = jsonLd.flatMap((row) => valuesFromJsonLd(row, "keywords"));
  const jsonLdNames = jsonLd.flatMap((row) => valuesFromJsonLd(row, "name"));
  const jsonLdDescriptions = jsonLd.flatMap((row) => valuesFromJsonLd(row, "description"));

  return {
    url: input.url,
    title: titleContent(document) || metaValues(document, ["og:title"])[0],
    description: metaValues(document, ["description", "og:description"])[0],
    metaKeywords: [...new Set(metaKeywords)].slice(0, 50),
    headings: headings(document),
    ogTitle: metaValues(document, ["og:title"])[0],
    ogDescription: metaValues(document, ["og:description"])[0],
    twitterTitle: metaValues(document, ["twitter:title"])[0],
    twitterDescription: metaValues(document, ["twitter:description"])[0],
    jsonLdKeywords: [...new Set(jsonLdKeywords)].slice(0, 50),
    jsonLdNames: [...new Set(jsonLdNames)].slice(0, 30),
    jsonLdDescriptions: [...new Set(jsonLdDescriptions)].slice(0, 30),
    textSnippet: htmlTextSnippet(document),
  };
}

function hostForFetch(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return "";
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
  const document = load(html);
  document("a[href]").each((_index, element) => {
    const raw = document(element).attr("href")?.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    try {
      const url = new URL(raw, baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) return;
      if (normalizeDomain(url.hostname) !== rootDomain) return;
      url.hash = "";
      const pathname = trimTrailingCharacters(url.pathname, TRAILING_SLASH) || "/";
      if (pathname === "/") return;
      if (NON_HTML_EXTENSIONS.has(lastPathExtension(pathname))) return;
      const depth = pathname.split("/").filter(Boolean).length;
      const previous = links.get(url.toString());
      links.set(url.toString(), previous === undefined ? depth : Math.min(previous, depth));
    } catch {
      return;
    }
  });
  return [...links.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([url]) => url)
    .slice(0, 8);
}

async function sitemapUrls(domain: string): Promise<string[]> {
  const urls: string[] = [];
  for (const host of [`https://${domain}/sitemap.xml`, `https://www.${domain}/sitemap.xml`]) {
    try {
      const response = await fetchText(host);
      if (!response || !response.contentType.includes("xml")) continue;
      const document = load(response.text, { xmlMode: true });
      document("loc").each((_index, element) => {
        const raw = document(element).text().trim();
        try {
          const url = new URL(raw);
          if (normalizeDomain(url.hostname) === domain) urls.push(url.toString());
        } catch {
          return;
        }
      });
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
          readmeSnippet: metadata.readme ? compactWhitespace(metadata.readme).slice(0, 12_000) : undefined,
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
